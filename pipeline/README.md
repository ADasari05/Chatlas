# Content aggregation pipeline

Downloads a country's or city's Wikipedia article and keeps only the **overview**,
**history**, and **culture** sections (as raw HTML). Cleaning that HTML up for the
database is the next step (US #39).

## Setup

```bash
pip install -r pipeline/requirements.txt
```

## Usage

Run from the repo root:

```bash
python pipeline/scrape.py France "Mexico, Valladolid, Yucatán"
python pipeline/scrape.py --file pipeline/samples.txt
python pipeline/scrape.py --file pipeline/samples.csv
```

There are two kinds of input:

- **Names**, on the command line or one per line in a `.txt` file. A name is an exact
  Wikipedia title (`France`, `Georgia (country)`). Put the country in front, separated by a
  comma, to check that the article really is in that country: `Mexico, Valladolid` fails
  because Wikipedia's "Valladolid" is the one in Spain. Titles that contain a comma need
  the country in front (`United States, Springfield, Illinois`).
- **A `.csv` file** with `location_id,type,country_id,wikipedia_title` columns. This is the
  format for data headed to the database, since it gives each location the same id the map
  uses (`FR`, `MX-YUC:Valladolid`). Every row is checked against its `country_id`.

Each location is saved to `pipeline/output/raw/<id or title>.json` (gitignored). Locations
that fail are logged and skipped. Ambiguous names like "Springfield" or "Georgia" fail on
purpose; use the full article title instead.

## Output format

```json
{
  "location_id": "FR-75C:Paris",
  "type": "city",
  "country_id": "FR",
  "title": "Paris",
  "wikidata_id": "Q90",
  "revision_id": 1380227587,
  "source_url": "https://en.wikipedia.org/wiki/Paris",
  "permalink": "https://en.wikipedia.org/w/index.php?oldid=1380227587",
  "license": "CC BY-SA 4.0",
  "fetched_at": "2026-10-19T18:32:06+00:00",
  "sections": {
    "overview": { "heading": null, "url": "...", "html": "..." },
    "history": { "heading": "History", "url": "...#History", "html": "..." },
    "culture": [{ "heading": "Culture", "url": "...#Culture", "html": "..." }]
  }
}
```

`overview` and `history` are `null` if the article doesn't have them. `culture` is a list:
usually just the "Culture" section, but articles without one (common for smaller cities)
get their culture-related sections instead, like "Museums", "Landmarks", or "Performing arts".
`location_id` and `type` are only filled in for CSV input, and `country_id` only when a country
was given.

Wikipedia text is CC BY-SA, so the app has to link back to the article (`url`) and mention the license wherever it's shown.

## Tests

```bash
python -m pytest pipeline
```
