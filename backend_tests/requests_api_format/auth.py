import requests
import response_utils

from response_utils import get_auth_response


response = get_auth_response('test@lorem.ipsum', 'notapassword')

if response.status_code == 200:
    
    print("Successful login")
    print("Access Token: " + response.json()["access_token"])
else:
    print("Invalid login")