import requests

database_url = 'https://hcmllrukdtjygcpliwsy.supabase.co'
database_auth = database_url + '/auth/v1/token'
database_rest = database_url + '/rest/v1/'
api_key = 'sb_publishable_0pYEbRm9pvcbK0x2HegtTw_kdSml4jn'


# input should be in single quotes, not double quotes!
def get_auth_response(email, password):
    headers = {
        'apikey': api_key,
        'Content-Type': 'application/json',
    }

    params = {
        'grant_type': 'password',
    }

    json_data = {
        'email': email,
        'password': password,
    }

    # ex .json() output:
    # {"access_token":"(...)","token_type":"bearer","expires_in":3600,"expires_at":1791312911,"refresh_token":"(...)","user":{"id":"(...)","aud":"authenticated","role":"authenticated","email":"test@lorem.ipsum","email_confirmed_at":"(...)","phone":"","confirmed_at":"(...)","last_sign_in_at":"(...)","app_metadata":{"provider":"email","providers":["email"]},"user_metadata":{"email_verified":true},"identities":[{"identity_id":"(...)","id":"(...)","user_id":"(","identity_data":{"email":"test@lorem.ipsum","email_verified":false,"phone_verified":false,"sub":"d0e47bdd-5c9a-4d09-980c-e363af56e118"},"provider":"email","last_sign_in_at":"2026-10-06T17:38:23.560396Z","created_at":"2026-10-06T17:38:23.560481Z","updated_at":"2026-10-06T17:38:23.560481Z","email":"test@lorem.ipsum"}],"created_at":"2026-10-06T17:38:23.545866Z","updated_at":"2026-10-06T17:55:11.518282Z","is_anonymous":false},"weak_password":null}

    # r.status_code = 200, 400, 403, etc

    return requests.post(database_auth, params=params, headers=headers, json=json_data)


# get the associated userdata with this user's auth_id, access_token
# note: technically don't need to search up user's auth ID as well given that RLS already makes sure that authenticated users can only view themselves...
def get_userdata(auth_id, access_token):
    if access_token == None:
        headers = {
            'apikey': api_key
        }
    else:
        headers = {
            'apikey': api_key,
            'Authorization': 'Bearer ' + access_token,
        }

    return requests.get(database_rest + 'UserData?select=*&user_auth_id=eq.' + auth_id, headers=headers)

# same as above, but no "auth_id" needed.
def get_userdata(access_token):
    if access_token == None:
        headers = {
            'apikey': api_key
        }
    else:
        headers = {
            'apikey': api_key,
            'Authorization': 'Bearer ' + access_token,
        }

    return requests.get(database_rest + 'UserData?select=*', headers=headers)


# given an authenticated access token, acquire the associated user -- not auth! -- uuid.
# returns 'None' if an error occured.
def get_userdata_uuid(access_token):
    if access_token == None:
        headers = {
            'apikey': api_key
        }
    else:
        headers = {
            'apikey': api_key,
            'Authorization': 'Bearer ' + access_token,
        }

    response = requests.get(database_rest + 'UserData?select=*', headers=headers)
    
    if response.status_code == 200 and len(response.json()) > 0:
        
        # successfuly
        return response.json()[0]["id"]
    else:
        # print err
        print("get_userdata_uuid: Err: request failed: \n" + str(response.json()))
        return None

 
# typical "GET" response and stuff
def get_response(table_with_sql, access_token):
    
    if access_token == None:
        headers = {
            'apikey': api_key
        }
    else:
        headers = {
            'apikey': api_key,
            'Authorization': 'Bearer ' + access_token,
        }

    return requests.get(database_rest + table_with_sql, headers=headers)
    

# typical "POST" response and stuff -- TODO
def post_response(table, access_token, json_data):
    
    if access_token == None:
        headers = {
            'apikey': api_key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        }
    else:
        headers = {
            'apikey': api_key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            'Authorization': 'Bearer ' + access_token,
        }

    return requests.post(database_rest + table, headers=headers, json=json_data)
    