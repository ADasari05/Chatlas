import json

import pytest
import requests

import scrape
import wiki

HTML = """<html><body>
<section data-mw-section-id="0"><p>Intro.</p></section>
<section data-mw-section-id="1"><h2 id="History">History</h2><p>Old.</p></section>
</body></html>"""


def claim(value):
    return [{'mainsnak': {'datavalue': {'value': value}}}]


# a tiny fake Wikipedia: article title -> Wikidata id
PAGES = {
    'France': 'Q142',
    'Japan': 'Q17',
    'Mexico': 'Q96',
    'Spain': 'Q29',
    'Illinois': 'Q1204',
    'Valladolid': 'Q8717',
    'Valladolid, Yucatán': 'Q2468',
}

# and a tiny fake Wikidata: P297 = country code, P17 = which country it's in
CLAIMS = {
    'Q142': {'P297': claim('FR')},
    'Q17': {'P297': claim('JP')},
    'Q96': {'P297': claim('MX')},
    'Q29': {'P297': claim('ES')},
    'Q30': {'P297': claim('US')},
    'Q1204': {'P17': claim({'id': 'Q30'})},
    'Q8717': {'P17': claim({'id': 'Q29'})},
    'Q2468': {'P17': claim({'id': 'Q96'})},
}


class FakeResponse:
    def __init__(self, status_code=200, data=None, text=''):
        self.status_code = status_code
        self.data = data
        self.text = text

    def json(self):
        return self.data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f'HTTP {self.status_code}')


def fake_get(url, params=None, **kwargs):
    if url.endswith('/html'):
        return FakeResponse(text=HTML)

    if url == wiki.WIKIDATA_URL:
        wikidata_id = params['ids']
        return FakeResponse(data={'entities': {wikidata_id: {'claims': CLAIMS[wikidata_id]}}})

    name = params['titles']
    if name == 'Notacountry':
        page = {'title': name, 'missing': True}
    elif name == 'Springfield':
        page = {'title': name, 'lastrevid': 1, 'canonicalurl': '', 'pageprops': {'disambiguation': ''}}
    else:
        page = {'title': name, 'lastrevid': 123, 'canonicalurl': f'https://en.wikipedia.org/wiki/{name}',
                'pageprops': {'wikibase_item': PAGES[name]}}
    return FakeResponse(data={'query': {'pages': [page]}})


@pytest.fixture(autouse=True)
def no_network(monkeypatch, tmp_path):
    monkeypatch.setattr(wiki.requests, 'get', fake_get)
    monkeypatch.setattr(wiki.time, 'sleep', lambda seconds: None)
    monkeypatch.setattr(scrape, 'OUTPUT_DIR', tmp_path)
    # the lookups are cached, so start every test fresh
    wiki.get_claims.cache_clear()
    wiki.get_country_code.cache_clear()


def test_resolve():
    article = wiki.resolve('France')
    assert article['title'] == 'France'
    assert article['revision_id'] == 123
    assert article['wikidata_id'] == 'Q142'


def test_resolve_missing():
    with pytest.raises(wiki.LocationError, match='no Wikipedia article'):
        wiki.resolve('Notacountry')


def test_resolve_disambiguation():
    with pytest.raises(wiki.LocationError, match='disambiguation'):
        wiki.resolve('Springfield')


def test_retries_then_succeeds(monkeypatch):
    responses = [FakeResponse(503), FakeResponse(429), FakeResponse(text='ok')]
    monkeypatch.setattr(wiki.requests, 'get', lambda *args, **kwargs: responses.pop(0))
    assert wiki.get('https://example.com').text == 'ok'


def test_gives_up_after_retries(monkeypatch):
    monkeypatch.setattr(wiki.requests, 'get', lambda *args, **kwargs: FakeResponse(503))
    with pytest.raises(requests.HTTPError):
        wiki.get('https://example.com')


def test_country_codes():
    assert wiki.get_country_codes('Q142') == {'FR'}  # a country
    assert wiki.get_country_codes('Q8717') == {'ES'}  # a city, through its country
    assert wiki.get_country_code('Mexico') == 'MX'


def test_country_name_must_be_a_country():
    with pytest.raises(wiki.LocationError, match='not a country'):
        wiki.get_country_code('Illinois')


def test_parse_line():
    assert scrape.parse_line('France')['country'] is None
    location = scrape.parse_line('Mexico, Valladolid, Yucatán')
    assert (location['country'], location['title']) == ('Mexico', 'Valladolid, Yucatán')


def test_right_country_passes(tmp_path):
    assert scrape.main(['Mexico, Valladolid, Yucatán']) == []
    record = json.loads((tmp_path / 'valladolid_yucatán.json').read_text(encoding='utf-8'))
    assert record['country_id'] == 'MX'


def test_wrong_country_is_rejected(tmp_path, caplog):
    # "Valladolid" on its own is the one in Spain
    assert scrape.main(['Mexico, Valladolid']) == ['Valladolid']
    assert '"Valladolid" is in ES, expected MX' in caplog.text
    assert list(tmp_path.iterdir()) == []


def test_csv_input(tmp_path):
    csv_file = tmp_path / 'places.csv'
    csv_file.write_text('location_id,type,country_id,wikipedia_title\n'
                        'ES-CL:Valladolid,city,ES,Valladolid\n'
                        'MX-YUC:Valladolid,city,MX,"Valladolid, Yucatán"\n'
                        'MX-ROO:Valladolid,city,MX,Valladolid\n', encoding='utf-8')

    assert scrape.main(['--file', str(csv_file)]) == ['MX-ROO:Valladolid']

    # same city name, but each gets its own file named after its map id
    record = json.loads((tmp_path / 'mx_yuc_valladolid.json').read_text(encoding='utf-8'))
    assert record['location_id'] == 'MX-YUC:Valladolid'
    assert record['type'] == 'city'
    assert (tmp_path / 'es_cl_valladolid.json').exists()


def test_batch_keeps_going_after_a_bad_name(tmp_path, caplog):
    failed = scrape.main(['France', 'Notacountry', 'Japan'])

    assert failed == ['Notacountry']
    assert sorted(p.name for p in tmp_path.iterdir()) == ['france.json', 'japan.json']
    assert 'Notacountry: no Wikipedia article' in caplog.text

    record = json.loads((tmp_path / 'france.json').read_text(encoding='utf-8'))
    assert record['sections']['history']['url'].endswith('#History')
