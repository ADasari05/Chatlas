# Content aggregation pipeline

Two steps:

1. `scrape.py` downloads a country's or city's Wikipedia article and keeps only the
   **overview**, **history**, and **culture** sections, as raw HTML (US #38).
2. `parse.py` cleans that HTML into plain-text records for the database (US #39).

## Setup

```bash
pip install -r pipeline/requirements.txt
```

## Step 1: scraping

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

### Raw output format

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

## Step 2: parsing

```bash
python pipeline/parse.py                               # every file in pipeline/output/raw
python pipeline/parse.py pipeline/output/raw/fr.json   # specific files
```

Each raw file becomes `pipeline/output/parsed/<same name>.json`. The parser strips citation
markers, reference lists, the infobox and other tables, images, "Main article" notes, and
pronunciation guides, leaving paragraphs separated by blank lines. Subsections are kept as
`## Heading` lines.

Files are rejected (with the reason printed) if they aren't valid raw output, have no
`location_id` (only CSV input gives one), or have no usable sections. Sections under 30
words after cleaning are dropped with a warning.

### Parsed output format

One location, with up to three sections (one per category). For the database this is two
tables: locations, and sections linked to them by `location_id`.

```json
{
  "location_id": "MX-YUC:Valladolid",
  "type": "city",
  "country_id": "MX",
  "wikipedia_title": "Valladolid, Yucatán",
  "wikidata_id": "Q1024731",
  "revision_id": 1379381980,
  "source_url": "https://en.wikipedia.org/wiki/Valladolid,_Yucat%C3%A1n",
  "license": "CC BY-SA 4.0",
  "fetched_at": "2026-10-20T19:25:54+00:00",
  "sections": [
    {
      "category": "history",
      "heading": "History",
      "text": "Named after Valladolid, at the time the capital of Spain, ...\n\nThe following year, ...",
      "summary": null,
      "word_count": 348,
      "source_url": "https://en.wikipedia.org/wiki/Valladolid,_Yucat%C3%A1n#History"
    }
  ]
}
```

`category` is `overview`, `history`, or `culture`. When culture came from several sections
(like "Museums" and "Landmarks"), they're merged into one with their headings as `##`
subheadings, and `source_url` points to the whole article. `summary` is empty for now.

## Tests

```bash
python -m pytest pipeline
```
