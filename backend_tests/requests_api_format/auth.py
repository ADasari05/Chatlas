import requests
import response_utils

from response_utils import *

def test_login(email, password):
    print("Testing authentication: user: " + email + ", password: " + password);
    response = get_auth_response(email, password)

    if response.status_code == 200:
        
        print("Successful login")
        access_token = response.json()["access_token"]
        print("Access Token: " + access_token)
        return access_token
    else:
        print("Invalid login: " + str(response.json()))
        return None
        

def main():
    register_email = 'test@lorem.ipsum'
    register_pass = 'notapassword'
    
    print("Login Demo: Following will demo Acceptance Criteria 2-3 of User Story #45:");
    
    print("\nLogging in with valid credentials:\n");
    access_token = test_login(register_email, register_pass)
    
    # above should work; take access token now to show user data worked
    userdata = get_userdata(access_token)
    print("UserData table (limited): " + str(userdata.json()))
    
    print("\nLogging in with invalid credentials:\n");
    access_token = test_login(register_email, '123456')
    
    # above should work; take access token now to show user data worked (aka nothing lol)
    userdata = get_userdata(access_token)
    print("UserData table (restricted): " + str(userdata.json()))


main();