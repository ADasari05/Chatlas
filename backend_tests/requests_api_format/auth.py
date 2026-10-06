import requests
import response_utils

from response_utils import get_auth_response

def test_login(email, password):
    print("Testing authentication: user: " + email + ", password: " + password);
    response = get_auth_response(email, password)

    if response.status_code == 200:
        
        print("Successful login")
        print("Access Token: " + response.json()["access_token"])
    else:
        print("Invalid login: " + str(response.json()))
        

def main():
    register_email = 'test2@lorem.ipsum'
    register_pass = 'notapassword'
    
    print("Login Demo: Following will demo Acceptance Criteria 2-3 of User Story #45:");
    
    print("\nLogging in with valid credentials:\n");
    test_login(register_email, register_pass)
    
    print("\nLogging in with invalid credentials:\n");
    test_login(register_email, '123456')


main();