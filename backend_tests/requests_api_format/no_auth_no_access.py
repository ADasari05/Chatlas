from response_utils import *

def main():
    register_email = 'test2@lorem.ipsum'
    register_pass = 'notapassword'
    
    print("Auth Demo: Following will demo Acceptance Criteria 1 of User Story #44, 45:");
    
    print("Checking: can we read data w/o logging in?");
    
    # try and get data from all tables w/o logging in
    response = get_userdata(None);
    print("Requesting User Data: \n" + str(response.json()));
    
    response = get_response('Waypoints?select=*', None)
    print("\nRequesting Waypoints Data: \n" + str(response.json()));
    
    response = get_response('Messages?select=*', None)
    print("\nRequesting Messages Data: \n" + str(response.json()));
    
    response = get_response('ChatConnections?select=*', None)
    print("\nRequesting ChatConnections Data: \n" + str(response.json()));


    print("\nChecking: can we insert data w/o logging in?")
    uuid_dummy = '08981eda-7b45-4608-a368-d26f6e8ff4a0'
    
    json_data = {
        'user_name' : 'UserName'
    }
    response = post_response('UserData', None, json_data)
    print("\nAdding to UserData without Authentication: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response.json()));
    
    
    json_data = {
        'waypoint_flags': '{"standard"}',
        'host_user': uuid_dummy,
        'longitude': '0.25',
        'latitude': '-1000',
    }
    response = post_response('Waypoints', None, json_data)
    print("\nAdding to Waypoints without Authentication: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response.json()));
    
    
    
    json_data = {
        'text_contents' : 'some text here',
        'chat_connection_id' : 1
    }
    response = call_sql_function("send_message", None, json_data)
    print("\nSending Message without Authentication: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response.json()));
    
    
    json_data = {
        'host_user_uuid' : uuid_dummy,
        'closed_status' : 'true'
    }
    response = post_response('ChatConnections', None, json_data)
    print("\nAdding to ChatConnections without Authentication: \nInput: " + str(json_data) + "\nOutput:\n"+ str(response.json()));

main();