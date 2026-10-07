import requests

def test_register(register_email, register_pass):
    print("Testing registration: user: " +  register_email + ", password: " + register_pass);
    headers = {
        'apikey': 'sb_publishable_0pYEbRm9pvcbK0x2HegtTw_kdSml4jn',
        'Content-Type': 'application/json',
    }

    json_data = {
        'email': register_email,
        'password': register_pass,
    }

    response = requests.post('https://hcmllrukdtjygcpliwsy.supabase.co/auth/v1/signup', headers=headers, json=json_data)

    if response.status_code == 200:
        print("Successful registration")
        print("Output: " + str(response.json()))
        #print("Access Token: " + response.json()["access_token"])
    else:
        print("Invalid registration: " + str(response.json()))
        


def main():
    
    register_email = 'test90@lorem.ipsum'
    register_pass = 'notapassword'
    
    print("Registering a user to be deleted later");


    print("\nRegistering a valid user:\n");
    test_register(register_email, register_pass)



main()