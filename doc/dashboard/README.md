# Dashboard v1

Personal TRMNL dashboard with 4 zones: date, weather, family, status.

## Extension Configuration

- **Kind**: `poll`
- **URIs** (order matters — they map to `source_1`, `source_2`):
  1. Open-Meteo weather (see below)
  2. n8n family webhook: `http://<host>:5678/webhook/family`

### Open-Meteo URI

```
https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&timezone=Europe/Paris&forecast_days=1
```

## Zones

### Zone 1 — Date
Pure Liquid. No data source. Displays day of week + date.

### Zone 2 — Status
Displays last render time (`{{ "now" | date: "%H:%M" }}`). Battery and refresh rate are not exposed to Liquid templates without a code change to `app/aspects/extensions/contextualizer.rb`.

### Zone 3 — Weather (`source_1`)
Open-Meteo JSON. No auth required, no redirects.

| Variable | Description |
|---|---|
| `source_1.current.temperature_2m` | Current temp (°C) |
| `source_1.current.weather_code` | WMO code → label + symbol |
| `source_1.daily.temperature_2m_max[0]` | Today's max temp |
| `source_1.daily.weather_code[0]` | Daily worst condition |

WMO code mapping in template: 0=Clear ☀, 1-3=Cloudy ☁, rain codes=Rain ☂, snow codes=Snow ❄, storm codes=Storm ⚡.

Clothing suggestion derived from current temp + umbrella flag from daily forecast.

### Zone 4 — Family (`source_2`)

n8n workflow: Webhook node (GET, path: `family`) → Set node (JSON mode) → auto-respond.

**Set node JSON shape:**
```json
{
  "names": ["Ulysse", "Mia"],
  "events": [
    { "member": "Ulysse", "icon": "~", "label": "Swimming 17h" },
    { "member": "Mia", "icon": "x", "label": "Dinner out 20h" },
    { "member": "Jean", "icon": "", "label": "" },
    { "member": "JP", "icon": "", "label": "" }
  ]
}
```

- `names`: picked pseudo-randomly using seconds mod 2 at render time
- Events with empty `label` are hidden
- Update events directly in the n8n Set node

## Files

- `template.html` — full Liquid template (all zones)
- `README.md` — this file

## Notes

- Terminus HTTP client does not follow redirects — use direct JSON APIs or n8n webhooks only
- Single-screen playlist bug: use 2+ screens in playlist (`app/repositories/playlist_item.rb:32`)
- `text/plain` responses are split into array — not used in v1
- Fly.io migration: update `WEBHOOK_URL` in n8n and extension URIs to public URLs
