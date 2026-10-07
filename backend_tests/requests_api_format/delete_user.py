import requests
import response_utils

from response_utils import *


def main():
    # need to authenticate first
    
    # NOTE: will need to make sure that the associated UserData is "valid" for the demo and "invalid" after the demo!
    
    email = 'test90@lorem.ipsum'
    password = 'notapassword'

    print("Logging in user: " + email + ", password: " + password);
    
    
    response = get_auth_response(email, password)
    
    access_token = ''
    #auth_uuid = ''

    if response.status_code == 200:
        
        print("Successful login.")
        access_token = response.json()["access_token"]
    else:
        print("Invalid login: " + str(response.json()))
        return

    # try to call this specific function
    json_data = {
        # no params; this is kinda useless lol
    }
    response = call_sql_function("delete_user", access_token, json_data)
    print("Deleting User Test: \nInput:" + str(json_data) + "\nOutput:\n"+ str(response));
    
main();