# Dashboard Setup

Personal TRMNL dashboard showing date, weather, a random number, and data from a Google Sheet.

## Extension Configuration

- **Kind**: `poll`
- **URIs** (order matters — they map to `source_1`, `source_2`, `source_3`):
  1. `https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m`
  2. `https://www.random.org/integers/?num=1&min=0&max=100&col=1&base=10&format=plain&rnd=new`
  3. Your Google Apps Script deployment URL (see `google_apps_script.js`)

## Template Variables

| Data | Variable | Source |
|------|----------|--------|
| Date | `{{ "now" \| date: "%A, %B %d" }}` | Built-in Liquid |
| Temperature (°C) | `{{ source_1.current.temperature_2m }}` | Open-Meteo JSON |
| Random 0–100 | `{{ source_2[0] }}` | random.org plain text → array |
| Sheet rows | `{% for row in source_3.rows %}` | Google Apps Script JSON |

## Files

- `template.html` — Liquid template to paste into the Extension
- `google_apps_script.js` — Script to deploy in Google Sheets

## Notes

- With multiple URIs, Terminus exposes each as `source_N` (1-indexed).
- With a single URI it's just `source`.
- `text/plain` responses are split by whitespace into an array — hence `source_2[0]`.
- Sheet columns are named `Head 1` and `Head 2` — update if columns change.
- Playlist workaround: use 2 screens (same extension) until the single-screen rotation bug is fixed in `app/repositories/playlist_item.rb:32`.
