from sections import extract_sections

URL = 'https://en.wikipedia.org/wiki/Testland'

# a cut-down version of the HTML Wikipedia's API returns
HTML = """
<html><body>
<section data-mw-section-id="0"><p>Testland is a country.</p></section>
<section data-mw-section-id="1"><h2 id="Etymology">Etymology</h2><p>Named after tests.</p></section>
<section data-mw-section-id="2"><h2 id="History">History</h2><p>Long ago.</p>
  <section data-mw-section-id="3"><h3 id="Middle_Ages">Middle Ages</h3><p>Castles.</p></section>
</section>
<section data-mw-section-id="4"><h2 id="In_popular_culture">In popular culture</h2><p>Movies.</p></section>
<section data-mw-section-id="5"><h2 id="Arts_and_culture">Arts and culture</h2><p>Paintings.</p></section>
<section data-mw-section-id="6"><h2 id="Tourism">Tourism</h2><p>Hotels.</p></section>
<section data-mw-section-id="7"><h2 id="References">References</h2><p>A book.</p></section>
</body></html>
"""

# a small city with no "Culture" section, just culture-related topics
CITY_HTML = """
<html><body>
<section data-mw-section-id="0"><p>Smallville is a city.</p></section>
<section data-mw-section-id="1"><h2 id="History">History</h2><p>Founded recently.</p></section>
<section data-mw-section-id="2"><h2 id="Economy">Economy</h2><p>Farming.</p></section>
<section data-mw-section-id="3"><h2 id="Museums">Museums</h2><p>A museum.</p></section>
<section data-mw-section-id="4"><h2 id="Landmarks">Landmarks</h2><p>A statue.</p></section>
</body></html>
"""


def test_overview():
    sections = extract_sections(HTML, URL)
    assert 'Testland is a country.' in sections['overview']['html']
    assert sections['overview']['url'] == URL


def test_history_includes_subsections():
    history = extract_sections(HTML, URL)['history']
    assert history['heading'] == 'History'
    assert 'Castles.' in history['html']
    assert history['url'] == URL + '#History'


def test_culture_skips_popular_culture():
    culture = extract_sections(HTML, URL)['culture']
    assert [c['heading'] for c in culture] == ['Arts and culture']


def test_culture_topics_only_used_without_a_culture_section():
    # Testland has "Arts and culture", so its "Tourism" section isn't added
    culture = extract_sections(HTML, URL)['culture']
    assert 'Hotels.' not in ''.join(c['html'] for c in culture)


def test_culture_falls_back_to_culture_topics():
    culture = extract_sections(CITY_HTML, URL)['culture']
    assert [c['heading'] for c in culture] == ['Museums', 'Landmarks']


def test_other_sections_are_dropped():
    sections = extract_sections(HTML, URL)
    kept = sections['overview']['html'] + sections['history']['html'] + ''.join(c['html'] for c in sections['culture'])
    for text in ['Named after tests.', 'Movies.', 'A book.']:
        assert text not in kept


def test_missing_sections():
    html = '<html><body><section data-mw-section-id="0"><p>Stub.</p></section></body></html>'
    sections = extract_sections(html, URL)
    assert sections['history'] is None
    assert sections['culture'] == []
