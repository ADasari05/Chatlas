"""
Usage:
    python pipeline/scrape.py France "Mexico, Valladolid, Yucatán"
    python pipeline/scrape.py --file pipeline/samples.txt
    python pipeline/scrape.py --file pipeline/samples.csv

Each name is a Wikipedia title, optionally with its country in front ("Mexico, Valladolid")
to check that the right article was found. CSV files also give each location its map id.
"""

import argparse
import csv
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from sections import extract_sections
from wiki import LocationError, fetch_html, get_country_code, get_country_codes, resolve

OUTPUT_DIR = Path(__file__).parent / 'output' / 'raw'

log = logging.getLogger(__name__)


def parse_line(line):
    """Splits "Mexico, Valladolid, Yucatán" into country and title. "France" has no country."""
    country, title = None, line.strip()
    if ',' in title:
        country, title = [part.strip() for part in title.split(',', 1)]
    return {'location_id': None, 'type': None, 'country_id': None, 'country': country, 'title': title}


def read_csv(path):
    with open(path, encoding='utf-8', newline='') as f:
        return [{'location_id': row['location_id'], 'type': row['type'], 'country_id': row['country_id'],
                 'country': None, 'title': row['wikipedia_title']} for row in csv.DictReader(f)]


def read_lines(path):
    with open(path, encoding='utf-8') as f:
        return [parse_line(line) for line in f if line.strip() and not line.startswith('#')]


def scrape(location):
    article = resolve(location['title'])

    # make sure we got the right place, like the Valladolid in Mexico and not the one in Spain
    expected = location['country_id'] or (location['country'] and get_country_code(location['country']))
    if expected:
        countries = get_country_codes(article['wikidata_id']) if article['wikidata_id'] else set()
        if expected not in countries:
            raise LocationError(f'"{article["title"]}" is in {", ".join(sorted(countries)) or "no country"}, '
                                f'expected {expected}')

    sections = extract_sections(fetch_html(article['revision_id']), article['url'])

    for category, section in sections.items():
        if not section:
            log.warning('%s: no %s section found', location['title'], category)

    record = {
        'location_id': location['location_id'],
        'type': location['type'],
        'country_id': expected,
        'title': article['title'],
        'wikidata_id': article['wikidata_id'],
        'revision_id': article['revision_id'],
        'source_url': article['url'],
        'permalink': f'https://en.wikipedia.org/w/index.php?oldid={article["revision_id"]}',
        'license': 'CC BY-SA 4.0',
        'fetched_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sections': sections,
    }

    # name files by map id when there is one, so the two Valladolids don't overwrite each other
    filename = re.sub(r'\W+', '_', (location['location_id'] or location['title']).lower()).strip('_') + '.json'
    path = OUTPUT_DIR / filename
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return path


def main(args=None):
    parser = argparse.ArgumentParser(description='Download Wikipedia sections for countries/cities.')
    parser.add_argument('names', nargs='*', help='titles, optionally with the country first ("Mexico, Valladolid")')
    parser.add_argument('--file', help='.txt file with one name per line, or .csv file with map ids')
    args = parser.parse_args(args)

    locations = [parse_line(name) for name in args.names]
    if args.file:
        locations += read_csv(args.file) if args.file.endswith('.csv') else read_lines(args.file)
    if not locations:
        parser.error('give at least one name or --file')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for location in locations:
        label = location['location_id'] or location['title']
        try:
            path = scrape(location)
            log.info('%s -> %s', label, path.name)
        except Exception as e:
            # log and continue
            log.error('%s: %s', label, e)
            failed.append(label)

    log.info('done: %d succeeded, %d failed', len(locations) - len(failed), len(failed))
    return failed


if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%H:%M:%S')
    failed = main()
    sys.exit(1 if failed else 0)
