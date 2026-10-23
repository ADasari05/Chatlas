import logging
import time
from functools import cache

import requests

API_URL = 'https://en.wikipedia.org/w/api.php'
HTML_URL = 'https://en.wikipedia.org/w/rest.php/v1/revision/{}/html'
WIKIDATA_URL = 'https://www.wikidata.org/w/api.php'

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
        'ppprop': 'disambiguation|wikibase_item',
    }
    page = get(API_URL, params).json()['query']['pages'][0]

    if 'missing' in page or 'invalid' in page:
        raise LocationError(f'no Wikipedia article titled "{name}"')
    if 'disambiguation' in page.get('pageprops', {}):
        raise LocationError(f'"{name}" is a disambiguation page, try being more specific '
                            f'(like "Springfield, Illinois" instead of "Springfield")')

    return {
        'title': page['title'],
        'revision_id': page['lastrevid'],
        'url': page['canonicalurl'],
        'wikidata_id': page.get('pageprops', {}).get('wikibase_item'),
    }


def fetch_html(revision_id):
    return get(HTML_URL.format(revision_id)).text


# Wikidata stores facts as "claims" under property ids:
# P17 = the country something is in, P297 = a country's ISO code (like "MX")
@cache
def get_claims(wikidata_id):
    params = {'action': 'wbgetentities', 'format': 'json', 'ids': wikidata_id, 'props': 'claims'}
    return get(WIKIDATA_URL, params).json()['entities'][wikidata_id]['claims']


def claim_values(claims, prop):
    return [c['mainsnak']['datavalue']['value'] for c in claims.get(prop, []) if 'datavalue' in c['mainsnak']]


def get_country_codes(wikidata_id):
    """ISO codes of the country a place is in, like {'ES'} for Valladolid.

    Disputed places can be in more than one (Jerusalem gives IL, PS, and JO).
    """
    claims = get_claims(wikidata_id)
    if 'P297' in claims:  # it's a country itself
        return set(claim_values(claims, 'P297'))

    codes = set()
    for country in claim_values(claims, 'P17'):
        codes.update(claim_values(get_claims(country['id']), 'P297'))
    return codes


@cache
def get_country_code(name):
    """Turns a country name into its ISO code, like "Mexico" -> "MX"."""
    article = resolve(name)
    codes = claim_values(get_claims(article['wikidata_id']), 'P297') if article['wikidata_id'] else []
    if not codes:
        raise LocationError(f'"{name}" is not a country')
    return codes[0]
