# Chatlas Test Suite Explanations (`testing/test_explanations.md`)

This document provides a comprehensive, easily readable reference for every test implemented in the Chatlas standalone verification suite (`testing/client.js`).

> [!NOTE]
> **Maintenance Rule:** This document must be updated whenever new tests are added, modified, or reordered in the test client. Never include identifying personal information, machine paths, or user credentials in this document.

---

## Overview

The test client runs at `http://localhost:3001` (started via `npm run test:client`) and validates the entire backend pipeline:
1. **Direct Supabase Authentication & RPCs**
2. **Database Integrity & PostgreSQL Constraints (`UserData`, `Waypoints`, `Messages`)**
3. **Next.js Server API Endpoints (`/api/messages` - POST & GET)**
4. **Input Validation & Security Guards**

Tests can be executed in sequence using **"Run All Tests"** or individually using the dedicated **"Run"** buttons next to each test row.

---

## Quick Reference Summary

| # | Test Name | Category | Target / Endpoint | Expected Outcome |
|---|---|---|---|---|
| **1** | Load Home Regions | Input Validation | `rpc/get_home_regions` | Returns non-empty list of available regions |
| **2** | Check Username Availability | Input Validation | `rpc/is_display_name_taken` | Confirms unused name is available (`false`) |
| **3** | Reject Short Password (< 6 chars) | Input Validation | `auth.signUp` | Rejection error enforcing $\ge 6$ characters |
| **4** | Register New User | Registration | `auth.signUp` | Generates new Supabase user UUID |
| **5** | UserData Profile Record Linking | Registration | `public.UserData` table | Links profile row with `id`, `user_auth_id`, `user_name`, `home_region` |
| **6** | Sign In With Email | Authentication | `auth.signInWithPassword` | Returns active JWT access token |
| **7** | Sign In With Username | Authentication | `rpc/get_email_for_username` | Resolves username to email and signs in |
| **8** | Reject Invalid Credentials | Authentication | `auth.signInWithPassword` | Rejects wrong password with error |
| **9** | Save Message to Waypoint | Database Integrity | `Waypoints` & `Messages` | Inserts and reads message linked to waypoint |
| **10** | Enforce Foreign Key Constraint | Database Integrity | `public.Messages` | Rejects insert with non-existent waypoint (`23503`) |
| **11** | Reject Unauthenticated Request | Backend Sending API | `POST /api/messages` | HTTP `401 Unauthorized` |
| **12** | Reject Missing waypoint_id | Backend Sending API | `POST /api/messages` | HTTP `400 Bad Request` |
| **13** | Reject Non-Numeric waypoint_id | Backend Sending API | `POST /api/messages` | HTTP `400 Bad Request` |
| **14** | Reject Missing message_contents | Backend Sending API | `POST /api/messages` | HTTP `400 Bad Request` |
| **15** | Reject Empty / Whitespace-Only Message | Backend Sending API | `POST /api/messages` | HTTP `400 Bad Request` |
| **16** | Reject Excessively Long Message | Backend Sending API | `POST /api/messages` | HTTP `400 Bad Request` (limit: 2,000 chars) |
| **17** | Reject Non-Existent Waypoint ID | Backend Sending API | `POST /api/messages` | HTTP `404 Not Found` |
| **18** | Accept Valid Request & Persist Message | Backend Sending API | `POST /api/messages` | HTTP `201 Created` & row persisted in database |
| **19** | Modify Profile & Region | Account Lifecycle | `rpc/update_username`, `update_region` | Profile fields updated in `UserData` |
| **20** | Request Deletion & Verify Block | Account Lifecycle | `rpc/request_account_deletion` | Sets account status `disabled = true` |
| **21** | Reject Unauthenticated Viewing Request | Backend Viewing API | `GET /api/messages` | HTTP `401 Unauthorized` |
| **22** | Reject Missing waypoint_id Parameter | Backend Viewing API | `GET /api/messages` | HTTP `400 Bad Request` |
| **23** | Reject Non-Numeric waypoint_id Parameter | Backend Viewing API | `GET /api/messages` | HTTP `400 Bad Request` |
| **24** | Reject Non-Existent Waypoint ID | Backend Viewing API | `GET /api/messages` | HTTP `404 Not Found` |
| **25** | Accept Valid Request & Return Messages | Backend Viewing API | `GET /api/messages` | HTTP `200 OK` & chronological messages list |

---

## Detailed Test Explanations

### Section 1: Input Validation & Constraints

#### 1. Load Home Regions
- **Purpose:** Verifies that the server provides a configured list of geographical regions for users to select during onboarding.
- **Workflow:** Calls the PostgreSQL RPC function `get_home_regions`.
- **Assertions:** The response must be a non-empty array of valid region strings (e.g., `"United States"`). Caches an available region for subsequent user creation steps.

#### 2. Check Username Availability
- **Purpose:** Ensures the display name uniqueness check operates accurately before account creation.
- **Workflow:** Calls `is_display_name_taken` RPC with a unique, timestamped test username (`test_avail_<timestamp>`).
- **Assertions:** Must return `false`, confirming the brand new name is not marked as taken.

#### 3. Reject Short Password (< 6 chars)
- **Purpose:** Guarantees password security policy enforcement at the authentication layer.
- **Workflow:** Attempts to call `supabase.auth.signUp()` with a 3-character password (`"123"`).
- **Assertions:** Supabase Auth must reject the registration attempt with a descriptive validation error (e.g., *"Password should be at least 6 characters"*).

---

### Section 2: Registration & Profile Linking

#### 4. Register New User
- **Purpose:** Verifies end-to-end account provisioning in Supabase Auth.
- **Workflow:** Generates unique credentials (`test_runner_<ts>`, `test_<ts>@chatlas.local`, strong password) and invokes `supabase.auth.signUp()`, attaching `display_name` in user metadata.
- **Assertions:** Returns a valid user object containing an authentic Supabase UUID.

#### 5. UserData Profile Record Linking
- **Purpose:** Validates that the newly created auth user is correctly mapped to the custom application profile table (`public."UserData"`).
- **Workflow:** Inserts a row into `UserData` specifying `id`, `user_auth_id` (enforcing PostgreSQL `NOT NULL` constraint), `user_name`, and `home_region`.
- **Assertions:** Row insert succeeds without unique key collisions or constraint violations.

---

### Section 3: Authentication & Sign-In

#### 6. Sign In With Email
- **Purpose:** Tests standard email-and-password sign-in flow.
- **Workflow:** Calls `supabase.auth.signInWithPassword()` using the test user's email and password.
- **Assertions:** Authentication succeeds and returns an active session containing a valid JWT `access_token`.

#### 7. Sign In With Username
- **Purpose:** Tests custom username-based sign-in resolution.
- **Workflow:**
  1. Calls `get_email_for_username` RPC with the test username to resolve the corresponding account email.
  2. Passes the resolved email and password to `supabase.auth.signInWithPassword()`.
- **Assertions:** Username correctly resolves to the expected email, and an active JWT session is issued.

#### 8. Reject Invalid Credentials
- **Purpose:** Verifies that incorrect passwords are firmly rejected.
- **Workflow:** Attempts to log in with the test email and an incorrect password (`"DefinitelyWrongPassword123!"`).
- **Assertions:** Authentication fails with an *"Invalid login credentials"* error; no session is created.

---

### Section 4: Messages & Waypoints Database

#### 9. Save Message to Waypoint (Direct Database)
- **Purpose:** Verifies that chat messages can be directly linked to geographic waypoints in PostgreSQL.
- **Workflow:**
  1. Creates a temporary row in `public."Waypoints"` (`host_user`, `latitude`, `longitude`).
  2. Inserts a row into `public."Messages"` referencing the `waypoint_id` and `sender_user_id`.
  3. Cleans up the inserted message and waypoint rows.
- **Assertions:** Both rows insert successfully, foreign keys resolve, and records are confirmed in the database.

#### 10. Enforce Waypoint Foreign Key Constraint
- **Purpose:** Confirms that PostgreSQL database foreign keys protect chat message integrity against orphaned entries.
- **Workflow:** Deliberately attempts to insert a message into `public."Messages"` with a non-existent `waypoint_id` (`999999999`).
- **Assertions:** The database must abort the transaction and raise a foreign key constraint violation (SQL state `23503`).

---

### Section 5: Backend Messages Sending API (`POST /api/messages`)

*Validates the Next.js API route handler according to the Administrator user story for receiving, validating, and persisting chat message sending requests.*

#### 11. Reject Unauthenticated Request
- **Purpose:** Ensures the API endpoint is protected against anonymous access.
- **Workflow:** Sends `POST http://localhost:3000/api/messages` without any `Authorization` header or session cookies.
- **Assertions:** The server responds with HTTP `401 Unauthorized` and an error indicating authentication is required.

#### 12. Reject Missing `waypoint_id`
- **Purpose:** Validates that incoming payloads must include a destination waypoint identifier.
- **Workflow:** Sends an authenticated `POST` request with `{ message_contents: "Missing waypoint ID" }`.
- **Assertions:** The server responds with HTTP `400 Bad Request` and error message: `"'waypoint_id' is required"`.

#### 13. Reject Non-Numeric `waypoint_id`
- **Purpose:** Prevents invalid data types or malformed parameters from hitting database queries.
- **Workflow:** Sends an authenticated `POST` request with `{ waypoint_id: "not_an_id", message_contents: "..." }`.
- **Assertions:** The server responds with HTTP `400 Bad Request` specifying that `waypoint_id` must be a positive integer.

#### 14. Reject Missing `message_contents`
- **Purpose:** Ensures chat messages must contain text content.
- **Workflow:** Sends an authenticated `POST` request with `{ waypoint_id: 1 }` omitting the `message_contents` property.
- **Assertions:** The server responds with HTTP `400 Bad Request` stating that `'message_contents' is required`.

#### 15. Reject Empty / Whitespace-Only Message
- **Purpose:** Blocks empty or whitespace spam from being stored in the chat database.
- **Workflow:** Sends an authenticated `POST` request with `{ waypoint_id: 1, message_contents: "     " }`.
- **Assertions:** The server responds with HTTP `400 Bad Request` indicating message contents cannot be empty or whitespace only.

#### 16. Reject Excessively Long Message
- **Purpose:** Enforces server-side length limits (2,000 characters) to prevent database payload bloat.
- **Workflow:** Generates a 2,001-character string and sends it in an authenticated `POST` payload.
- **Assertions:** The server responds with HTTP `400 Bad Request` indicating the message exceeds the maximum allowed length of 2,000 characters.

#### 17. Reject Non-Existent Waypoint ID
- **Purpose:** Verifies backend database checks to ensure target waypoints actually exist before accepting messages.
- **Workflow:** Sends an authenticated `POST` payload referencing a non-existent waypoint ID (`999999999`).
- **Assertions:** The server checks `public."Waypoints"` and responds with HTTP `404 Not Found`: `"Waypoint with ID 999999999 not found."`.

#### 18. Accept Valid Request & Persist Message
- **Purpose:** Tests the complete positive path for the Chat Message Sending API.
- **Workflow:**
  1. Inserts a temporary waypoint into `public."Waypoints"`.
  2. Sends an authenticated `POST` request with valid `waypoint_id` and message text.
  3. Inspects response for HTTP `201 Created` with the inserted message record.
  4. Queries `public."Messages"` directly to confirm the row was persisted with matching `sender_user_id`, `waypoint_id`, and `message_contents`.
  5. Cleans up the test message and waypoint from the database.
- **Assertions:** HTTP `201 Created` returned, valid message ID generated, database persistence verified.

---

### Section 6: Account Lifecycle & Security

#### 19. Modify Profile & Region
- **Purpose:** Tests user profile customization RPCs.
- **Workflow:**
  1. Calls `update_username` RPC to modify display name (`<user>_mod`).
  2. Calls `update_region` RPC to update the user's home region.
  3. Queries `public."UserData"` to verify changes took effect.
- **Assertions:** Both profile updates succeed and reflect correctly in the database.

#### 20. Request Account Deletion & Verify Block
- **Purpose:** Tests GDPR/privacy compliance and account suspension workflows.
- **Workflow:**
  1. Calls `request_account_deletion` RPC to mark the account for deletion.
  2. Calls `get_email_status` RPC to check the account's active state.
- **Assertions:** The status returns `disabled = true`, confirming the user is blocked from standard access.

---

### Section 7: Backend Message Viewing API (`GET /api/messages`)

*Validates the Next.js API route handler according to the Administrator user story for receiving, validating, and returning chat message viewing requests.*

#### 21. Reject Unauthenticated Viewing Request
- **Purpose:** Ensures message histories cannot be harvested by unauthenticated callers.
- **Workflow:** Sends `GET http://localhost:3000/api/messages?waypoint_id=1` without any `Authorization` header.
- **Assertions:** The server responds with HTTP `401 Unauthorized` indicating authentication is required.

#### 22. Reject Missing `waypoint_id` Parameter
- **Purpose:** Validates that incoming viewing requests explicitly designate a waypoint room.
- **Workflow:** Sends an authenticated `GET http://localhost:3000/api/messages` omitting the `waypoint_id` query parameter.
- **Assertions:** The server responds with HTTP `400 Bad Request` stating that `waypoint_id` is required.

#### 23. Reject Non-Numeric `waypoint_id` Parameter
- **Purpose:** Prevents malformed, string, or negative waypoint identifiers from reaching the database query.
- **Workflow:** Sends an authenticated `GET http://localhost:3000/api/messages?waypoint_id=not_an_id`.
- **Assertions:** The server responds with HTTP `400 Bad Request` specifying that `waypoint_id` must be a positive integer.

#### 24. Reject Non-Existent Waypoint ID
- **Purpose:** Confirms the backend verifies the referenced waypoint exists before querying or returning messages.
- **Workflow:** Sends an authenticated `GET http://localhost:3000/api/messages?waypoint_id=999999999`.
- **Assertions:** The server checks `public."Waypoints"` and responds with HTTP `404 Not Found`: `"Waypoint with ID 999999999 not found."`.

#### 25. Accept Valid Request & Return Messages
- **Purpose:** Tests the complete positive path for retrieving waypoint chat history via the backend API.
- **Workflow:**
  1. Inserts a temporary waypoint into `public."Waypoints"`.
  2. Inserts two temporary messages with distinct timestamps into `public."Messages"`.
  3. Sends an authenticated `GET http://localhost:3000/api/messages?waypoint_id=<id>`.
  4. Verifies response status HTTP `200 OK`, `success: true`, and an array containing the messages.
  5. Confirms that returned messages are arranged in ascending chronological order.
  6. Cleans up temporary messages and waypoint from the database.
- **Assertions:** HTTP `200 OK` returned, message count matches, and chronological sequence is verified.

---

## Adding New Tests in the Future

When adding a test (e.g., Test 26):
1. **Define Test Logic in `testing/client.js`:** Add a new `case <N>:` inside `executeSingleTest()`.
2. **Add UI Element in `testing/index.html`:** Add a new `.test-row` with `<button class="btn-run-single" data-test="<N>">Run</button>` and `<span class="test-tag" id="status-<N>">idle</span>`.
3. **Update Total Count:** Ensure the suite loop in `client.js` runs through the new total.
4. **Update This File (`testing/test_explanations.md`):** Add an entry to the Quick Reference Table and a detailed section explaining its purpose, workflow, and assertions.
