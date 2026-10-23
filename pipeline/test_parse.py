import json

import pytest

import parse

URL = 'https://en.wikipedia.org/wiki/Testland'
FILLER = 'Testland has a long and well documented past full of events. ' * 4  # gets sections past MIN_WORDS

# markup copied from real Wikipedia HTML, cut down
OVERVIEW = f"""<section data-mw-section-id="0">
<div class="shortdescription">Country in Europe</div>
<table class="infobox"><tr><th class="infobox-label">Population</th><td class="infobox-data">1,234</td></tr></table>
<p><b>Testland</b> (/ˈtɛstlənd/ TEST-lənd; Testish: [tɛstlɑnd] ⓘ) is a country.<sup class="mw-ref reference"><a><span class="mw-reflink-text"><span class="cite-bracket">[</span>1<span class="cite-bracket">]</span></span></a></sup> {FILLER}</p>
<figure><img src="flag.png"><figcaption>The flag of Testland</figcaption></figure>
</section>"""

HISTORY = f"""<section data-mw-section-id="1"><h2 id="History">History</h2>
<div class="hatnote">Main article: History of Testland</div>
<p>Testland was founded in 1900.<sup class="mw-ref reference"><a><span class="mw-reflink-text">[12]</span></a></sup> {FILLER}</p>
<section data-mw-section-id="2"><h3 id="Modern_era">Modern era</h3><p>It joined the EU in 2000. {FILLER}</p></section>
<section data-mw-section-id="3"><h3 id="Rulers">Rulers</h3><table><tr><td>King Test</td></tr></table></section>
</section>"""


def section(heading, html):
    return {'heading': heading, 'url': f'{URL}#{heading}', 'html': html}


def make_raw(**changes):
    raw = {
        'location_id': 'TL',
        'type': 'country',
        'country_id': 'TL',
        'title': 'Testland',
        'wikidata_id': 'Q1',
        'revision_id': 123,
        'source_url': URL,
        'permalink': 'https://en.wikipedia.org/w/index.php?oldid=123',
        'license': 'CC BY-SA 4.0',
        'fetched_at': '2026-10-20T00:00:00+00:00',
        'sections': {
            'overview': {'heading': None, 'url': URL, 'html': OVERVIEW},
            'history': section('History', HISTORY),
            'culture': [section('Culture', f'<section><h2>Culture</h2><p>Testland loves music. {FILLER}</p></section>')],
        },
    }
    raw.update(changes)
    return raw


@pytest.fixture(autouse=True)
def temp_output(monkeypatch, tmp_path):
    monkeypatch.setattr(parse, 'PARSED_DIR', tmp_path / 'parsed')
    (tmp_path / 'parsed').mkdir()


def write_raw(tmp_path, name, raw):
    path = tmp_path / name
    path.write_text(json.dumps(raw) if isinstance(raw, dict) else raw, encoding='utf-8')
    return path


def test_record_has_every_schema_field():
    record = parse.parse(make_raw())
    assert set(record) == {'location_id', 'type', 'country_id', 'wikipedia_title', 'wikidata_id', 'revision_id',
                           'source_url', 'license', 'fetched_at', 'sections'}
    assert [s['category'] for s in record['sections']] == ['overview', 'history', 'culture']
    for s in record['sections']:
        assert set(s) == {'category', 'heading', 'text', 'summary', 'word_count', 'source_url'}


def test_removes_markup_citations_and_junk():
    overview, history, _ = parse.parse(make_raw())['sections']
    text = overview['text'] + history['text']

    assert overview['text'].startswith('Testland is a country. Testland has')
    for junk in ['<', '[1]', '[12]', 'ⓘ', 'TEST-lənd', 'Main article', 'Population', '1,234',
                 'flag of Testland', 'Country in Europe', 'King Test']:
        assert junk not in text


def test_subsections_become_headings():
    history = parse.parse(make_raw())['sections'][1]
    assert '## Modern era\n\nIt joined the EU in 2000.' in history['text']
    # "Rulers" only had a table, so its heading is dropped too
    assert 'Rulers' not in history['text']
    assert history['source_url'] == URL + '#History'


def test_several_culture_sections_are_merged():
    culture = [section('Museums', f'<section><h2>Museums</h2><p>A museum. {FILLER}</p></section>'),
               section('Landmarks', f'<section><h2>Landmarks</h2><p>A statue. {FILLER}</p></section>')]
    raw = make_raw()
    raw['sections']['culture'] = culture

    merged = parse.parse(raw)['sections'][2]
    assert merged['heading'] == 'Culture'
    assert merged['text'].startswith('## Museums\n\nA museum.')
    assert '## Landmarks\n\nA statue.' in merged['text']
    assert merged['source_url'] == URL


def test_short_sections_are_dropped(caplog):
    raw = make_raw()
    raw['sections']['culture'] = [section('Culture', '<section><h2>Culture</h2><p>Too short.</p></section>')]
    record = parse.parse(raw)
    assert [s['category'] for s in record['sections']] == ['overview', 'history']
    assert 'dropped culture section, only 2 words' in caplog.text


def test_record_without_location_id_is_rejected():
    with pytest.raises(parse.ParseError, match='missing location_id'):
        parse.parse(make_raw(location_id=None))


def test_record_with_no_usable_sections_is_rejected():
    empty = make_raw(sections={'overview': None, 'history': None, 'culture': []})
    with pytest.raises(parse.ParseError, match='no usable sections'):
        parse.parse(empty)


def test_batch_skips_broken_records_and_says_why(tmp_path, caplog):
    good = write_raw(tmp_path, 'tl.json', make_raw())
    empty = write_raw(tmp_path, 'empty.json', make_raw(sections={'overview': None, 'history': None, 'culture': []}))
    broken = write_raw(tmp_path, 'broken.json', '{"location_id": "XX", "sect')
    blank = write_raw(tmp_path, 'blank.json', '')

    rejected = parse.main([str(good), str(empty), str(broken), str(blank)])

    assert rejected == ['empty.json', 'broken.json', 'blank.json']
    assert [p.name for p in (tmp_path / 'parsed').iterdir()] == ['tl.json']
    assert 'empty.json rejected: no usable sections' in caplog.text
    assert 'broken.json rejected: not a valid raw file' in caplog.text


def test_clean_text():
    assert parse.clean_text('Paris [3] is big[citation needed] , and old.') == 'Paris is big, and old.'
    assert parse.clean_text('Rome (/roʊm/ ROHM; Italian: Roma [ˈroːma] ⓘ) is old.') == 'Rome is old.'
    # normal parentheses stay
    assert parse.clean_text('Lyon (the second city) is nice.') == 'Lyon (the second city) is nice.'
