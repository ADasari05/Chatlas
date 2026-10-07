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

      log('Saving Message to Waypoint', { waypointId: Number(waypointId), contents });
      try {
        const { data, error } = await supabaseClient.from('Messages').insert({
          sender_user_id: currentSession?.user?.id || null,
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

  const btnFetchMessages = document.getElementById('btn-fetch-messages');
  if (btnFetchMessages) {
    btnFetchMessages.addEventListener('click', async () => {
      if (!supabaseClient) return log('Error', 'Client not initialized', true);
      const waypointId = document.getElementById('msg-waypoint-id').value.trim();
      if (!waypointId) return log('Validation Error', 'Enter Waypoint ID to fetch messages for.', true);

      log('Fetching Messages for Waypoint', { waypointId: Number(waypointId) });
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

  // --- Automated Test Suite Runner & Categorization ---

  const testCategories = [
    { id: 'cat-validation', scoreId: 'score-cat-1', testIds: [1, 2, 3] },
    { id: 'cat-registration', scoreId: 'score-cat-2', testIds: [4, 5] },
    { id: 'cat-auth', scoreId: 'score-cat-3', testIds: [6, 7, 8] },
    { id: 'cat-messages', scoreId: 'score-cat-4', testIds: [9, 10] },
    { id: 'cat-lifecycle', scoreId: 'score-cat-5', testIds: [11, 12] }
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

  const btnRunTests = document.getElementById('btn-run-all-tests');
  if (btnRunTests) {
    btnRunTests.addEventListener('click', async () => {
      if (!supabaseClient) return log('Error', 'Client not initialized', true);
      log('Automated Auth & Database Suite', 'Starting 12 verification tests...');
      const timestamp = Date.now();
      const testUser = `test_runner_${timestamp}`;
      const testEmail = `test_${timestamp}@chatlas.local`;
      const testPassword = `Pass#${timestamp}`;
      let registeredUserId = null;
      let availableRegion = 'United States';

      for (let i = 1; i <= 12; i++) {
        testResults[i] = null;
        setTestStatus(i, 'WAITING', null);
      }
      updateCategoryScores();

      // --- Test 1: get_home_regions ---
      try {
        setTestStatus(1, 'RUNNING', null);
        const { data, error } = await supabaseClient.rpc('get_home_regions');
        if (error) throw error;
        if (!Array.isArray(data) || data.length === 0) throw new Error('Regions array is empty');
        availableRegion = data[0];
        setTestStatus(1, 'PASSED', true);
        log('Test 1 Passed', `Loaded ${data.length} regions. Sample: ${availableRegion}`);
      } catch (e) {
        setTestStatus(1, 'FAILED', false);
        log('Test 1 Failed', e.message, true);
      }

      // --- Test 2: is_display_name_taken ---
      try {
        setTestStatus(2, 'RUNNING', null);
        const { data: taken, error } = await supabaseClient.rpc('is_display_name_taken', { check_name: testUser });
        if (error) throw error;
        if (taken !== false) throw new Error(`Expected brand new user "${testUser}" to not be taken`);
        setTestStatus(2, 'PASSED', true);
        log('Test 2 Passed', `Verified username "${testUser}" is available`);
      } catch (e) {
        setTestStatus(2, 'FAILED', false);
        log('Test 2 Failed', e.message, true);
      }

      // --- Test 3: Reject Short Password (< 6 chars) ---
      try {
        setTestStatus(3, 'RUNNING', null);
        const shortPassword = '123';
        const { error } = await supabaseClient.auth.signUp({
          email: `short_pw_${timestamp}@chatlas.local`,
          password: shortPassword
        });
        if (!error) {
          throw new Error('Expected Supabase to reject password under 6 characters');
        }
        setTestStatus(3, 'PASSED', true);
        log('Test 3 Passed', `Rejected short password (< 6 chars) as expected: ${error.message}`);
      } catch (e) {
        setTestStatus(3, 'FAILED', false);
        log('Test 3 Failed', e.message, true);
      }

      // --- Test 4: Register New User ---
      try {
        setTestStatus(4, 'RUNNING', null);
        const { data, error } = await supabaseClient.auth.signUp({
          email: testEmail,
          password: testPassword,
          options: { data: { display_name: testUser } }
        });
        if (error) throw error;
        if (!data.user?.id) throw new Error('No user ID returned from signUp');
        registeredUserId = data.user.id;
        setTestStatus(4, 'PASSED', true);
        log('Test 4 Passed', `Registered user ID: ${registeredUserId}`);
      } catch (e) {
        setTestStatus(4, 'FAILED', false);
        log('Test 4 Failed', e.message, true);
      }

      // --- Test 5: UserData Table Profile ---
      try {
        setTestStatus(5, 'RUNNING', null);
        if (!registeredUserId) throw new Error('Skipping: Test 4 failed');
        const { error: insertErr } = await supabaseClient.from('UserData').insert({
          id: registeredUserId,
          user_name: testUser,
          home_region: availableRegion
        });
        if (insertErr) throw insertErr;
        setTestStatus(5, 'PASSED', true);
        log('Test 5 Passed', `UserData profile linked for ID: ${registeredUserId}`);
      } catch (e) {
        setTestStatus(5, 'FAILED', false);
        log('Test 5 Failed', e.message, true);
      }

      // --- Test 6: Sign In With Email ---
      try {
        setTestStatus(6, 'RUNNING', null);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        if (error) throw error;
        if (!data.session?.access_token) throw new Error('No JWT access token received');
        setTestStatus(6, 'PASSED', true);
        log('Test 6 Passed', 'Valid login via email succeeded with active JWT session');
      } catch (e) {
        setTestStatus(6, 'FAILED', false);
        log('Test 6 Failed', e.message, true);
      }

      // --- Test 7: Sign In With Username ---
      try {
        setTestStatus(7, 'RUNNING', null);
        const { data: resolvedEmail, error: rpcErr } = await supabaseClient.rpc('get_email_for_username', {
          check_username: testUser
        });
        if (rpcErr) throw rpcErr;
        if (!resolvedEmail || resolvedEmail.toLowerCase() !== testEmail.toLowerCase()) {
          throw new Error(`get_email_for_username returned unexpected email: ${resolvedEmail}`);
        }

        const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
          email: resolvedEmail,
          password: testPassword
        });
        if (signInErr) throw signInErr;
        if (!signInData.session?.access_token) throw new Error('No JWT access token received on username login');

        setTestStatus(7, 'PASSED', true);
        log('Test 7 Passed', `Resolved username "${testUser}" to "${resolvedEmail}" and signed in successfully`);
      } catch (e) {
        setTestStatus(7, 'FAILED', false);
        log('Test 7 Failed', e.message, true);
      }

      // --- Test 8: Invalid Password Rejection ---
      try {
        setTestStatus(8, 'RUNNING', null);
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: testEmail,
          password: 'DefinitelyWrongPassword123!'
        });
        if (!error) throw new Error('Expected login with wrong password to fail');
        setTestStatus(8, 'PASSED', true);
        log('Test 8 Passed', `Rejected wrong password as expected: ${error.message}`);
      } catch (e) {
        setTestStatus(8, 'FAILED', false);
        log('Test 8 Failed', e.message, true);
      }

      // --- Test 9: Save Message to Waypoint ---
      let testWaypointId = null;
      let testMessageId = null;
      try {
        setTestStatus(9, 'RUNNING', null);
        if (!registeredUserId) throw new Error('Skipping: Test 4 failed');

        const { data: waypoint, error: wpErr } = await supabaseClient.from('Waypoints').insert({
          host_user: registeredUserId,
          longitude: -86.913,
          latitude: 40.424
        }).select().single();
        if (wpErr) throw wpErr;
        testWaypointId = waypoint.id;

        const testPayload = `Automated verification message ${timestamp}`;
        const { data: message, error: msgErr } = await supabaseClient.from('Messages').insert({
          sender_user_id: registeredUserId,
          waypoint_id: testWaypointId,
          message_contents: testPayload
        }).select().single();
        if (msgErr) throw msgErr;
        testMessageId = message.id;

        try { await supabaseClient.from('Messages').delete().eq('id', testMessageId); } catch (_) {}

        setTestStatus(9, 'PASSED', true);
        log('Test 9 Passed', `Created Waypoint #${testWaypointId} and saved Message #${testMessageId}`);
      } catch (e) {
        if (testMessageId) {
          try { await supabaseClient.from('Messages').delete().eq('id', testMessageId); } catch (_) {}
        }
        setTestStatus(9, 'FAILED', false);
        log('Test 9 Failed', e.message, true);
      }

      // --- Test 10: Enforce Waypoint Foreign Key Constraint ---
      try {
        setTestStatus(10, 'RUNNING', null);
        if (!registeredUserId) throw new Error('Skipping: Test 4 failed');

        const { error: fkErr } = await supabaseClient.from('Messages').insert({
          sender_user_id: registeredUserId,
          waypoint_id: 999999999,
          message_contents: 'This must fail FK constraint'
        }).select();
        if (!fkErr) throw new Error('Expected foreign key error when inserting invalid waypoint_id');

        if (testWaypointId) {
          try { await supabaseClient.from('Waypoints').delete().eq('id', testWaypointId); } catch (_) {}
        }

        setTestStatus(10, 'PASSED', true);
        log('Test 10 Passed', `Foreign key constraint verified (invalid waypoint ID rejected: ${fkErr.code})`);
      } catch (e) {
        if (testWaypointId) {
          try { await supabaseClient.from('Waypoints').delete().eq('id', testWaypointId); } catch (_) {}
        }
        setTestStatus(10, 'FAILED', false);
        log('Test 10 Failed', e.message, true);
      }

      // --- Test 11: Modify Profile & Region ---
      try {
        setTestStatus(11, 'RUNNING', null);
        await supabaseClient.auth.signInWithPassword({ email: testEmail, password: testPassword });
        const updatedName = `${testUser}_mod`;
        const { error: updateErr } = await supabaseClient.rpc('update_username', { new_name: updatedName });
        if (updateErr) throw updateErr;

        const { error: regionErr } = await supabaseClient.rpc('update_region', { new_region: availableRegion });
        if (regionErr) throw regionErr;

        setTestStatus(11, 'PASSED', true);
        log('Test 11 Passed', `Updated username to "${updatedName}" and confirmed region "${availableRegion}"`);
      } catch (e) {
        setTestStatus(11, 'FAILED', false);
        log('Test 11 Failed', e.message, true);
      }

      // --- Test 12: Request Deletion & Block ---
      try {
        setTestStatus(12, 'RUNNING', null);
        await supabaseClient.auth.signInWithPassword({ email: testEmail, password: testPassword });
        const { error: delErr } = await supabaseClient.rpc('request_account_deletion');
        if (delErr) throw delErr;

        const { data: statusData, error: statusErr } = await supabaseClient.rpc('get_email_status', { check_email: testEmail }).maybeSingle();
        if (statusErr) throw statusErr;
        if (!statusData?.disabled) throw new Error('Expected email status to have disabled=true after deletion request');

        await supabaseClient.auth.signOut();
        setTestStatus(12, 'PASSED', true);
        log('Test 12 Passed', 'Account deletion requested and disabled status verified in backend');
      } catch (e) {
        setTestStatus(12, 'FAILED', false);
        log('Test 12 Failed', e.message, true);
      }

      log('Completed Suite', 'All 12 tests finished execution.');
    });
  }

  // Ensure init runs regardless of when the script is evaluated
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
