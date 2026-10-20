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
python pipeline/scrape.py France "Springfield, Illinois"
python pipeline/scrape.py --file pipeline/samples.txt
```

Each location is saved to `pipeline/output/raw/<name>.json` (gitignored). Locations that
fail are logged and skipped. Ambiguous names like "Springfield" or "Georgia" fail on purpose;
use the full article title instead ("Springfield, Illinois", "Georgia (country)").

## Output format

```json
{
  "name": "Paris",
  "title": "Paris",
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
get their culture-related sections instead, like "Museums", "Landmarks", or "Performing arts". Wikipedia text is CC BY-SA, so the
app has to link back to the article (`url`) and mention the license wherever it's shown.

## Tests

```bash
python -m pytest pipeline
```
