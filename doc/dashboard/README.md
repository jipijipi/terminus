# Dashboard v1

Personal TRMNL dashboard with 4 zones: date, weather, family, status.

## Extension Configuration

- **Kind**: `poll`
- **URIs**: one single URI → `http://<host>:5678/webhook/dashboard`
- Since there is only one URI, Terminus exposes data as `source` (not `source_1`, `source_2`)

All data — weather included — flows through n8n. See `n8n_workflow.md` for setup.

## Zones

### Zone 1 — Date
Pure Liquid. No data source. Displays day of week + date.

### Zone 2 — Status
Displays last render time (`{{ "now" | date: "%H:%M" }}`).
Battery and refresh rate are not exposed to Liquid templates without a code change to `app/aspects/extensions/contextualizer.rb`.

### Zone 3 — Weather (`source.weather`)

n8n fetches Open-Meteo on each webhook call and flattens the response.

| Variable | Description |
|---|---|
| `source.weather.temp` | Current temp (°C) |
| `source.weather.code` | WMO code → mapped to label + symbol in template |
| `source.weather.max_temp` | Today's max temp |
| `source.weather.daily_code` | Daily worst condition code |

WMO code mapping: 0=Clear ☀, 1-3=Cloudy ☁, rain=Rain ☂, snow=Snow ❄, storm=Storm ⚡.
Clothing suggestion derived from current temp + umbrella flag from daily forecast.

### Zone 4 — Family (`source.family`)

Edited directly in the n8n Set node. No external service needed.

| Variable | Description |
|---|---|
| `source.family.names[idx]` | Random name (seconds mod 2 at render time) |
| `source.family.events` | Array of `{ member, icon, label }` — empty label = hidden |

## Files

- `template.html` — full Liquid template (paste into Terminus extension)
- `n8n_workflow.md` — n8n workflow setup instructions
- `README.md` — this file

## Notes

- Terminus HTTP client does not follow redirects — use n8n as a proxy for any service that redirects
- Single-screen playlist bug: use 2+ screens in playlist (`app/repositories/playlist_item.rb:32`)
- Fly.io migration: update extension URI to public n8n URL, update `WEBHOOK_URL` in n8n env
