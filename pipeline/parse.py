"""
Content aggregation pipeline, step 2: turn the raw HTML from scrape.py into clean text
records for the database.

Usage:
    python pipeline/parse.py                                  # every file in output/raw
    python pipeline/parse.py pipeline/output/raw/fr.json      # specific files
"""

import argparse
import json
import logging
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).parent / 'output' / 'raw'
PARSED_DIR = Path(__file__).parent / 'output' / 'parsed'

MIN_WORDS = 30  # sections shorter than this after cleaning aren't worth showing

# everything that isn't article text: citations, infobox and other tables, images,
# "Main article: ..." notes, and hidden template junk
JUNK = ['sup.mw-ref', 'table', 'figure', 'style', 'link', 'meta', 'div.hatnote', 'div.shortdescription',
        '.noprint', '.mw-empty-elt', 'ul.gallery', 'div.navbox', 'ol.references', 'div.reflist']

# leftover markers like [12], [a], [citation needed], [update]
CITATION = re.compile(r'\[(\d+|[a-z]{1,2}|note \d+|update|[^\]]*needed)\]')
# pronunciation guides like "(/ˈpærɪs/ PARR-iss; French: [paʁi] ⓘ)"
PRONUNCIATION = re.compile(r'\s*\([^()]*(ⓘ|pronunciation|/[^/\s][^/]*/)[^()]*\)')

log = logging.getLogger(__name__)


class ParseError(Exception):
    pass


def clean_text(text):
    text = CITATION.sub('', text)
    text = PRONUNCIATION.sub('', text)
    text = re.sub(r'\s+', ' ', text)
    return re.sub(r'\s+([,.;:])', r'\1', text).strip()  # "Paris ," -> "Paris,"


def html_to_text(html, extra_level=0):
    """Turns a section's HTML into plain text: paragraphs separated by blank lines and
    subsection headings as "## Heading" lines."""
    soup = BeautifulSoup(html, 'html.parser')
    for junk in soup.select(', '.join(JUNK)):
        junk.decompose()

    blocks = []
    for el in soup.find_all(['p', 'li', 'h3', 'h4', 'h5']):
        text = clean_text(el.get_text())
        if not text:
            continue
        if el.name.startswith('h'):
            level = int(el.name[1]) - 1 + extra_level  # h3 -> ##, h4 -> ###
            blocks.append('#' * level + ' ' + text)
        elif el.name == 'li':
            blocks.append('- ' + text)
        else:
            blocks.append(text)

    # drop headings with nothing under them (like a subsection that was just a table)
    kept = []
    for i, block in enumerate(blocks):
        next_block = blocks[i + 1] if i + 1 < len(blocks) else None
        if block.startswith('#') and (next_block is None or next_block.startswith('#')):
            continue
        kept.append(block)
    return '\n\n'.join(kept)


def count_words(text):
    return sum(len(line.split()) for line in text.splitlines() if not line.startswith('#'))


def make_section(category, heading, text, source_url):
    return {
        'category': category,
        'heading': heading,
        'text': text,
        'summary': None,  # filled in by a later summarizing step
        'word_count': count_words(text),
        'source_url': source_url,
    }


def parse_sections(raw):
    raw_sections = raw['sections']
    sections = []

    overview = raw_sections.get('overview')
    if overview:
        sections.append(make_section('overview', None, html_to_text(overview['html']), overview['url']))

    history = raw_sections.get('history')
    if history:
        sections.append(make_section('history', history['heading'], html_to_text(history['html']), history['url']))

    culture = raw_sections.get('culture') or []
    if len(culture) == 1:
        sections.append(make_section('culture', culture[0]['heading'], html_to_text(culture[0]['html']), culture[0]['url']))
    elif len(culture) > 1:
        # several culture-related sections (like "Museums" and "Landmarks") become one,
        # with their headings kept as subheadings
        parts = [f'## {c["heading"]}\n\n{html_to_text(c["html"], extra_level=1)}' for c in culture]
        sections.append(make_section('culture', 'Culture', '\n\n'.join(parts), raw['source_url']))

    return sections


def validate(raw, sections):
    """Raises ParseError if the location can't be used, and drops sections that are too short."""
    for field in ['location_id', 'title', 'revision_id', 'source_url']:
        if not raw.get(field):
            hint = ' (scrape from a CSV file to get map ids)' if field == 'location_id' else ''
            raise ParseError(f'missing {field}{hint}')

    valid = []
    for section in sections:
        if section['word_count'] < MIN_WORDS:
            log.warning('%s: dropped %s section, only %d words after cleaning',
                        raw['location_id'], section['category'], section['word_count'])
        else:
            valid.append(section)

    if not valid:
        raise ParseError('no usable sections')
    return valid


def parse(raw):
    sections = validate(raw, parse_sections(raw))
    return {
        'location_id': raw['location_id'],
        'type': raw.get('type'),
        'country_id': raw.get('country_id'),
        'wikipedia_title': raw['title'],
        'wikidata_id': raw.get('wikidata_id'),
        'revision_id': raw['revision_id'],
        'source_url': raw['source_url'],
        'license': raw.get('license'),
        'fetched_at': raw.get('fetched_at'),
        'sections': sections,
    }


def parse_file(path):
    try:
        raw = json.loads(Path(path).read_text(encoding='utf-8'))
        if not isinstance(raw.get('sections'), dict):
            raise ParseError('no sections in file')
    except (json.JSONDecodeError, AttributeError) as e:
        raise ParseError(f'not a valid raw file ({e})')

    record = parse(raw)
    out = PARSED_DIR / Path(path).name
    out.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    return out


def main(args=None):
    parser = argparse.ArgumentParser(description='Clean raw pipeline output into database records.')
    parser.add_argument('files', nargs='*', help=f'raw files to parse (default: everything in {RAW_DIR})')
    args = parser.parse_args(args)

    files = args.files or sorted(RAW_DIR.glob('*.json'))
    if not files:
        parser.error(f'no raw files found in {RAW_DIR}, run scrape.py first')

    PARSED_DIR.mkdir(parents=True, exist_ok=True)
    rejected = []
    for path in files:
        name = Path(path).name
        try:
            out = parse_file(path)
            log.info('%s -> %s', name, out.name)
        except Exception as e:
            log.error('%s rejected: %s', name, e)
            rejected.append(name)

    log.info('done: %d parsed, %d rejected', len(files) - len(rejected), len(rejected))
    return rejected


if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', datefmt='%H:%M:%S')
    rejected = main()
    sys.exit(1 if rejected else 0)
