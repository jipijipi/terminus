# n8n Dashboard Workflow

Single webhook that fetches weather and merges all dashboard data into one JSON response.

## Node Graph

```
Webhook → Icon Library ───────────────┐
                                       ├──► Merge ──► Dashboard Code
Webhook → Weather Request (HTTP) ─────┘
```

### 1. Webhook node
- Method: `GET`
- Path: `dashboard`
- Response mode: `When last node finishes`

### 2. Icon Library node (Code)

No inputs. Returns a flat map of `{ name: svgString }`. Add icons here as the set grows.

```js
return {
  swimming: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>',
  dinner:   '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
  school:   '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>',
  bike:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>',
  music:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  sport:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/></svg>',
  home:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  moon:     '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>',
};
```

### 3. Weather Request node (HTTP Request)
- Method: `GET`
- URL:
  ```
  https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&timezone=Europe/Paris&forecast_days=1
  ```
- Response format: `JSON`

### 4. Merge node
- Mode: `Combine` → `Combine by position`
- Inputs: Icon Library + Weather Request
- Ensures both branches have executed before Dashboard Code runs

### 5. Dashboard Code node (Code)

References the original nodes by name (not Merge). Use your exact node names.

```js
const icons = $('Icon Library').item.json;
const weather = $('Weather Request').item.json;

return {
  weather: {
    temp: weather.current.temperature_2m,
    code: weather.current.weather_code,
    max_temp: weather.daily.temperature_2m_max[0],
    daily_code: weather.daily.weather_code[0]
  },
  family: {
    names: ["Ulysse", "Mia"],
    events: [
      { member: "Ulysse", icon: icons.swimming, label: "" },
      { member: "Mia",    icon: icons.dinner,   label: "" },
      { member: "Maman",  icon: "",              label: "" },
      { member: "Papa",   icon: "",              label: "" }
    ]
  }
};
```

To add an icon: add an entry to Icon Library, reference with `icons.key` in an event.
To use no icon: set `icon: ""`.
Events with empty `label` are hidden by the Liquid template.

## Terminus Extension

- **Kind**: `poll`
- **URIs**: one single URI → `http://<host>:5678/webhook/dashboard`
- Single URI → data exposed as `source` (not `source_1`)

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

Add new top-level keys in Dashboard Code — no URI or extension changes needed:

```js
return {
  weather: { ... },
  family: { ... },
  chores: { ... },   // new
  agenda: { ... }    // new
};
```

For external data: add another HTTP Request node, connect it into the Merge node, reference it in Dashboard Code with `$('My Node').item.json`.

## Migration to Fly.io

- Update the extension URI in Terminus to the public n8n Fly URL
- Update `WEBHOOK_URL` in n8n's environment to its own public Fly URL
