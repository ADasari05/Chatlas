import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

function corsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (origin) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

async function authenticateCaller(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authHeader: string | null
) {
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) return data.user;
  } else {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) return data.user;
  }
  return null;
}

/**
 * GET /api/admin/deletion-requests
 * Returns all user accounts with disabled_status = TRUE (pending deletion requests).
 * Accessible ONLY by administrators.
 * Returns: { requests: [ { uuid, username, email } ] }
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authHeader = request.headers.get("authorization");

  // 1. Authenticate caller
  const supabase = await createClient({ authHeader });
  const caller = await authenticateCaller(supabase, authHeader);

  if (!caller) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in or provide a valid Bearer token." },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 2. Authorize administrator role
  const isAdmin =
    caller.app_metadata?.role === "admin" ||
    caller.user_metadata?.role === "admin" ||
    caller.app_metadata?.claims_admin === true;

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: Administrator role required to view deletion requests." },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  // 3. Create admin client to query across UserData and auth.users
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Server configuration error: ${msg}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  // 4. Query UserData where disabled_status is true
  const { data: requestedProfiles, error: fetchErr } = await supabaseAdmin
    .from("UserData")
    .select("id, user_auth_id, user_name, disabled_status")
    .eq("disabled_status", true);

  if (fetchErr) {
    return NextResponse.json(
      { error: `Database error querying deletion requests: ${fetchErr.message}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  // 5. Match with auth.users to resolve email addresses
  const requests = await Promise.all(
    (requestedProfiles || []).map(async (profile) => {
      const authId = profile.user_auth_id || profile.id;
      let email = "Unknown / Deleted";

      if (authId) {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(authId);
          if (authUser?.user?.email) {
            email = authUser.user.email;
          }
        } catch {
          // If auth lookup fails or user was partially purged
        }
      }

      return {
        uuid: authId,
        user_data_id: profile.id,
        username: profile.user_name || "Unknown",
        email: email,
      };
    })
  );

  return NextResponse.json(
    {
      success: true,
      requests,
    },
    { status: 200, headers: corsHeaders(origin) }
  );
}
