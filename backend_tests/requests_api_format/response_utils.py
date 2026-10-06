import requests

database_url = 'https://hcmllrukdtjygcpliwsy.supabase.co/auth/v1/token'
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
        'email': 'test@lorem.ipsum',
        'password': 'notapassword',
    }

    # ex .json() output:
    # {"access_token":"(...)","token_type":"bearer","expires_in":3600,"expires_at":1791312911,"refresh_token":"(...)","user":{"id":"(...)","aud":"authenticated","role":"authenticated","email":"test@lorem.ipsum","email_confirmed_at":"(...)","phone":"","confirmed_at":"(...)","last_sign_in_at":"(...)","app_metadata":{"provider":"email","providers":["email"]},"user_metadata":{"email_verified":true},"identities":[{"identity_id":"(...)","id":"(...)","user_id":"(","identity_data":{"email":"test@lorem.ipsum","email_verified":false,"phone_verified":false,"sub":"d0e47bdd-5c9a-4d09-980c-e363af56e118"},"provider":"email","last_sign_in_at":"2026-10-06T17:38:23.560396Z","created_at":"2026-10-06T17:38:23.560481Z","updated_at":"2026-10-06T17:38:23.560481Z","email":"test@lorem.ipsum"}],"created_at":"2026-10-06T17:38:23.545866Z","updated_at":"2026-10-06T17:55:11.518282Z","is_anonymous":false},"weak_password":null}

    # r.status_code = 200, 400, 403, etc

    return requests.post(database_url, params=params, headers=headers, json=json_data)
