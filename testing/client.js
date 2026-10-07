// Chatlas Authentication Test Client Engine
(() => {
  'use strict';

  let supabaseClient = null;
  let currentSession = null;

  // DOM Elements
  const connBadge = document.getElementById('conn-badge');
  const connDot = document.getElementById('conn-dot');
  const authStatusText = document.getElementById('auth-status-text');
  const authUserId = document.getElementById('auth-user-id');
  const authUserDetails = document.getElementById('auth-user-details');
  const authUserRegion = document.getElementById('auth-user-region');
  const btnSignOut = document.getElementById('btn-sign-out');
  const logTerminal = document.getElementById('log-terminal');
  const signupRegionSelect = document.getElementById('signup-region');
  const updateRegionSelect = document.getElementById('update-region-select');

  // Surface errors directly onto the on-screen log terminal
  window.addEventListener('error', (event) => {
    log('Browser Error', `${event.message} (${event.filename}:${event.lineno})`, true);
  });

  window.addEventListener('unhandledrejection', (event) => {
    log('Promise Rejection', event.reason?.message || event.reason || 'Unhandled rejection', true);
  });

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Logging Utility
  function log(action, details, isError = false) {
    if (!logTerminal) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${isError ? 'error' : ''}`;
    const time = new Date().toLocaleTimeString();
    
    let formattedDetails = '';
    if (details !== undefined && details !== null) {
      if (typeof details === 'object') {
        formattedDetails = `<div class="log-json">${JSON.stringify(details, null, 2)}</div>`;
      } else {
        formattedDetails = `<span class="${isError ? 'log-error' : 'log-success'}"> ${details}</span>`;
      }
    }

    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-action">${action}:</span> ${formattedDetails}`;
    logTerminal.appendChild(entry);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  const clearBtn = document.getElementById('btn-clear-logs');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      logTerminal.innerHTML = '<div class="log-entry"><span class="log-time">[System]</span> Log cleared.</div>';
    });
  }

  // Update Auth Status Bar
  async function updateAuthBanner(session) {
    currentSession = session;
    if (session && session.user) {
      authStatusText.textContent = 'Logged In';
      authStatusText.style.color = 'var(--success)';
      authUserId.textContent = session.user.id.substring(0, 8) + '...';
      authUserDetails.textContent = `${session.user.user_metadata?.display_name || 'User'} (${session.user.email})`;
      if (btnSignOut) btnSignOut.disabled = false;

      // Fetch user profile info from Supabase
      try {
        const { data } = await supabaseClient.rpc('get_account_info').maybeSingle();
        if (data && data.home_region) {
          authUserRegion.textContent = data.home_region;
        } else {
          authUserRegion.textContent = 'None';
        }
      } catch {
        authUserRegion.textContent = '—';
      }
    } else {
      authStatusText.textContent = 'Logged Out';
      authStatusText.style.color = 'var(--text-muted)';
      authUserId.textContent = 'None';
      authUserDetails.textContent = '—';
      authUserRegion.textContent = '—';
      if (btnSignOut) btnSignOut.disabled = true;
    }
  }

  // Load Home Regions
  async function loadHomeRegions() {
    try {
      const { data, error } = await supabaseClient.rpc('get_home_regions');
      if (error) throw error;
      if (data && Array.isArray(data)) {
        signupRegionSelect.innerHTML = '<option value="">Select Region...</option>';
        updateRegionSelect.innerHTML = '<option value="">Select Region...</option>';
        data.forEach(region => {
          const opt1 = document.createElement('option');
          opt1.value = region;
          opt1.textContent = region;
          signupRegionSelect.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = region;
          opt2.textContent = region;
          updateRegionSelect.appendChild(opt2);
        });
        log('Home Regions Loaded', `${data.length} regions available`);
      }
    } catch (err) {
      log('Failed to load regions', err.message, true);
    }
  }

  // Helper to ensure window.supabase is loaded
  async function waitForSupabase(timeoutMs = 4000) {
    const start = Date.now();
    while (!window.supabase || typeof window.supabase.createClient !== 'function') {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Supabase JS library failed to load in time.');
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return window.supabase;
  }

  // Initialize Supabase Connection via Server Config
  async function init() {
    log('System', 'Initializing test client...');
    try {
      const supabaseLib = await waitForSupabase();

      const res = await fetch('/api/config');
      if (!res.ok) throw new Error(`HTTP error fetching config: ${res.status}`);
      const config = await res.json();

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('Supabase credentials missing from .env.local');
      }

      supabaseClient = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey);
      
      if (connBadge) connBadge.textContent = 'Connected';
      if (connDot) connDot.className = 'status-dot dot-green';
      log('Supabase Client Connected', { url: config.supabaseUrl });

      // Check existing session
      const { data: { session } } = await supabaseClient.auth.getSession();
      await updateAuthBanner(session);

      // Setup Auth Listener
      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        log(`Auth Event: ${event}`, { userId: session?.user?.id });
        await updateAuthBanner(session);
      });

      // Populate regions
      await loadHomeRegions();
    } catch (err) {
      if (connBadge) connBadge.textContent = 'Connection Error';
      if (connDot) connDot.className = 'status-dot dot-red';
      log('Initialization Error', err.message, true);
    }
  }

  // --- Interactive Console Handlers ---

  // Sign Up
  const formSignup = document.getElementById('form-signup');
  const btnSignup = document.getElementById('btn-signup');

  async function executeSignUp(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!supabaseClient) return log('Error', 'Client not initialized', true);
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const homeRegion = signupRegionSelect.value;

    if (!email || !username || !password || !homeRegion) {
      log('Sign Up Validation Failed', 'Please fill in all fields (email, username, password, home region).', true);
      return;
    }

    if (password.length < 6) {
      log('Sign Up Validation Failed', 'Password must be at least 6 characters.', true);
      return;
    }

    log('Executing Sign Up', { email, username, homeRegion });
    try {
      // 1. Check duplicate username
      const { data: isTaken, error: checkError } = await supabaseClient.rpc('is_display_name_taken', { check_name: username });
      if (checkError) throw checkError;
      if (isTaken) {
        log('Sign Up Rejected', `Username "${username}" is already taken.`, true);
        return;
      }

      // 2. Auth signup
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: username } }
      });
      if (error) throw error;

      log('Auth SignUp Success', { userId: data.user?.id, email: data.user?.email });

      // 3. UserData profile insertion
      if (data.user) {
        const { error: insertError } = await supabaseClient.from('UserData').insert({
          id: data.user.id,
          user_auth_id: data.user.id,
          user_name: username,
          home_region: homeRegion
        });
        if (insertError) throw insertError;
        log('UserData Insert Success', { id: data.user.id, user_name: username, home_region: homeRegion });
      }
    } catch (err) {
      log('Sign Up Error', err.message || err, true);
    }
  }

  if (formSignup) formSignup.addEventListener('submit', executeSignUp);
  if (btnSignup) btnSignup.addEventListener('click', executeSignUp);

  // Sign In
  const formSignin = document.getElementById('form-signin');
  const btnSignin = document.getElementById('btn-signin');

  async function executeSignIn(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!supabaseClient) return log('Error', 'Client not initialized', true);
    const identifier = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    if (!identifier || !password) {
      log('Sign In Validation Failed', 'Please provide email/username and password.', true);
      return;
    }

    let loginEmail = identifier;
    log('Executing Sign In', { identifier });

    try {
      // If user entered a username (no '@'), resolve to email via RPC
      if (!loginEmail.includes('@')) {
        const { data: resolvedEmail, error: resolveErr } = await supabaseClient.rpc('get_email_for_username', {
          check_username: loginEmail
        });
        if (resolveErr || !resolvedEmail) {
          log('Sign In Rejected', 'Invalid login credentials or username not found.', true);
          return;
        }
        loginEmail = resolvedEmail;
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;

      // Check if account is disabled/pending deletion
      const { data: emailStatus } = await supabaseClient.rpc('get_email_status', { check_email: loginEmail }).maybeSingle();
      if (emailStatus && emailStatus.disabled) {
        await supabaseClient.auth.signOut();
        log('Sign In Blocked', 'This account is pending deletion and cannot be signed in to.', true);
        return;
      }

      log('Sign In Success', { user: data.user.email, sessionToken: data.session.access_token.substring(0, 20) + '...' });
    } catch (err) {
      log('Sign In Error', err.message || err, true);
    }
  }

  if (formSignin) formSignin.addEventListener('submit', executeSignIn);
  if (btnSignin) btnSignin.addEventListener('click', executeSignIn);

  // Sign Out
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      if (!supabaseClient) return;
      log('Executing Sign Out', 'Clearing session...');
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        log('Sign Out Error', error.message, true);
      } else {
        log('Sign Out Success', 'User signed out cleanly.');
      }
    });
  }

  // Refresh Session
  const btnRefresh = document.getElementById('btn-refresh-session');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      if (!supabaseClient) return;
      log('Refreshing Session Token', 'Requesting refreshed JWT...');
      const { data, error } = await supabaseClient.auth.refreshSession();
      if (error) {
        log('Session Refresh Error', error.message, true);
      } else {
        log('Session Refreshed Successfully', {
          expiresAt: new Date(data.session?.expires_at * 1000).toLocaleTimeString()
        });
      }
    });
  }

  // Update Username
  const btnUpdateName = document.getElementById('btn-update-username');
  if (btnUpdateName) {
    btnUpdateName.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const newName = document.getElementById('update-username-input').value.trim();
      if (!newName) return log('Validation Error', 'Enter new username.', true);

      log('Updating Username', { newName });
      try {
        const { error: authError } = await supabaseClient.auth.updateUser({ data: { display_name: newName } });
        if (authError) throw authError;

        const { error: rpcError } = await supabaseClient.rpc('update_username', { new_name: newName });
        if (rpcError) throw rpcError;

        log('Username Updated Successfully', newName);
        const { data: { session } } = await supabaseClient.auth.getSession();
        await updateAuthBanner(session);
      } catch (err) {
        log('Update Username Error', err.message || err, true);
      }
    });
  }

  // Update Region
  const btnUpdateRegion = document.getElementById('btn-update-region');
  if (btnUpdateRegion) {
    btnUpdateRegion.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const newRegion = updateRegionSelect.value;
      if (!newRegion) return log('Validation Error', 'Select new region.', true);

      log('Updating Region', { newRegion });
      try {
        const { error } = await supabaseClient.rpc('update_region', { new_region: newRegion });
        if (error) throw error;
        log('Region Updated Successfully', newRegion);
        const { data: { session } } = await supabaseClient.auth.getSession();
        await updateAuthBanner(session);
      } catch (err) {
        log('Update Region Error', err.message || err, true);
      }
    });
  }

  // Request Account Deletion
  const btnDelete = document.getElementById('btn-delete-account');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!supabaseClient) return;
      log('Requesting Account Deletion', 'Invoking request_account_deletion RPC...');
      try {
        const { error } = await supabaseClient.rpc('request_account_deletion');
        if (error) throw error;
        log('Account Deletion Requested Successfully', 'Account marked pending deletion.');
        await supabaseClient.auth.signOut();
      } catch (err) {
        log('Account Deletion Error', err.message || err, true);
      }
    });
  }

  // --- Messages Table Operations ---
  const btnCreateWaypoint = document.getElementById('btn-create-test-waypoint');
  if (btnCreateWaypoint) {
    btnCreateWaypoint.addEventListener('click', async () => {
      if (!supabaseClient) return log('Error', 'Client not initialized', true);

      log('Creating Test Waypoint', { hostUser: currentSession?.user?.id || null });
      try {
        const { data, error } = await supabaseClient.from('Waypoints').insert({
          host_user: currentSession?.user?.id || null,
          longitude: -86.913,
          latitude: 40.424
        }).select().single();

        if (error) throw error;
        const wpInput = document.getElementById('msg-waypoint-id');
        if (wpInput) wpInput.value = data.id;
        log('Waypoint Created', { id: data.id, host_user: data.host_user });
      } catch (err) {
        log('Create Waypoint Error', err.message || err, true);
      }
    });
  }

  const btnSaveMessage = document.getElementById('btn-save-message');
  if (btnSaveMessage) {
    btnSaveMessage.addEventListener('click', async () => {
      if (!supabaseClient) return log('Error', 'Client not initialized', true);

      const waypointId = document.getElementById('msg-waypoint-id').value.trim();
      const contents = document.getElementById('msg-contents').value.trim();

      if (!waypointId || !contents) {
        return log('Validation Error', 'Waypoint ID and message contents are required.', true);
      }

      const senderId = currentSession?.user?.id || null;
      log('Saving Message to Waypoint', { waypointId: Number(waypointId), contents, senderUserId: senderId });
      try {
        const { data, error } = await supabaseClient.from('Messages').insert({
          sender_user_id: senderId,
          waypoint_id: Number(waypointId),
          message_contents: contents,
          timestamp: new Date().toISOString()
        }).select().single();

        if (error) throw error;
        log('Message Saved Successfully', {
          id: data.id,
          sender_user_id: data.sender_user_id,
          waypoint_id: data.waypoint_id,
          message_contents: data.message_contents,
          timestamp: data.timestamp
        });
      } catch (err) {
        log('Save Message Error', err.message || err, true);
      }
    });
  }

  const btnSaveMessageApi = document.getElementById('btn-save-message-api');
  if (btnSaveMessageApi) {
    btnSaveMessageApi.addEventListener('click', async () => {
      const waypointId = document.getElementById('msg-waypoint-id').value.trim();
      const contents = document.getElementById('msg-contents').value;
      if (!waypointId || !contents) {
        return log('Validation Error', 'Waypoint ID and message contents are required.', true);
      }
      log('Sending Message via Next.js Backend API (POST /api/messages)', { waypointId, contents });
      try {
        const session = currentSession || (await supabaseClient.auth.getSession()).data.session;
        const token = session?.access_token;
        const res = await fetch('http://localhost:3000/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            waypoint_id: Number(waypointId),
            message_contents: contents
          })
        });
        const data = await res.json();
        if (!res.ok) {
          log(`Backend API Error (${res.status})`, data.error || data, true);
        } else {
          log(`Backend API Success (${res.status})`, data);
        }
      } catch (err) {
        log('Backend API Request Failed', err.message || err, true);
      }
    });
  }

  const btnFetchMessages = document.getElementById('btn-fetch-messages');
  if (btnFetchMessages) {
    btnFetchMessages.addEventListener('click', async () => {
      if (!supabaseClient) return log('Error', 'Client not initialized', true);
      const waypointId = document.getElementById('msg-waypoint-id').value.trim();
      if (!waypointId) return log('Validation Error', 'Enter Waypoint ID to fetch messages for.', true);

      log('Fetching Messages (Direct DB) for Waypoint', { waypointId: Number(waypointId) });
      try {
        const { data, error } = await supabaseClient.from('Messages')
          .select('*')
          .eq('waypoint_id', Number(waypointId))
          .order('timestamp', { ascending: true });

        if (error) throw error;
        log(`Retrieved ${data.length} Messages for Waypoint #${waypointId}`, data);
      } catch (err) {
        log('Fetch Messages Error', err.message || err, true);
      }
    });
  }

  const btnFetchMessagesApi = document.getElementById('btn-fetch-messages-api');
  if (btnFetchMessagesApi) {
    btnFetchMessagesApi.addEventListener('click', async () => {
      const waypointId = document.getElementById('msg-waypoint-id').value.trim();
      if (!waypointId) return log('Validation Error', 'Enter Waypoint ID to fetch messages for.', true);

      log('Fetching Messages via Next.js Backend API (GET /api/messages)', { waypointId });
      try {
        const session = currentSession || (await supabaseClient.auth.getSession()).data.session;
        const token = session?.access_token;
        const res = await fetch(`http://localhost:3000/api/messages?waypoint_id=${encodeURIComponent(waypointId)}`, {
          method: 'GET',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const data = await res.json();
        if (!res.ok) {
          log(`Backend API Error (${res.status})`, data.error || data, true);
        } else {
          log(`Backend API Success (${res.status}) - ${data.count} Messages`, data);
        }
      } catch (err) {
        log('Backend API Request Failed', err.message || err, true);
      }
    });
  }

  // --- Automated Test Suite Runner & Categorization ---

  const testCategories = [
    { id: 'cat-validation', scoreId: 'score-cat-1', testIds: [1, 2, 3] },
    { id: 'cat-registration', scoreId: 'score-cat-2', testIds: [4, 5] },
    { id: 'cat-auth', scoreId: 'score-cat-3', testIds: [6, 7, 8] },
    { id: 'cat-messages', scoreId: 'score-cat-4', testIds: [9, 10] },
    { id: 'cat-api-validation', scoreId: 'score-cat-5', testIds: [11, 12, 13, 14, 15, 16, 17, 18] },
    { id: 'cat-lifecycle', scoreId: 'score-cat-6', testIds: [19, 20] },
    { id: 'cat-api-viewing', scoreId: 'score-cat-7', testIds: [21, 22, 23, 24, 25] }
  ];

  const testResults = {};

  function updateCategoryScores() {
    testCategories.forEach(cat => {
      const scoreBadge = document.getElementById(cat.scoreId);
      if (!scoreBadge) return;

      const total = cat.testIds.length;
      let passedCount = 0;
      let failedCount = 0;
      let executedCount = 0;

      cat.testIds.forEach(id => {
        if (testResults[id] === true) {
          passedCount++;
          executedCount++;
        } else if (testResults[id] === false) {
          failedCount++;
          executedCount++;
        }
      });

      if (executedCount === 0) {
        scoreBadge.textContent = '—';
        scoreBadge.className = 'category-score';
      } else {
        scoreBadge.textContent = `${passedCount}/${total}`;
        if (failedCount > 0) {
          scoreBadge.className = 'category-score failed';
        } else if (passedCount === total) {
          scoreBadge.className = 'category-score passed';
        } else {
          scoreBadge.className = 'category-score running';
        }
      }
    });
  }

  function setTestStatus(testNum, status, isPass) {
    const badge = document.getElementById(`status-${testNum}`);
    if (badge) {
      badge.textContent = status;
      if (isPass === true) {
        badge.className = 'test-tag passed';
      } else if (isPass === false) {
        badge.className = 'test-tag failed';
      } else if (status === 'RUNNING') {
        badge.className = 'test-tag running';
      } else {
        badge.className = 'test-tag';
      }
    }
    testResults[testNum] = isPass;
    updateCategoryScores();
  }

  // Toggle Collapse/Expand All
  const btnToggleAll = document.getElementById('btn-toggle-all');
  if (btnToggleAll) {
    function syncToggleBtnText() {
      const allCategories = document.querySelectorAll('.test-category');
      const anyOpen = Array.from(allCategories).some(cat => cat.open);
      btnToggleAll.textContent = anyOpen ? 'Collapse All' : 'Expand All';
    }

    btnToggleAll.addEventListener('click', () => {
      const allCategories = document.querySelectorAll('.test-category');
      const anyOpen = Array.from(allCategories).some(cat => cat.open);
      allCategories.forEach(cat => {
        cat.open = !anyOpen;
      });
      syncToggleBtnText();
    });

    document.querySelectorAll('.test-category').forEach(cat => {
      cat.addEventListener('toggle', syncToggleBtnText);
    });
  }

  // --- Individual Test & Suite Runner ---

  let isTestRunning = false;

  async function getTestFixture(requirement) {
    const ts = Date.now();
    const testUser = `test_runner_${ts}`;
    const testEmail = `test_${ts}@chatlas.local`;
    const testPassword = `Pass#${ts}!`;
    let registeredUserId = null;
    let availableRegion = 'United States';

    if (requirement === 'none') {
      return { timestamp: ts, testUser, testEmail, testPassword, registeredUserId, availableRegion };
    }

    try {
      const { data: regions } = await supabaseClient.rpc('get_home_regions');
      if (Array.isArray(regions) && regions.length > 0) availableRegion = regions[0];
    } catch (_) {}

    const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: { data: { display_name: testUser } }
    });
    if (signUpErr) throw signUpErr;
    if (!signUpData.user?.id) throw new Error('No user ID returned from signUp fixture');
    registeredUserId = signUpData.user.id;

    if (requirement === 'full_user') {
      const { error: profileErr } = await supabaseClient.from('UserData').insert({
        id: registeredUserId,
        user_auth_id: registeredUserId,
        user_name: testUser,
        home_region: availableRegion
      });
      if (profileErr) throw profileErr;
    }

    return { timestamp: ts, testUser, testEmail, testPassword, registeredUserId, availableRegion };
  }

  async function executeSingleTest(testNum, ctx = null) {
    if (!supabaseClient) throw new Error('Supabase client not initialized');

    setTestStatus(testNum, 'RUNNING', null);

    const singleBtn = document.querySelector(`.btn-run-single[data-test="${testNum}"]`);
    if (singleBtn) {
      singleBtn.disabled = true;
      singleBtn.textContent = '...';
    }

    try {
      switch (testNum) {
        case 1: {
          const { data, error } = await supabaseClient.rpc('get_home_regions');
          if (error) throw error;
          if (!Array.isArray(data) || data.length === 0) throw new Error('Regions array is empty');
          if (ctx) ctx.availableRegion = data[0];
          setTestStatus(1, 'PASSED', true);
          log('Test 1 Passed', `Loaded ${data.length} regions. Sample: ${data[0]}`);
          break;
        }

        case 2: {
          const testUser = ctx?.testUser || `test_avail_${Date.now()}`;
          const { data: taken, error } = await supabaseClient.rpc('is_display_name_taken', { check_name: testUser });
          if (error) throw error;
          if (taken !== false) throw new Error(`Expected brand new user "${testUser}" to not be taken`);
          setTestStatus(2, 'PASSED', true);
          log('Test 2 Passed', `Verified username "${testUser}" is available`);
          break;
        }

        case 3: {
          const ts = Date.now();
          const { error } = await supabaseClient.auth.signUp({
            email: `short_pw_${ts}@chatlas.local`,
            password: '123'
          });
          if (!error) throw new Error('Expected Supabase to reject password under 6 characters');
          setTestStatus(3, 'PASSED', true);
          log('Test 3 Passed', `Rejected short password (< 6 chars) as expected: ${error.message}`);
          break;
        }

        case 4: {
          const ts = Date.now();
          const testUser = ctx?.testUser || `test_runner_${ts}`;
          const testEmail = ctx?.testEmail || `test_${ts}@chatlas.local`;
          const testPassword = ctx?.testPassword || `Pass#${ts}!`;
          const { data, error } = await supabaseClient.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: { data: { display_name: testUser } }
          });
          if (error) throw error;
          if (!data.user?.id) throw new Error('No user ID returned from signUp');
          if (ctx) ctx.registeredUserId = data.user.id;
          setTestStatus(4, 'PASSED', true);
          log('Test 4 Passed', `Registered user ID: ${data.user.id}`);
          break;
        }

        case 5: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('auth_user');
          } else if (!fixture.registeredUserId) {
            throw new Error('Skipping: Test 4 failed');
          }
          const { error: insertErr } = await supabaseClient.from('UserData').insert({
            id: fixture.registeredUserId,
            user_auth_id: fixture.registeredUserId,
            user_name: fixture.testUser,
            home_region: fixture.availableRegion || 'United States'
          });
          if (insertErr) throw insertErr;
          setTestStatus(5, 'PASSED', true);
          log('Test 5 Passed', `UserData profile linked for ID: ${fixture.registeredUserId}`);
          break;
        }

        case 6: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('auth_user');
          }
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (error) throw error;
          if (!data.session?.access_token) throw new Error('No JWT access token received');
          setTestStatus(6, 'PASSED', true);
          log('Test 6 Passed', 'Valid login via email succeeded with active JWT session');
          break;
        }

        case 7: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('full_user');
          }
          const { data: resolvedEmail, error: rpcErr } = await supabaseClient.rpc('get_email_for_username', {
            check_username: fixture.testUser
          });
          if (rpcErr) throw rpcErr;
          if (!resolvedEmail || resolvedEmail.toLowerCase() !== fixture.testEmail.toLowerCase()) {
            throw new Error(`get_email_for_username returned unexpected email: ${resolvedEmail}`);
          }
          const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: resolvedEmail,
            password: fixture.testPassword
          });
          if (signInErr) throw signInErr;
          if (!signInData.session?.access_token) throw new Error('No JWT access token received on username login');
          setTestStatus(7, 'PASSED', true);
          log('Test 7 Passed', `Resolved username "${fixture.testUser}" to "${resolvedEmail}" and signed in successfully`);
          break;
        }

        case 8: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('auth_user');
          }
          const { error } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: 'DefinitelyWrongPassword123!'
          });
          if (!error) throw new Error('Expected login with wrong password to fail');
          setTestStatus(8, 'PASSED', true);
          log('Test 8 Passed', `Rejected wrong password as expected: ${error.message}`);
          break;
        }

        case 9: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('full_user');
          } else if (!fixture.registeredUserId) {
            throw new Error('Skipping: Test 4 failed');
          }
          const ts = Date.now();
          let localWpId = null;
          let localMsgId = null;
          try {
            const { data: waypoint, error: wpErr } = await supabaseClient.from('Waypoints').insert({
              host_user: fixture.registeredUserId,
              longitude: -86.913,
              latitude: 40.424
            }).select().single();
            if (wpErr) throw wpErr;
            localWpId = waypoint.id;
            if (ctx) ctx.testWaypointId = localWpId;

            const { data: message, error: msgErr } = await supabaseClient.from('Messages').insert({
              sender_user_id: fixture.registeredUserId,
              waypoint_id: localWpId,
              message_contents: `Automated verification message ${ts}`
            }).select().single();
            if (msgErr) throw msgErr;
            localMsgId = message.id;

            try { await supabaseClient.from('Messages').delete().eq('id', localMsgId); } catch (_) {}
            if (!ctx) {
              try { await supabaseClient.from('Waypoints').delete().eq('id', localWpId); } catch (_) {}
            }
            setTestStatus(9, 'PASSED', true);
            log('Test 9 Passed', `Created Waypoint #${localWpId} and saved Message #${localMsgId}`);
          } catch (err) {
            if (localMsgId) {
              try { await supabaseClient.from('Messages').delete().eq('id', localMsgId); } catch (_) {}
            }
            if (!ctx && localWpId) {
              try { await supabaseClient.from('Waypoints').delete().eq('id', localWpId); } catch (_) {}
            }
            throw err;
          }
          break;
        }

        case 10: {
          let fixture = ctx;
          if (!fixture) {
            fixture = await getTestFixture('full_user');
          } else if (!fixture.registeredUserId) {
            throw new Error('Skipping: Test 4 failed');
          }
          try {
            const { error: fkErr } = await supabaseClient.from('Messages').insert({
              sender_user_id: fixture.registeredUserId,
              waypoint_id: 999999999,
              message_contents: 'This must fail FK constraint'
            }).select();
            if (!fkErr) throw new Error('Expected foreign key error when inserting invalid waypoint_id');
            setTestStatus(10, 'PASSED', true);
            log('Test 10 Passed', `Foreign key constraint verified (invalid waypoint ID rejected: ${fkErr.code})`);
          } finally {
            if (ctx && ctx.testWaypointId) {
              try { await supabaseClient.from('Waypoints').delete().eq('id', ctx.testWaypointId); } catch (_) {}
              ctx.testWaypointId = null;
            }
          }
          break;
        }

        // --- Section 5: Backend Messages API & Malformed Requests (POST /api/messages) ---

        // Test 11: Reject Unauthenticated Request
        case 11: {
          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waypoint_id: 1, message_contents: 'Test' })
          });
          const data = await res.json();
          if (res.status !== 401) {
            throw new Error(`Expected 401 Unauthorized, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(11, 'PASSED', true);
          log('Test 11 Passed', `Backend rejected unauthenticated request with 401: "${data.error}"`);
          break;
        }

        // Test 12: Reject Missing waypoint_id
        case 12: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ message_contents: 'Missing waypoint ID' })
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(12, 'PASSED', true);
          log('Test 12 Passed', `Backend rejected missing waypoint_id with 400: "${data.error}"`);
          break;
        }

        // Test 13: Reject Non-Numeric waypoint_id
        case 13: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ waypoint_id: 'not_an_id', message_contents: 'Invalid waypoint' })
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(13, 'PASSED', true);
          log('Test 13 Passed', `Backend rejected non-numeric waypoint_id with 400: "${data.error}"`);
          break;
        }

        // Test 14: Reject Missing message_contents
        case 14: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ waypoint_id: 1 })
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(14, 'PASSED', true);
          log('Test 14 Passed', `Backend rejected missing message_contents with 400: "${data.error}"`);
          break;
        }

        // Test 15: Reject Empty / Whitespace-Only Message
        case 15: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ waypoint_id: 1, message_contents: '     ' })
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(15, 'PASSED', true);
          log('Test 15 Passed', `Backend rejected whitespace-only message with 400: "${data.error}"`);
          break;
        }

        // Test 16: Reject Excessively Long Message
        case 16: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const longMessage = 'A'.repeat(2001);
          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ waypoint_id: 1, message_contents: longMessage })
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(16, 'PASSED', true);
          log('Test 16 Passed', `Backend rejected message > 2000 chars with 400: "${data.error}"`);
          break;
        }

        // Test 17: Reject Non-Existent Waypoint ID
        case 17: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ waypoint_id: 999999999, message_contents: 'Valid message content' })
          });
          const data = await res.json();
          if (res.status !== 404) {
            throw new Error(`Expected 404 Not Found, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(17, 'PASSED', true);
          log('Test 17 Passed', `Backend rejected non-existent waypoint with 404: "${data.error}"`);
          break;
        }

        // Test 18: Accept Valid Request & Persist Message
        case 18: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          // Create temporary waypoint
          const { data: wp, error: wpErr } = await supabaseClient.from('Waypoints').insert({
            host_user: fixture.registeredUserId,
            longitude: -86.913,
            latitude: 40.424
          }).select().single();
          if (wpErr) throw wpErr;

          let createdMsgId = null;
          try {
            const res = await fetch('http://localhost:3000/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                waypoint_id: wp.id,
                message_contents: 'Automated valid backend message test'
              })
            });
            const data = await res.json();
            if (res.status !== 201 || !data.success || !data.data?.id) {
              throw new Error(`Expected 201 Created with saved message ID, got HTTP ${res.status}: ${JSON.stringify(data)}`);
            }
            createdMsgId = data.data.id;

            // Verify in PostgreSQL Messages table
            const { data: fetched, error: fetchErr } = await supabaseClient.from('Messages').select('*').eq('id', createdMsgId).single();
            if (fetchErr || !fetched) throw new Error('Message was not found in PostgreSQL Messages table');

            setTestStatus(18, 'PASSED', true);
            log('Test 18 Passed', `Valid message processed (HTTP 201 Created). Stored as Message #${createdMsgId}`);
          } finally {
            if (createdMsgId) {
              try { await supabaseClient.from('Messages').delete().eq('id', createdMsgId); } catch (_) {}
            }
            try { await supabaseClient.from('Waypoints').delete().eq('id', wp.id); } catch (_) {}
          }
          break;
        }

        // --- Section 6: Account Lifecycle & Security ---

        // Test 19: Modify Profile & Region
        case 19: {
          let fixture = ctx || await getTestFixture('full_user');
          const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (signInErr) throw signInErr;

          const updatedName = `${fixture.testUser}_mod`;
          const { error: updateErr } = await supabaseClient.rpc('update_username', { new_name: updatedName });
          if (updateErr) throw updateErr;

          const region = fixture.availableRegion || 'United States';
          const { error: regionErr } = await supabaseClient.rpc('update_region', { new_region: region });
          if (regionErr) throw regionErr;

          setTestStatus(19, 'PASSED', true);
          log('Test 19 Passed', `Updated username to "${updatedName}" and confirmed region "${region}"`);
          break;
        }

        // Test 20: Request Deletion & Block
        case 20: {
          let fixture = ctx || await getTestFixture('full_user');
          const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (signInErr) throw signInErr;

          const { error: delErr } = await supabaseClient.rpc('request_account_deletion');
          if (delErr) throw delErr;

          const { data: statusData, error: statusErr } = await supabaseClient.rpc('get_email_status', {
            check_email: fixture.testEmail
          }).maybeSingle();
          if (statusErr) throw statusErr;
          if (!statusData?.disabled) throw new Error('Expected email status to have disabled=true after deletion request');

          await supabaseClient.auth.signOut();
          setTestStatus(20, 'PASSED', true);
          log('Test 20 Passed', 'Account deletion requested and disabled status verified in backend');
          break;
        }

        // --- Section 6: Backend Message Viewing API & Malformed Requests (GET /api/messages) ---

        // Test 21: Reject Unauthenticated Viewing Request
        case 21: {
          const res = await fetch('http://localhost:3000/api/messages?waypoint_id=1', {
            method: 'GET'
          });
          const data = await res.json();
          if (res.status !== 401) {
            throw new Error(`Expected 401 Unauthorized, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(21, 'PASSED', true);
          log('Test 21 Passed', `Backend rejected unauthenticated viewing request with 401: "${data.error}"`);
          break;
        }

        // Test 22: Reject Missing waypoint_id Parameter
        case 22: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(22, 'PASSED', true);
          log('Test 22 Passed', `Backend rejected missing waypoint_id parameter with 400: "${data.error}"`);
          break;
        }

        // Test 23: Reject Non-Numeric waypoint_id Parameter
        case 23: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages?waypoint_id=not_an_id', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.status !== 400) {
            throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(23, 'PASSED', true);
          log('Test 23 Passed', `Backend rejected non-numeric waypoint_id with 400: "${data.error}"`);
          break;
        }

        // Test 24: Reject Non-Existent Waypoint ID
        case 24: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          const res = await fetch('http://localhost:3000/api/messages?waypoint_id=999999999', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.status !== 404) {
            throw new Error(`Expected 404 Not Found, got HTTP ${res.status}: ${JSON.stringify(data)}`);
          }
          setTestStatus(24, 'PASSED', true);
          log('Test 24 Passed', `Backend rejected non-existent waypoint with 404: "${data.error}"`);
          break;
        }

        // Test 25: Accept Valid Request & Return Chronological Messages
        case 25: {
          let fixture = ctx || await getTestFixture('full_user');
          const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
            email: fixture.testEmail,
            password: fixture.testPassword
          });
          if (authErr) throw authErr;
          const token = authData.session.access_token;

          // Create temporary waypoint
          const { data: wp, error: wpErr } = await supabaseClient.from('Waypoints').insert({
            host_user: fixture.registeredUserId,
            longitude: -86.913,
            latitude: 40.424
          }).select().single();
          if (wpErr) throw wpErr;

          let msg1Id = null;
          let msg2Id = null;
          try {
            const now = Date.now();
            const { data: m1, error: m1Err } = await supabaseClient.from('Messages').insert({
              sender_user_id: fixture.registeredUserId,
              waypoint_id: wp.id,
              message_contents: 'Chronological test message 1',
              timestamp: new Date(now - 10000).toISOString()
            }).select().single();
            if (m1Err) throw m1Err;
            msg1Id = m1.id;

            const { data: m2, error: m2Err } = await supabaseClient.from('Messages').insert({
              sender_user_id: fixture.registeredUserId,
              waypoint_id: wp.id,
              message_contents: 'Chronological test message 2',
              timestamp: new Date(now).toISOString()
            }).select().single();
            if (m2Err) throw m2Err;
            msg2Id = m2.id;

            const res = await fetch(`http://localhost:3000/api/messages?waypoint_id=${wp.id}`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.status !== 200 || !data.success || !Array.isArray(data.data)) {
              throw new Error(`Expected 200 OK with messages array, got HTTP ${res.status}: ${JSON.stringify(data)}`);
            }
            if (data.data.length < 2) {
              throw new Error(`Expected at least 2 messages returned, got ${data.data.length}`);
            }

            // Verify chronological order
            const returnedIds = data.data.map(m => m.id);
            const idx1 = returnedIds.indexOf(msg1Id);
            const idx2 = returnedIds.indexOf(msg2Id);
            if (idx1 === -1 || idx2 === -1 || idx1 > idx2) {
              throw new Error('Messages were not returned in chronological order');
            }

            setTestStatus(25, 'PASSED', true);
            log('Test 25 Passed', `Successfully retrieved ${data.data.length} messages for Waypoint #${wp.id} in chronological order`);
          } finally {
            if (msg1Id) {
              try { await supabaseClient.from('Messages').delete().eq('id', msg1Id); } catch (_) {}
            }
            if (msg2Id) {
              try { await supabaseClient.from('Messages').delete().eq('id', msg2Id); } catch (_) {}
            }
            try { await supabaseClient.from('Waypoints').delete().eq('id', wp.id); } catch (_) {}
          }
          break;
        }

        default:
          throw new Error(`Unknown test number: ${testNum}`);
      }
    } catch (e) {
      setTestStatus(testNum, 'FAILED', false);
      log(`Test ${testNum} Failed`, e.message, true);
    } finally {
      if (singleBtn) {
        singleBtn.disabled = false;
        singleBtn.textContent = 'Run';
      }
    }
  }

  // Wire individual test buttons
  document.querySelectorAll('.btn-run-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isTestRunning) {
        return log('Suite Busy', 'A test is currently running. Please wait.');
      }
      const testNum = parseInt(btn.getAttribute('data-test'), 10);
      if (isNaN(testNum)) return;
      isTestRunning = true;
      try {
        log(`Test ${testNum}`, `Executing test ${testNum} individually...`);
        await executeSingleTest(testNum);
      } finally {
        isTestRunning = false;
      }
    });
  });

  // Wire "Run All Tests" button
  const btnRunTests = document.getElementById('btn-run-all-tests');
  if (btnRunTests) {
    btnRunTests.addEventListener('click', async () => {
      if (isTestRunning) {
        return log('Suite Busy', 'A test is currently running. Please wait.');
      }
      if (!supabaseClient) return log('Error', 'Client not initialized', true);
      isTestRunning = true;
      btnRunTests.disabled = true;
      btnRunTests.textContent = 'Running...';
      const allSingleBtns = document.querySelectorAll('.btn-run-single');
      allSingleBtns.forEach(b => b.disabled = true);

      log('Automated Auth & Database Suite', 'Starting 25 verification tests...');
      try { await supabaseClient.auth.signOut(); } catch (_) {}
      const timestamp = Date.now();
      const suiteCtx = {
        timestamp,
        testUser: `test_runner_${timestamp}`,
        testEmail: `test_${timestamp}@chatlas.local`,
        testPassword: `Pass#${timestamp}!`,
        registeredUserId: null,
        availableRegion: 'United States',
        testWaypointId: null
      };

      for (let i = 1; i <= 25; i++) {
        testResults[i] = null;
        setTestStatus(i, 'WAITING', null);
      }
      updateCategoryScores();

      try {
        for (let i = 1; i <= 25; i++) {
          await executeSingleTest(i, suiteCtx);
        }
        log('Completed Suite', 'All 25 tests finished execution.');
      } finally {
        isTestRunning = false;
        btnRunTests.disabled = false;
        btnRunTests.textContent = 'Run All Tests';
        allSingleBtns.forEach(b => b.disabled = false);
      }
    });
  }

  // Ensure init runs regardless of when the script is evaluated
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
