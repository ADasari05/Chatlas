import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MAX_MESSAGE_LENGTH = 2000;

function corsHeaders(origin?: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

/**
 * GET /api/messages?waypoint_id=<id>
 * Fetches all messages associated with a given waypoint.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const { searchParams } = new URL(request.url);
  const waypointParam = searchParams.get("waypoint_id");

  if (!waypointParam) {
    return NextResponse.json(
      { error: "Query parameter 'waypoint_id' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const waypointId = Number(waypointParam);
  if (!Number.isInteger(waypointId) || waypointId <= 0) {
    return NextResponse.json(
      { error: "Query parameter 'waypoint_id' must be a positive integer." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const authHeader = request.headers.get("authorization");
  const supabase = await createClient({ authHeader });
  const { data: messages, error } = await supabase
    .from("Messages")
    .select("*")
    .eq("waypoint_id", waypointId)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(
    { success: true, count: messages.length, data: messages },
    { status: 200, headers: corsHeaders(origin) }
  );
}

/**
 * POST /api/messages
 * Validates and stores a new message for a waypoint.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authHeader = request.headers.get("authorization");

  // 1. Authenticate Caller
  const supabase = await createClient({ authHeader });
  let user = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.substring(7).trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  } else {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in or provide a valid Bearer token." },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 2. Parse JSON Body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Malformed request: Body must be valid JSON." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Malformed request: Payload must be a JSON object." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const { waypoint_id, message_contents } = body as Record<string, unknown>;

  // 3. Validate waypoint_id
  if (waypoint_id === undefined || waypoint_id === null || waypoint_id === "") {
    return NextResponse.json(
      { error: "Validation failed: 'waypoint_id' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const numWaypointId = Number(waypoint_id);
  if (!Number.isInteger(numWaypointId) || numWaypointId <= 0) {
    return NextResponse.json(
      { error: "Validation failed: 'waypoint_id' must be a positive integer." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 4. Validate message_contents
  if (message_contents === undefined || message_contents === null) {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (typeof message_contents !== "string") {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' must be a string." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const trimmedContents = message_contents.trim();
  if (trimmedContents.length === 0) {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' cannot be empty or whitespace only." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (message_contents.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        error: `Validation failed: 'message_contents' exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
      },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 5. Verify Target Waypoint Exists in Database
  const { data: waypoint, error: wpError } = await supabase
    .from("Waypoints")
    .select("id")
    .eq("id", numWaypointId)
    .maybeSingle();

  if (wpError) {
    return NextResponse.json(
      { error: `Database error checking waypoint: ${wpError.message}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  if (!waypoint) {
    return NextResponse.json(
      { error: `Waypoint with ID ${numWaypointId} not found.` },
      { status: 404, headers: corsHeaders(origin) }
    );
  }

  // 6. Apply Valid Request: Insert into Messages Table
  const { data: newMessage, error: insertError } = await supabase
    .from("Messages")
    .insert({
      sender_user_id: user.id,
      waypoint_id: numWaypointId,
      message_contents: trimmedContents,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to save message: ${insertError.message}` },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: newMessage,
    },
    { status: 201, headers: corsHeaders(origin) }
  );
}
