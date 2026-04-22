# n8n Dashboard Workflow

Single webhook that fetches weather and merges all dashboard data into one JSON response.

## Nodes

```
Webhook → HTTP Request (Open-Meteo) → Set (merge all data)
```

### 1. Webhook node
- Method: `GET`
- Path: `dashboard`
- Response mode: `When last node finishes`

### 2. HTTP Request node
- Method: `GET`
- URL:
  ```
  https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&timezone=Europe/Paris&forecast_days=1
  ```
- Response format: `JSON`

### 3. Set node (JSON mode)

Weather fields use **expression mode** (click `=` on each value to toggle).
Family fields are plain values.

```json
{
  "weather": {
    "temp": "{{ $('HTTP Request').item.json.current.temperature_2m }}",
    "code": "{{ $('HTTP Request').item.json.current.weather_code }}",
    "max_temp": "{{ $('HTTP Request').item.json.daily.temperature_2m_max[0] }}",
    "daily_code": "{{ $('HTTP Request').item.json.daily.weather_code[0] }}"
  },
  "family": {
    "names": ["Ulysse", "Mia"],
    "events": [
      { "member": "Ulysse", "icon": "", "label": "" },
      { "member": "Mia", "icon": "", "label": "" },
      { "member": "Jean", "icon": "", "label": "" },
      { "member": "JP", "icon": "", "label": "" }
    ]
  }
}
```

Fill in `label` for any member with an event today. Leave empty to hide the line.

## Terminus Extension

- **Kind**: `poll`
- **URIs**: one single URI → `http://<host>:5678/webhook/dashboard`
- Since there is only one URI, Terminus exposes the data as `source` (not `source_1`)

## Template Variables

| Data | Variable |
|---|---|
| Current temp | `{{ source.weather.temp }}` |
| Weather code | `{{ source.weather.code }}` |
| Max temp today | `{{ source.weather.max_temp }}` |
| Daily weather code | `{{ source.weather.daily_code }}` |
| Family name (random) | `{{ source.family.names[idx] }}` |
| Family events | `{% for e in source.family.events %}` |

## Adding More Data Later

Add new top-level keys to the Set node — no URI or extension changes needed:

```json
{
  "weather": { ... },
  "family": { ... },
  "chores": { ... },
  "agenda": { ... }
}
```

For data from external services, add more HTTP Request nodes before the Set node and reference them with `$('node name').item.json.*`.

## Migration to Fly.io

- Update the extension URI in Terminus to the public n8n Fly URL
- Update `WEBHOOK_URL` in n8n's environment to its own public Fly URL
