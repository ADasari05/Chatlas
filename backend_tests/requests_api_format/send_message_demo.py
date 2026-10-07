import requests
import response_utils

from response_utils import *


def main():
    # need to authenticate first
    
    print("Message Demo: Following will demo Acceptance Criteria 2, 3, of User Story #49:");
    
    email = 'test@lorem.ipsum'
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
    # TODO: get some valid chat connection; for now, don't care if we're actually "connected" to this chat or not.
    json_data = {
        'text_contents' : 'some text here',
        'chat_connection_id' : 2
    }
    response = call_sql_function("send_message", access_token, json_data)
    print("\nSending Valid Message: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response));
    
    
    json_data = {
        'text_contents' : 'some text here',
        'chat_connection_id' : 'bad'
    }
    response = call_sql_function("send_message", access_token, json_data)
    print("\nSending Malformed Message: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response.json()));
    
main();