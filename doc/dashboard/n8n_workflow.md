# n8n Dashboard Workflow

Single webhook returning all dynamic dashboard data as one JSON object.

## Setup

1. In n8n, create a new workflow
2. **Webhook node**
   - Method: `GET`
   - Path: `dashboard`
   - Response mode: `When last node finishes`
3. **Set node** (JSON mode, connected to Webhook)
   - Paste the JSON below
4. **Activate** the workflow

Test: `curl http://<host>:5678/webhook/dashboard`

## Set Node JSON

```json
{
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

## Terminus Extension URIs

Order matters — maps to `source_N`:

1. Open-Meteo: `https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&timezone=Europe/Paris&forecast_days=1`
2. n8n: `http://<host>:5678/webhook/dashboard`

## Template Variables

| Data | Variable |
|---|---|
| Family name (random) | `{{ source_2.family.names[idx] }}` |
| Family events | `{% for e in source_2.family.events %}` |

## Adding More Data Later

Add new top-level keys to the Set node JSON — no URI changes needed in Terminus:

```json
{
  "family": { ... },
  "chores": { ... },
  "events": { ... }
}
```

## Migration to Fly.io

Update the n8n URI in the Terminus extension to the public Fly URL.
Update `WEBHOOK_URL` in n8n's environment to the public Fly URL.
