import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const MAX_MESSAGE_LENGTH = 2000;

function corsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
 * GET /api/messages?chat_connection_id=<id> (or ?associated_chat_connection=<id> / ?waypoint_id=<id>)
 * Validates request and fetches all messages associated with a given chat connection.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authHeader = request.headers.get("authorization");

  // 1. Authenticate Caller
  const supabase = await createClient({ authHeader });
  const user = await authenticateCaller(supabase, authHeader);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in or provide a valid Bearer token." },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 2. Validate Query Parameter
  const { searchParams } = new URL(request.url);
  const chatParam = searchParams.get("associated_chat_connection") || searchParams.get("chat_connection_id");
  const waypointParam = searchParams.get("waypoint_id");

  if (!chatParam && !waypointParam) {
    return NextResponse.json(
      { error: "Validation failed: Query parameter 'associated_chat_connection' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  let targetChatId: number;

  if (chatParam) {
    const parsedId = Number(chatParam);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return NextResponse.json(
        { error: "Validation failed: Query parameter 'associated_chat_connection' must be a positive integer." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    targetChatId = parsedId;

    // Verify ChatConnection Exists
    const { data: chatConn, error: chatErr } = await supabase
      .from("ChatConnections")
      .select("id")
      .eq("id", targetChatId)
      .maybeSingle();

    if (chatErr) {
      return NextResponse.json(
        { error: `Database error checking chat connection: ${chatErr.message}` },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!chatConn) {
      return NextResponse.json(
        { error: `Chat connection with ID ${targetChatId} not found.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }
  } else {
    // Backwards compatibility: resolve chat connection via waypoint_id
    const parsedWpId = Number(waypointParam);
    if (!Number.isInteger(parsedWpId) || parsedWpId <= 0) {
      return NextResponse.json(
        { error: "Validation failed: Query parameter 'waypoint_id' must be a positive integer." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const { data: waypoint, error: wpError } = await supabase
      .from("Waypoints")
      .select("id, associated_chat_connection")
      .eq("id", parsedWpId)
      .maybeSingle();

    if (wpError) {
      return NextResponse.json(
        { error: `Database error checking waypoint: ${wpError.message}` },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!waypoint) {
      return NextResponse.json(
        { error: `Waypoint with ID ${parsedWpId} not found.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (!waypoint.associated_chat_connection) {
      return NextResponse.json(
        { error: `Waypoint with ID ${parsedWpId} has no associated chat connection.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    targetChatId = waypoint.associated_chat_connection;
  }

  // 3. Retrieve Messages
  const { data: messages, error } = await supabase
    .from("Messages")
    .select("*")
    .eq("associated_chat_connection", targetChatId)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `Database error fetching messages: ${error.message}` },
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
 * Validates and stores a new message for a chat connection.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authHeader = request.headers.get("authorization");

  // 1. Authenticate Caller
  const supabase = await createClient({ authHeader });
  const user = await authenticateCaller(supabase, authHeader);

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

  const payload = body as Record<string, unknown>;
  const rawChatId = payload.associated_chat_connection ?? payload.chat_connection_id;
  const rawWaypointId = payload.waypoint_id;

  // 3. Validate Target Parameter (Syntax)
  let rawParsedChatId: number | null = null;
  let rawParsedWpId: number | null = null;

  if (rawChatId !== undefined && rawChatId !== null && rawChatId !== "") {
    const numChatId = Number(rawChatId);
    if (!Number.isInteger(numChatId) || numChatId <= 0) {
      return NextResponse.json(
        { error: "Validation failed: 'associated_chat_connection' must be a positive integer." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    rawParsedChatId = numChatId;
  } else if (rawWaypointId !== undefined && rawWaypointId !== null && rawWaypointId !== "") {
    // Backwards compatibility with waypoint_id
    const numWaypointId = Number(rawWaypointId);
    if (!Number.isInteger(numWaypointId) || numWaypointId <= 0) {
      return NextResponse.json(
        { error: "Validation failed: 'waypoint_id' must be a positive integer." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
    rawParsedWpId = numWaypointId;
  } else {
    return NextResponse.json(
      { error: "Validation failed: 'associated_chat_connection' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 4. Validate message_contents (Syntax & limits before database operations)
  const messageContents = payload.message_contents;
  if (messageContents === undefined || messageContents === null) {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' is required." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (typeof messageContents !== "string") {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' must be a string." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const trimmedContents = messageContents.trim();
  if (trimmedContents.length === 0) {
    return NextResponse.json(
      { error: "Validation failed: 'message_contents' cannot be empty or whitespace only." },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (messageContents.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        error: `Validation failed: 'message_contents' exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
      },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  // 5. Verify Target Entity Exists in Database and is Open
  let targetChatId: number;

  if (rawParsedChatId !== null) {
    targetChatId = rawParsedChatId;

    const { data: chatConn, error: chatErr } = await supabase
      .from("ChatConnections")
      .select("id, closed_status")
      .eq("id", targetChatId)
      .maybeSingle();

    if (chatErr) {
      return NextResponse.json(
        { error: `Database error checking chat connection: ${chatErr.message}` },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!chatConn) {
      return NextResponse.json(
        { error: `Chat connection with ID ${targetChatId} not found.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (chatConn.closed_status === true) {
      return NextResponse.json(
        { error: `Chat connection ${targetChatId} is closed. Cannot send message.` },
        { status: 400, headers: corsHeaders(origin) }
      );
    }
  } else {
    // Backwards compatibility: verify waypoint exists and has associated chat connection
    const { data: waypoint, error: wpError } = await supabase
      .from("Waypoints")
      .select("id, associated_chat_connection")
      .eq("id", rawParsedWpId!)
      .maybeSingle();

    if (wpError) {
      return NextResponse.json(
        { error: `Database error checking waypoint: ${wpError.message}` },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!waypoint) {
      return NextResponse.json(
        { error: `Waypoint with ID ${rawParsedWpId} not found.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    if (!waypoint.associated_chat_connection) {
      return NextResponse.json(
        { error: `Waypoint with ID ${rawParsedWpId} has no associated chat connection.` },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    targetChatId = waypoint.associated_chat_connection;
  }

  // 6. Apply Valid Request: Insert into Messages Table
  const { data: newMessage, error: insertError } = await supabase
    .from("Messages")
    .insert({
      sender_user_id: user.id,
      associated_chat_connection: targetChatId,
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

