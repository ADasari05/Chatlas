/**
 * Database Clear Script
 * 
 * Drops all records from all application tables (Messages, Waypoints, FriendRequests,
 * ChatConnections, UserData) and purges all user accounts from Supabase Auth (auth.users).
 * Leaves the database completely empty.
 * 
 * Usage:
 *   npm run clear-db
 *   OR
 *   node scripts/clear-db.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables from .env.local if not already provided
function loadEnvironment() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return;
  }

  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex !== -1) {
        const key = trimmed.slice(0, eqIndex).trim();
        let val = trimmed.slice(eqIndex + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvironment();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('[Error] Missing NEXT_PUBLIC_SUPABASE_URL environment variable in .env.local');
  process.exit(1);
}

if (!secretKey) {
  console.error('[Error] Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY environment variable in .env.local');
  console.error('        Administrative privileges are required to purge database tables and auth accounts.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearDatabase() {
  console.log('====================================================');
  console.log('            Chatlas Database Clear Script           ');
  console.log('====================================================');
  console.log(`[Info] Supabase URL: ${supabaseUrl}`);

  // Step 1: Drop records from application tables in reverse dependency order
  console.log('\n[Step 1/2] Dropping records from application tables...');

  // 1A. Messages (Child of ChatConnections and UserData)
  const { count: msgCount } = await supabase.from('Messages').select('*', { count: 'exact', head: true });
  const { error: msgErr } = await supabase.from('Messages').delete().neq('id', 0);
  if (msgErr) throw new Error(`Failed to delete records from Messages: ${msgErr.message}`);
  console.log(`  - Cleared Messages table (${msgCount ?? 0} rows deleted)`);

  // 1B. Waypoints (Child of ChatConnections and UserData)
  const { count: wpCount } = await supabase.from('Waypoints').select('*', { count: 'exact', head: true });
  const { error: wpErr } = await supabase.from('Waypoints').delete().neq('id', 0);
  if (wpErr) throw new Error(`Failed to delete records from Waypoints: ${wpErr.message}`);
  console.log(`  - Cleared Waypoints table (${wpCount ?? 0} rows deleted)`);

  // 1C. FriendRequests (Child of UserData)
  const { count: frCount } = await supabase.from('FriendRequests').select('*', { count: 'exact', head: true });
  const { error: frErr } = await supabase.from('FriendRequests').delete().neq('id', 0);
  if (frErr) throw new Error(`Failed to delete records from FriendRequests: ${frErr.message}`);
  console.log(`  - Cleared FriendRequests table (${frCount ?? 0} rows deleted)`);

  // 1D. ChatConnections (Child of UserData)
  const { count: chatCount } = await supabase.from('ChatConnections').select('*', { count: 'exact', head: true });
  const { error: chatErr } = await supabase.from('ChatConnections').delete().neq('id', 0);
  if (chatErr) throw new Error(`Failed to delete records from ChatConnections: ${chatErr.message}`);
  console.log(`  - Cleared ChatConnections table (${chatCount ?? 0} rows deleted)`);

  // 1E. UserData (Child of auth.users)
  const { count: userCount } = await supabase.from('UserData').select('*', { count: 'exact', head: true });
  const { error: userErr } = await supabase.from('UserData').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (userErr) throw new Error(`Failed to delete records from UserData: ${userErr.message}`);
  console.log(`  - Cleared UserData table (${userCount ?? 0} rows deleted)`);

  // Step 2: Purge all accounts from Supabase Auth (auth.users)
  console.log('\n[Step 2/2] Purging all accounts from Supabase Auth...');
  let totalAuthDeleted = 0;
  let page = 1;

  while (true) {
    const { data: pageData, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 50 });
    if (listErr) throw new Error(`Failed to list users from Supabase Auth: ${listErr.message}`);

    const users = pageData?.users || [];
    if (users.length === 0) break;

    for (const u of users) {
      const { error: delUserErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delUserErr) {
        console.warn(`  [Warning] Failed to delete user ${u.id} (${u.email}): ${delUserErr.message}`);
      } else {
        totalAuthDeleted++;
      }
    }

    if (users.length < 50) break;
    page++;
  }
  console.log(`  - Purged ${totalAuthDeleted} accounts from auth.users`);

  console.log('\n====================================================');
  console.log('Database successfully cleared! All tables are empty.');
  console.log('====================================================\n');
}

clearDatabase().catch((err) => {
  console.error('\n[Fatal Error] Database clear failed:', err.message || err);
  process.exit(1);
});
