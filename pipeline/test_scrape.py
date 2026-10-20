import json

import pytest
import requests

import scrape
import wiki

HTML = """<html><body>
<section data-mw-section-id="0"><p>Intro.</p></section>
<section data-mw-section-id="1"><h2 id="History">History</h2><p>Old.</p></section>
</body></html>"""


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


def fake_wikipedia(url, params=None, **kwargs):
    if url.endswith('/html'):
        return FakeResponse(text=HTML)

    name = params['titles']
    if name == 'Notacountry':
        page = {'title': name, 'missing': True}
    elif name == 'Springfield':
        page = {'title': name, 'lastrevid': 1, 'canonicalurl': '', 'pageprops': {'disambiguation': ''}}
    else:
        page = {'title': name, 'lastrevid': 123, 'canonicalurl': f'https://en.wikipedia.org/wiki/{name}'}
    return FakeResponse(data={'query': {'pages': [page]}})


@pytest.fixture(autouse=True)
def no_network(monkeypatch, tmp_path):
    monkeypatch.setattr(wiki.requests, 'get', fake_wikipedia)
    monkeypatch.setattr(wiki.time, 'sleep', lambda seconds: None)
    monkeypatch.setattr(scrape, 'OUTPUT_DIR', tmp_path)


def test_resolve():
    article = wiki.resolve('France')
    assert article['title'] == 'France'
    assert article['revision_id'] == 123


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


def test_batch_keeps_going_after_a_bad_name(tmp_path, caplog):
    failed = scrape.main(['France', 'Notacountry', 'Japan'])

    assert failed == ['Notacountry']
    assert sorted(p.name for p in tmp_path.iterdir()) == ['france.json', 'japan.json']
    assert 'Notacountry: no Wikipedia article' in caplog.text

    record = json.loads((tmp_path / 'france.json').read_text(encoding='utf-8'))
    assert record['sections']['history']['url'].endswith('#History')
