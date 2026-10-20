"""
Usage:
    python pipeline/scrape.py France "Springfield, Illinois"
    python pipeline/scrape.py --file pipeline/samples.txt
"""

import argparse
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from sections import extract_sections
from wiki import fetch_html, resolve

OUTPUT_DIR = Path(__file__).parent / 'output' / 'raw'

log = logging.getLogger(__name__)


def scrape(name):
    article = resolve(name)
    sections = extract_sections(fetch_html(article['revision_id']), article['url'])

    for category, section in sections.items():
        if not section:
            log.warning('%s: no %s section found', name, category)

    record = {
        'name': name,
        'title': article['title'],
        'revision_id': article['revision_id'],
        'source_url': article['url'],
        'permalink': f'https://en.wikipedia.org/w/index.php?oldid={article["revision_id"]}',
        'license': 'CC BY-SA 4.0',
        'fetched_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sections': sections,
    }

    filename = re.sub(r'\W+', '_', name.lower()).strip('_') + '.json'
    path = OUTPUT_DIR / filename
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return path


def main(args=None):
    parser = argparse.ArgumentParser(description='Download Wikipedia sections for countries/cities.')
    parser.add_argument('names', nargs='*', help='country or city names')
    parser.add_argument('--file', help='text file with one name per line')
    args = parser.parse_args(args)

    names = args.names
    if args.file:
        with open(args.file, encoding='utf-8') as f:
            names += [line.strip() for line in f if line.strip() and not line.startswith('#')]
    if not names:
        parser.error('give at least one name or --file')

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for name in names:
        try:
            path = scrape(name)
            log.info('%s -> %s', name, path.name)
        except Exception as e:
            # log and continue
            log.error('%s: %s', name, e)
            failed.append(name)

    log.info('done: %d succeeded, %d failed', len(names) - len(failed), len(failed))
    return failed


if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%H:%M:%S')
    failed = main()
    sys.exit(1 if failed else 0)
