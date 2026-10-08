/**
 * Database Reset & Seed Script
 * 
 * Drops all records from all application tables (Messages, Waypoints, FriendRequests,
 * ChatConnections, UserData) and purges all accounts from Supabase Auth (auth.users).
 * Then provisions clean default user accounts:
 *   - testing    | testing@testing   | testing     | United States | User
 *   - branton1   | email1@gmail.com  | password123 | United States | User
 *   - branton2   | email2@gmail.com  | password123 | United States | User
 *   - LoremIpsum | test@lorem.ipsum  | notapassword| United States | User
 *   - admin      | admin@admin.com   | password    | United States | Admin (can manage deletion requests)
 *   - dummy      | dummy@dummy.com   | password    | United States | User (correlated with dummy table records)
 * 
 * Also creates 3 dummy records for each table (ChatConnections, Waypoints, Messages, FriendRequests)
 * associated with the dummy account.
 * 
 * Usage:
 *   npm run reset-db
 *   OR
 *   node scripts/reset-db.js
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

async function resetAndSeedDatabase() {
  console.log('====================================================');
  console.log('       Chatlas Database Reset & Seeding Script       ');
  console.log('====================================================');
  console.log(`[Info] Supabase URL: ${supabaseUrl}`);

  // Step 1: Drop records from application tables in reverse dependency order
  console.log('\n[Step 1/3] Dropping records from application tables...');

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

  // Step 2: Purge existing users from Supabase Auth (auth.users)
  console.log('\n[Step 2/3] Purging existing accounts from Supabase Auth...');
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

  // Step 3: Populate seed user accounts
  console.log('\n[Step 3/5] Creating seed user accounts...');
  const SEED_ACCOUNTS = [
    {
      username: 'testing',
      email: 'testing@testing',
      password: 'testing',
      homeRegion: 'United States',
      isAdmin: false
    },
    {
      username: 'branton1',
      email: 'email1@gmail.com',
      password: 'password123',
      homeRegion: 'United States',
      isAdmin: false
    },
    {
      username: 'branton2',
      email: 'email2@gmail.com',
      password: 'password123',
      homeRegion: 'United States',
      isAdmin: false
    },
    {
      username: 'LoremIpsum',
      email: 'test@lorem.ipsum',
      password: 'notapassword',
      homeRegion: 'United States',
      isAdmin: false
    },
    {
      username: 'admin',
      email: 'admin@admin.com',
      password: 'password',
      homeRegion: 'United States',
      isAdmin: true
    },
    {
      username: 'dummy',
      email: 'dummy@dummy.com',
      password: 'password',
      homeRegion: 'United States',
      isAdmin: false
    }
  ];

  const userMap = {};

  for (const acc of SEED_ACCOUNTS) {
    const { data: newAuthUser, error: createAuthErr } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true,
      app_metadata: acc.isAdmin ? { role: 'admin', claims_admin: true } : {},
      user_metadata: {
        display_name: acc.username,
        ...(acc.isAdmin ? { role: 'admin' } : {})
      }
    });

    if (createAuthErr) {
      throw new Error(`Failed to create seed user "${acc.username}" (${acc.email}) in auth.users: ${createAuthErr.message}`);
    }
    const createdUserId = newAuthUser.user.id;
    userMap[acc.username] = createdUserId;
    const adminTag = acc.isAdmin ? ' [ADMIN]' : '';
    console.log(`  - Created Supabase Auth user: ID ${createdUserId} (${acc.email})${adminTag}`);

    const { error: profileErr } = await supabase.from('UserData').insert({
      id: createdUserId,
      user_auth_id: createdUserId,
      user_name: acc.username,
      home_region: acc.homeRegion
    });

    if (profileErr) {
      throw new Error(`Failed to link UserData profile for "${acc.username}": ${profileErr.message}`);
    }
    console.log(`  - Created UserData profile for username: "${acc.username}" (Region: ${acc.homeRegion})`);
  }

  // Step 4: Populate dummy data for other tables correlated with "dummy"
  console.log('\n[Step 4/5] Populating 3 dummy records for each table correlated with "dummy"...');
  const dummyUserId = userMap['dummy'];
  const testingUserId = userMap['testing'];
  const branton1UserId = userMap['branton1'];
  const branton2UserId = userMap['branton2'];

  // 4A. 3 ChatConnections
  const chatConnectionPayloads = [
    {
      host_user_uuid: dummyUserId,
      connected_users_uuids: [dummyUserId, testingUserId],
      closed_status: false
    },
    {
      host_user_uuid: dummyUserId,
      connected_users_uuids: [dummyUserId, branton1UserId],
      closed_status: false
    },
    {
      host_user_uuid: dummyUserId,
      connected_users_uuids: [dummyUserId, branton2UserId],
      closed_status: false
    }
  ];

  const createdChatConnections = [];
  for (const payload of chatConnectionPayloads) {
    const { data: chatData, error: chatErr } = await supabase.from('ChatConnections').insert(payload).select().single();
    if (chatErr) throw new Error(`Failed to create dummy ChatConnection: ${chatErr.message}`);
    createdChatConnections.push(chatData);
  }
  console.log(`  - Created 3 dummy ChatConnections: IDs [${createdChatConnections.map(c => c.id).join(', ')}] (Hosted by dummy)`);

  // 4B. 3 Waypoints (linked to dummy and each chat connection)
  const waypointPayloads = [
    {
      host_user: dummyUserId,
      longitude: -86.9212,
      latitude: 40.4237,
      closed_status: false,
      associated_chat_connection: createdChatConnections[0].id
    },
    {
      host_user: dummyUserId,
      longitude: -86.9168,
      latitude: 40.4259,
      closed_status: false,
      associated_chat_connection: createdChatConnections[1].id
    },
    {
      host_user: dummyUserId,
      longitude: -86.9250,
      latitude: 40.4190,
      closed_status: false,
      associated_chat_connection: createdChatConnections[2].id
    }
  ];

  const createdWaypoints = [];
  for (const payload of waypointPayloads) {
    const { data: wpData, error: wpErr } = await supabase.from('Waypoints').insert(payload).select().single();
    if (wpErr) throw new Error(`Failed to create dummy Waypoint: ${wpErr.message}`);
    createdWaypoints.push(wpData);
  }
  console.log(`  - Created 3 dummy Waypoints: IDs [${createdWaypoints.map(w => w.id).join(', ')}] (Hosted by dummy)`);

  // 4C. 3 Messages (sent by dummy into each chat connection)
  const messagePayloads = [
    {
      sender_user_id: dummyUserId,
      associated_chat_connection: createdChatConnections[0].id,
      message_contents: 'Welcome to Chat Connection #1! Hosted by dummy.'
    },
    {
      sender_user_id: dummyUserId,
      associated_chat_connection: createdChatConnections[1].id,
      message_contents: 'Location check-in at Waypoint #2 from dummy user.'
    },
    {
      sender_user_id: dummyUserId,
      associated_chat_connection: createdChatConnections[2].id,
      message_contents: 'Meetup thread at Waypoint #3 initiated by dummy user.'
    }
  ];

  const createdMessages = [];
  for (const payload of messagePayloads) {
    const { data: msgData, error: msgErr } = await supabase.from('Messages').insert(payload).select().single();
    if (msgErr) throw new Error(`Failed to create dummy Message: ${msgErr.message}`);
    createdMessages.push(msgData);
  }
  console.log(`  - Created 3 dummy Messages: IDs [${createdMessages.map(m => m.id).join(', ')}] (Sent by dummy)`);

  // 4D. 3 FriendRequests (correlated with dummy)
  const friendRequestPayloads = [
    {
      sender_id: dummyUserId,
      receiver_id: testingUserId
    },
    {
      sender_id: dummyUserId,
      receiver_id: branton1UserId
    },
    {
      sender_id: branton2UserId,
      receiver_id: dummyUserId
    }
  ];

  const createdFriendRequests = [];
  for (const payload of friendRequestPayloads) {
    const { data: frData, error: frErr } = await supabase.from('FriendRequests').insert(payload).select().single();
    if (frErr) throw new Error(`Failed to create dummy FriendRequest: ${frErr.message}`);
    createdFriendRequests.push(frData);
  }
  console.log(`  - Created 3 dummy FriendRequests: IDs [${createdFriendRequests.map(f => f.id).join(', ')}] (Correlated with dummy)`);

  // Step 5: Verify authentication for all accounts
  console.log('\n[Step 5/5] Testing authentication for all seed accounts...');
  for (const acc of SEED_ACCOUNTS) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: acc.password
    });

    if (signInErr) {
      throw new Error(`Verification sign-in failed for "${acc.email}": ${signInErr.message}`);
    }

    const { data: resolvedEmail, error: rpcErr } = await supabase.rpc('get_email_for_username', {
      check_username: acc.username
    });

    const rpcValid = !rpcErr && resolvedEmail?.toLowerCase() === acc.email.toLowerCase();
    const rpcMsg = rpcValid ? `(Username login verified: "${acc.username}" -> "${resolvedEmail}")` : '';

    const sessionUser = signInData?.session?.user;
    const verifiedAdmin = acc.isAdmin
      ? (sessionUser?.app_metadata?.role === 'admin' && sessionUser?.app_metadata?.claims_admin === true)
      : false;
    const adminMsg = acc.isAdmin ? (verifiedAdmin ? ' [Admin permissions verified]' : ' [Admin check warning]') : '';

    console.log(`  - Verified "${acc.username}" (${acc.email}) signed in successfully ${rpcMsg}${adminMsg}`);
  }

  console.log('\n====================================================');
  console.log('Database successfully reset and seeded!');
  console.log('Seeded Accounts:');
  for (const acc of SEED_ACCOUNTS) {
    const roleBadge = acc.isAdmin ? '[ADMIN]' : '[USER]';
    console.log(`  • ${roleBadge.padEnd(8)} Username: ${acc.username.padEnd(12)} Email: ${acc.email.padEnd(20)} Password: ${acc.password.padEnd(14)} Region: ${acc.homeRegion}`);
  }
  console.log('\nDummy Records Created (Associated with "dummy"):');
  console.log(`  • ChatConnections: ${createdChatConnections.length} records`);
  console.log(`  • Waypoints:       ${createdWaypoints.length} records`);
  console.log(`  • Messages:        ${createdMessages.length} records`);
  console.log(`  • FriendRequests:  ${createdFriendRequests.length} records`);
  console.log('====================================================\n');
}

resetAndSeedDatabase().catch((err) => {
  console.error('\n[Fatal Error] Database reset failed:', err.message || err);
  process.exit(1);
});
