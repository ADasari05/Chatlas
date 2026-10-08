import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

// Helper to authenticate caller via Bearer token or cookies
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
 * DELETE /api/users
 * Receives, validates, and applies requests to permanently delete a user from the Supabase Auth database
 * and purge their personal data from application tables.
 */
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authHeader = request.headers.get("authorization");

  // 1. Authenticate Caller
  const supabase = await createClient({ authHeader });
  const caller = await authenticateCaller(supabase, authHeader);

  if (!caller) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in or provide a valid Bearer token." },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 2. Parse target user_id from body or query parameters
  let targetUserId: string | null = null;

  // Check URL query parameters first
  const { searchParams } = new URL(request.url);
  const queryUserId = searchParams.get("user_id");
  if (queryUserId) {
    targetUserId = queryUserId.trim();
  } else {
    // Attempt parsing JSON body
    try {
      const body = await request.json();
      if (body && typeof body === "object" && "user_id" in body) {
        const idVal = (body as Record<string, unknown>).user_id;
        if (typeof idVal === "string") {
          targetUserId = idVal.trim();
        }
      }
    } catch {
      // Body is not JSON or empty
    }
  }

  // 3. Validate presence of user_id
  if (!targetUserId) {
    return NextResponse.json(
      { error: "Validation failed: 'user_id' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 4. Validate UUID format
  if (!UUID_REGEX.test(targetUserId)) {
    return NextResponse.json(
      { error: "Validation failed: 'user_id' must be a valid UUID." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 5. Authorize Request (Caller must be deleting self, or possess admin role)
  const isSelf = caller.id.toLowerCase() === targetUserId.toLowerCase();
  const isAdmin =
    caller.app_metadata?.role === "admin" ||
    caller.user_metadata?.role === "admin" ||
    caller.app_metadata?.claims_admin === true;

  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: You are not authorized to delete another user's account." },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  // 6. Check server configuration for admin client
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

  // 7. Verify target user exists in Supabase Auth
  const { data: targetUser, error: getUserError } =
    await supabaseAdmin.auth.admin.getUserById(targetUserId);

  if (getUserError || !targetUser?.user) {
    return NextResponse.json(
      { error: `User with ID ${targetUserId} not found in Supabase Auth.` },
      { status: 404, headers: corsHeaders(origin) }
    );
  }

  // 8. Apply deletion: Handle relational dependencies
  // - All messages are KEPT (detached from deleted waypoints and deleted user)
  // - All waypoints hosted by the user are DELETED
  // - ChatConnections and FriendRequests are cleaned up
  // - UserData profile row is deleted
  try {
    // A. Resolve all IDs associated with this user (both UserData.id and auth.users.id)
    const { data: userProfiles } = await supabaseAdmin
      .from("UserData")
      .select("id, user_auth_id")
      .or(`id.eq.${targetUserId},user_auth_id.eq.${targetUserId}`);

    const profileIds = (userProfiles || []).map((p) => p.id);
    const authIds = (userProfiles || []).map((p) => p.user_auth_id).filter(Boolean);
    const allUserIds = Array.from(new Set([...profileIds, ...authIds, targetUserId]));

    // B. Find all waypoints hosted by this user
    const { data: userWaypoints } = await supabaseAdmin
      .from("Waypoints")
      .select("id")
      .in("host_user", allUserIds);

    const waypointIds = (userWaypoints || []).map((w) => w.id);

    // C. PRESERVE MESSAGES:
    // Detach messages sent by this user (assign sender to null so messages are kept and FK is satisfied)
    await supabaseAdmin
      .from("Messages")
      .update({ sender_user_id: null })
      .in("sender_user_id", allUserIds);

    // D. DELETE WAYPOINTS:
    // Delete all waypoints hosted by the user
    if (waypointIds.length > 0) {
      await supabaseAdmin
        .from("Waypoints")
        .delete()
        .in("id", waypointIds);
    }

    // E. Clean up FriendRequests and ChatConnections
    await supabaseAdmin
      .from("FriendRequests")
      .delete()
      .or(`sender_id.in.(${allUserIds.join(",")}),receiver_id.in.(${allUserIds.join(",")})`);

    const { data: userChats } = await supabaseAdmin
      .from("ChatConnections")
      .select("id")
      .in("host_user_uuid", allUserIds);

    const chatIds = (userChats || []).map((c) => c.id);
    if (chatIds.length > 0) {
      // Delete messages in those deleted chat rooms before removing chat connections
      await supabaseAdmin
        .from("Messages")
        .delete()
        .in("associated_chat_connection", chatIds);

      await supabaseAdmin
        .from("ChatConnections")
        .delete()
        .in("id", chatIds);
    }

    // F. Delete UserData profile row
    await supabaseAdmin
      .from("UserData")
      .delete()
      .or(`id.in.(${allUserIds.join(",")}),user_auth_id.in.(${allUserIds.join(",")})`);
  } catch (dbErr: unknown) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error("Warning: Error updating user application data during deletion:", msg);
  }

  // 9. Apply deletion: Delete user from Supabase Auth database (auth.users)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete user from Supabase Auth: ${deleteError.message}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: "User successfully deleted from Supabase Auth and all associated personal data removed.",
      deleted_user_id: targetUserId,
    },
    { status: 200, headers: corsHeaders(origin) }
  );
}
