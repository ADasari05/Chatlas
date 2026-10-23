"""
uploads the parsed records from parse.py to supabase.

Usage:
    python pipeline/upload.py
    python pipeline/upload.py pipeline/output/parsed/fr.json

Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local. Safe to rerun, since
each location and its sections get replaced.
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

import requests

PARSED_DIR = Path(__file__).parent / 'output' / 'parsed'
ENV_FILE = Path(__file__).parent.parent / '.env.local'

log = logging.getLogger(__name__)


def load_env():
    """Puts the KEY=value lines from .env.local into os.environ."""
    for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())


def to_rows(record):
    """Splits a parsed record into its Locations row and LocationSections rows."""
    location = {key: value for key, value in record.items() if key != 'sections'}
    sections = [{'location_id': record['location_id'], **section} for section in record['sections']]
    return location, sections


def check(response):
    if not response.ok:
        raise Exception(f'{response.status_code} {response.text}')


def upload(session, api, record):
    location, sections = to_rows(record)
    upsert = {'Prefer': 'resolution=merge-duplicates'}

    check(session.post(f'{api}/Locations', json=location, headers=upsert,
                       params={'on_conflict': 'location_id'}))
    check(session.post(f'{api}/LocationSections', json=sections, headers=upsert,
                       params={'on_conflict': 'location_id,category'}))

    # delete sections from an earlier upload that this one doesn't have anymore
    categories = ','.join(section['category'] for section in sections)
    check(session.delete(f'{api}/LocationSections', params={
        'location_id': f'eq.{record["location_id"]}', 'category': f'not.in.({categories})'}))


def main(args=None):
    parser = argparse.ArgumentParser(description='Upload parsed pipeline records to Supabase.')
    parser.add_argument('files', nargs='*', help=f'parsed files to upload (default: everything in {PARSED_DIR})')
    args = parser.parse_args(args)

    files = args.files or sorted(PARSED_DIR.glob('*.json'))
    if not files:
        parser.error(f'no parsed files found in {PARSED_DIR}, run parse.py first')

    load_env()
    api = os.environ['NEXT_PUBLIC_SUPABASE_URL'] + '/rest/v1'
    session = requests.Session()
    session.headers['apikey'] = os.environ['SUPABASE_SECRET_KEY']

    failed = []
    for path in files:
        name = Path(path).name
        try:
            record = json.loads(Path(path).read_text(encoding='utf-8'))
            upload(session, api, record)
            log.info('%s -> %s (%d sections)', name, record['location_id'], len(record['sections']))
        except Exception as e:
            log.error('%s failed: %s', name, e)
            failed.append(name)

    log.info('done: %d uploaded, %d failed', len(files) - len(failed), len(failed))
    return failed


if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%H:%M:%S')
    failed = main()
    sys.exit(1 if failed else 0)
