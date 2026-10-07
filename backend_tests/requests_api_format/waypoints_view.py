import requests
import response_utils

from response_utils import get_auth_response
from response_utils import get_response



def main():
    # need to authenticate first
    
    email = 'test@lorem.ipsum'
    password = 'notapassword'

    print("Logging in user: " + email + ", password: " + password);
    
    
    response = get_auth_response(email, password)
    
    access_token = ''

    if response.status_code == 200:
        
        print("Successful login.")
        #print("Access Token: " + response.json()["access_token"])
        access_token = response.json()["access_token"]
    else:
        print("Invalid login: " + str(response.json()))
        return
    
    
    # assuming that we've logged in now; perform proper queries using access token
    response = get_response('Waypoints?select=*', access_token)
    print("Valid Waypoint View Test: \n" + str(response.json()));
    
    # test just pulling coords via SQL
    response = get_response('Waypoints?select=longitude,latitude', access_token)
    print("\nValid (SQL, get coordinates) Waypoint View Test: \n" + str(response.json()));
    
    # test with bad SQL
    response = get_response('Waypoints?select=invalid', access_token)
    print("\nInvalid (bad SQL) Waypoint View Test: \n" + str(response.json()));

    # now test without access token:
    response = get_response('Waypoints?select=*', None)
    print("\nInvalid (no access token) Waypoint View Test: \n" + str(response.json()));
    
    

main()