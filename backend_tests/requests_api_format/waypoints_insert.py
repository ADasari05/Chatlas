import requests
import response_utils

from response_utils import *



def main():
    # need to authenticate first
    
    email = 'test@lorem.ipsum'
    password = 'notapassword'

    print("Logging in user: " + email + ", password: " + password);
    
    
    response = get_auth_response(email, password)
    
    access_token = ''
    #auth_uuid = ''

    if response.status_code == 200:
        
        print("Successful login.")
        #print("Access Token: " + response.json()["access_token"])
        access_token = response.json()["access_token"]
        #print("Received: " + str(response.json()["user"]["id"]))
        #auth_uuid = response.json()["user"]["id"]
    else:
        print("Invalid login: " + str(response.json()))
        return
    
    # old more fine-grained method of getting user uuid
    #user_data = get_userdata(access_token) #get_userdata(auth_uuid, access_token);
    #print("User Data: " + str(user_data.json()))
    
    # user uuid is used for most user-related things; auth UUID is used only for authentication purposes.
    user_uuid = get_userdata_uuid(access_token);
    if (user_uuid == None):
        return;
    #print("User UUID: " + str(user_uuid))
    
    # assuming that we've logged in now; perform proper queries using access token
    json_data = {
        'waypoint_flags': '{"standard"}',
        'host_user': user_uuid,
        'longitude': '0.5',
        'latitude': '0.16',
    }
    response = post_response('Waypoints', access_token, json_data)
    print("Valid Waypoint Insert Test: \nInput:" + str(json_data) + "\nOutput:\n"+ str(response));
    
    
    # invalid json data
    json_data = {
        'waypoint_flags': '{"standard"}',
        'host_user': '',
        'longitude': '0.5',
        'latitude': '0.16',
    }
    response = post_response('Waypoints', access_token, json_data)
    print("\nInvalid Waypoint Insert Test (no host user provided): \nInput:" + str(json_data) + "\nOutput:\n"+ str(response));
    
    
    # invalid json data 2
    json_data = {
        'waypoint_flags': '{"does_not_exist"}',
        'host_user': user_uuid,
        'longitude': '0.5',
        'latitude': '0.16',
    }
    response = post_response('Waypoints', access_token, json_data)
    print("\nInvalid Waypoint Insert Test (malformed input data): \nInput:" + str(json_data) + "\nOutput:\n"+ str(response));
    
    
    # invalid json data 3
    json_data = {
        'waypoint_flags': '{"standard"}',
        'host_user': user_uuid,
        'longitude': '0.5',
        'latitude': 'woiw',
    }
    response = post_response('Waypoints', access_token, json_data)
    print("\nInvalid Waypoint Insert Test (malformed input data): \nInput:" + str(json_data) + "\nOutput:\n"+ str(response));
    

main()