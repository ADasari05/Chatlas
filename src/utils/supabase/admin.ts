import { createClient } from "@supabase/supabase-js";

/**
 * Creates an administrative Supabase client using the server-side Secret Key
 * (formerly known as the service_role key in legacy projects).
 * 
 * This client bypasses Row-Level Security (RLS) and has access to the Supabase Admin Auth API
 * (e.g., supabaseAdmin.auth.admin.deleteUser).
 * 
 * NEVER expose this client or SUPABASE_SECRET_KEY to the browser!
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY environment variable. Secret key is required for administrative operations such as user deletion."
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
