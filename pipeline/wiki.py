import logging
import time

import requests

API_URL = 'https://en.wikipedia.org/w/api.php'
HTML_URL = 'https://en.wikipedia.org/w/rest.php/v1/revision/{}/html'

HEADERS = {'User-Agent': 'ChatlasPipeline/0.1 (https://github.com/ADasari05/Chatlas)'}

DELAY = 1
RETRIES = 3

log = logging.getLogger(__name__)


class LocationError(Exception):
    pass


def get(url, params=None):
    for attempt in range(1, RETRIES + 1):
        time.sleep(DELAY)
        try:
            response = requests.get(url, params=params, headers=HEADERS, timeout=30)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            if attempt == RETRIES:
                raise
            log.warning('request failed (%s), retrying (%d/%d)', e, attempt, RETRIES)
            time.sleep(attempt * 5)


def resolve(name):
    """Finds the Wikipedia article for a place name, following redirects (like "USA")."""
    params = {
        'action': 'query',
        'format': 'json',
        'formatversion': 2,
        'titles': name,
        'redirects': 1,
        'prop': 'info|pageprops',
        'inprop': 'url',
    }
    page = get(API_URL, params).json()['query']['pages'][0]

    if 'missing' in page or 'invalid' in page:
        raise LocationError(f'no Wikipedia article titled "{name}"')
    if 'disambiguation' in page.get('pageprops', {}):
        raise LocationError(f'"{name}" is a disambiguation page, try being more specific '
                            f'(like "Springfield, Illinois" instead of "Springfield")')

    return {'title': page['title'], 'revision_id': page['lastrevid'], 'url': page['canonicalurl']}


def fetch_html(revision_id):
    return get(HTML_URL.format(revision_id)).text
