from unittest.mock import MagicMock

import upload


def make_record():
    return {
        'location_id': 'TL',
        'type': 'country',
        'country_id': 'TL',
        'wikipedia_title': 'Testland',
        'wikidata_id': 'Q1',
        'revision_id': 123,
        'source_url': 'https://en.wikipedia.org/wiki/Testland',
        'license': 'CC BY-SA 4.0',
        'fetched_at': '2026-10-20T19:25:54+00:00',
        'sections': [
            {'category': 'overview', 'heading': None, 'text': 'Testland is a country.', 'summary': None,
             'word_count': 4, 'source_url': 'https://en.wikipedia.org/wiki/Testland'},
            {'category': 'history', 'heading': 'History', 'text': 'Founded in 1900.', 'summary': None,
             'word_count': 3, 'source_url': 'https://en.wikipedia.org/wiki/Testland#History'},
        ],
    }


def test_to_rows_splits_location_and_sections():
    location, sections = upload.to_rows(make_record())
    assert location['location_id'] == 'TL'
    assert 'sections' not in location
    assert [s['category'] for s in sections] == ['overview', 'history']
    assert all(s['location_id'] == 'TL' for s in sections)


def test_upload_deletes_sections_not_in_record():
    session = MagicMock()
    upload.upload(session, 'https://x.supabase.co/rest/v1', make_record())

    params = session.delete.call_args.kwargs['params']
    assert params == {'location_id': 'eq.TL', 'category': 'not.in.(overview,history)'}
