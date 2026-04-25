# n8n Dashboard Workflow

Single webhook that fetches weather + Google Calendar events, merges all data into one JSON response.

## Node Graph

```
Webhook → Date Prep ──► Ulysse Calendar ──┐
                    └──► Mia Calendar ─────┤
                    └──► Maman Calendar ───┤
                    └──► Papa Calendar ────┤
Webhook → Icon Library ────────────────────┤
Webhook → Weather Request ─────────────────┤
Webhook → Upstash GET ─────────────────────┴──► Merge ──► Dashboard Code
```

### 1. Webhook node
- Method: `GET`
- Path: `dashboard`
- Response mode: `When last node finishes`

### 2. Date Prep node (Code)

Computes `timeMin`/`timeMax` for today in UTC. Referenced by all 4 Calendar HTTP Request nodes.

```js
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
return {
  timeMin: `${ymd(now)}T00:00:00Z`,
  timeMax: `${ymd(tomorrow)}T00:00:00Z`
};
```

### 3. Icon Library node (Code)

No inputs. Returns a flat map of `{ name: svgString }`.

`assets/icons/*.svg` is the source of truth. The build script generates the paste-ready JS:

```
/usr/bin/ruby scripts/build_icon_library.rb
```

Output: `doc/dashboard/icon_library.js` — paste its contents into this Code node.

Weather icon keys (`sun`, `cloud`, `rain`, `snow`, `storm`, `moon`) are looked up by the Dashboard Code node to render the current condition. Calendar event keys (e.g. `swimming`, `bike`) must match Google Calendar event titles exactly.

### 4. Calendar HTTP Request nodes (×4)

One node per family member. Enable **"Continue on error"** on each (Settings tab).

- Method: `GET`
- URL (expression mode):
  ```
  https://www.googleapis.com/calendar/v3/calendars/CALENDAR_ID/events?key=API_KEY&timeMin={{ $('Date Prep').item.json.timeMin }}&timeMax={{ $('Date Prep').item.json.timeMax }}&singleEvents=true&orderBy=startTime
  ```
- Replace `CALENDAR_ID` and `API_KEY` with real values per node
- Node names: `Ulysse Calendar`, `Mia Calendar`, `Maman Calendar`, `Papa Calendar`

Calendar IDs are found in Google Calendar → Settings → "Integrate calendar".

### 5. Weather Request node (HTTP Request)

Enable **"Continue on error"** (Settings tab).

- Method: `GET`
- URL:
  ```
  https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&timezone=Europe/Paris&forecast_days=1
  ```
- Response format: `JSON`

### 6. Upstash GET node (HTTP Request)

Enable **"Continue on error"** (Settings tab).

- Method: `GET`
- URL: `https://YOUR_UPSTASH_HOST/get/bonusPoints`
- Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
- Response format: `JSON`

Upstash REST API returns `{ "result": "4" }` — the value is a string, coerced to int in Dashboard Code.

### 7. Merge node
- Mode: `Combine` → `Combine by position`
- Inputs: all 4 Calendar nodes + Icon Library + Weather Request + Upstash GET (7 total)
- Ensures all branches have executed before Dashboard Code runs

### 8. Dashboard Code node (Code)

References all original nodes by name (not Merge).

```js
const icons = $('Icon Library').item.json;

// WMO weather code → icon key (matches assets/icons/*.svg filenames)
const WMO_ICON = {
  0: 'sun',
  1: 'sun',  2: 'cloud', 3: 'cloud',
  51: 'rain', 53: 'rain', 55: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  95: 'storm', 96: 'storm', 99: 'storm',
};

const WMO_LABEL = {
  0: 'Clear',    1: 'Clear',    2: 'Cloudy',   3: 'Overcast',
  51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain',    63: 'Rain',    65: 'Rain',
  71: 'Snow',    73: 'Snow',    75: 'Snow',    77: 'Snow',
  80: 'Showers', 81: 'Showers', 82: 'Showers',
  95: 'Storm',   96: 'Storm',   99: 'Storm',
};

// Weather — defensive against API errors and network failures
const weatherRaw = $('Weather Request').item.json;
let weather;
if (weatherRaw.error || !weatherRaw.current) {
  weather = { temp: null, code: null, max_temp: null, daily_code: null, icon: null, condition: null };
} else {
  const code = weatherRaw.current.weather_code;
  weather = {
    temp:       weatherRaw.current.temperature_2m,
    code,
    max_temp:   weatherRaw.daily.temperature_2m_max[0],
    daily_code: weatherRaw.daily.weather_code[0],
    icon:       icons[WMO_ICON[code]] || null,
    condition:  WMO_LABEL[code] || 'Weather',
  };
}

// Calendar — extract today's all-day event icons per member
function memberIcons(nodeName) {
  const raw = $(nodeName).item.json;
  if (raw.error || !raw.items) return [];
  return raw.items
    .filter(e => e.start && e.start.date && !e.start.dateTime)
    .map(e => {
      const key = Object.keys(icons).find(k => k.toLowerCase() === (e.summary || '').toLowerCase());
      return key ? { svg: icons[key] } : { text: e.summary || '' };
    })
    .filter(e => e.svg || e.text);
}

const family = [
  { member: "Ulysse", icons: memberIcons('Ulysse Calendar') },
  { member: "Mia",    icons: memberIcons('Mia Calendar') },
  { member: "Maman",  icons: memberIcons('Maman Calendar') },
  { member: "Papa",   icons: memberIcons('Papa Calendar') },
];

// Bons Points — read from Upstash GET node
const upstashRaw = $('Upstash GET').item.json;
const bonusPoints = parseInt(upstashRaw?.result ?? 0, 10) || 0;

return { weather, family, bonusPoints };
```

`icons: []` means no events today → Liquid renders `—` placeholder.
Unknown calendar event titles (no matching icon key) are filtered out silently.

## JSON shape exposed to Terminus

```json
{
  "weather": { "temp": 14.2, "code": 2, "max_temp": 19.4, "daily_code": 2, "icon": "<svg...>", "condition": "Cloudy" },
  "family": [
    { "member": "Ulysse", "icons": ["<svg...>", "<svg...>"] },
    { "member": "Mia",    "icons": [] },
    { "member": "Maman",  "icons": ["<svg...>"] },
    { "member": "Papa",   "icons": [] }
  ],
  "bonusPoints": 4
}
```

## Template Variables

| Data | Variable |
|---|---|
| Current temp | `{{ source.weather.temp }}` |
| Weather code | `{{ source.weather.code }}` |
| Max temp today | `{{ source.weather.max_temp }}` |
| Daily weather code | `{{ source.weather.daily_code }}` |
| Weather icon (SVG) | `{{ source.weather.icon }}` |
| Weather condition | `{{ source.weather.condition }}` |
| Random name | `{{ source.names[idx] }}` |
| Family rows | `{% for m in source.family %}` |
| Member name | `{{ m.member }}` |
| Member icons | `{% for icon in m.icons %}{{ icon }}{% endfor %}` |
| Bons Points count | `{{ source.bonusPoints }}` |

## Error Handling

All external HTTP nodes have **"Continue on error"** enabled. Dashboard Code checks for error shapes before accessing properties:

- Weather: `weatherRaw.error || !weatherRaw.current` → returns null fields → Liquid shows `--°C`
- Calendar: `raw.error || !raw.items` → returns `[]` → Liquid shows `—` placeholder

## Adding More Icons

1. Add the SVG file to `assets/icons/roller.svg`
2. Run `/usr/bin/ruby scripts/build_icon_library.rb`
3. Paste the updated `doc/dashboard/icon_library.js` into the n8n Icon Library Code node
4. Create a Google Calendar all-day event titled `roller`
5. No other changes needed

## Terminus Extension

- **Kind**: `poll`
- **URIs**: one single URI → `http://<host>:5678/webhook/dashboard`
- Single URI → data exposed as `source` (not `source_1`)

## Bons Points Counter

Two separate n8n workflows, independent of the dashboard workflow. Counter state lives in **Upstash Redis** — a managed Redis service with a free tier (10k req/day, no credit card). Persists across n8n restarts and Fly.io redeploys.

**Upstash setup (one-time):**
1. Create a free database at console.upstash.com
2. Copy the REST URL and REST Token from the database dashboard
3. Store both in n8n as a credential (or hardcode in HTTP Request headers — credential is cleaner)

### Workflow: Counter Up

```
Webhook (GET /webhook/counter-up?delta=1)
  → Upstash INCRBY (HTTP Request)
  → Upstash GET (HTTP Request)
  → Respond to Webhook
```

- **Webhook**: GET, path `counter-up`, response mode `Using Respond to Webhook node`

- **Upstash INCRBY** (HTTP Request, "Continue on error"):
  - Method: `POST`
  - URL: `https://YOUR_UPSTASH_HOST/incrby/bonusPoints/{{ $json.query.delta ?? 1 }}`
  - Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
  - Note: `INCRBY` with a negative delta subtracts. Upstash returns `{ "result": 5 }`

- **Upstash GET** (HTTP Request):
  - Method: `GET`
  - URL: `https://YOUR_UPSTASH_HOST/get/bonusPoints`
  - Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
  - Used to get the confirmed value after increment for the response

- **Respond to Webhook**:
  - Body: `Bons Points: {{ $json.result }} ({{ parseInt($('Webhook').item.json.query.delta ?? 1) >= 0 ? '+' : '' }}{{ $('Webhook').item.json.query.delta ?? 1 }})`
  - MIME type: `text/plain`

**Phone bookmark:** `https://YOUR_N8N_HOST/webhook/counter-up?delta=1`

`delta` query param (integer, default 1 if omitted):
- `?delta=1` → +1 (normal tap)
- `?delta=3` → +3 at once
- `?delta=-1` → subtract one (correction)

### Workflow: Weekly Reset

```
Schedule Trigger (Monday 00:00, Europe/Paris) → Upstash SET (HTTP Request)
```

- **Schedule**: Every week, Monday, 00:00, timezone `Europe/Paris`
- **Upstash SET** (HTTP Request):
  - Method: `POST`
  - URL: `https://YOUR_UPSTASH_HOST/set/bonusPoints/0`
  - Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`

## Infrastructure & Free Tier Summary

| Service | Purpose | Free tier |
|---|---|---|
| Open-Meteo | Weather API | Unlimited, no key needed |
| Google Calendar API | Family events | Free (key-only, public calendars) |
| Upstash Redis | Bons Points counter | 10k req/day, 256MB |
| n8n (self-hosted) | Orchestration | Free (self-hosted on Fly.io) |
| Fly.io | Hosting (Terminus + n8n) | Free allowance covers both small apps |

## Migration to Fly.io

- Deploy n8n as a separate Fly app with a persistent volume
- Update `WEBHOOK_URL` in n8n's environment to its own public Fly URL (e.g. `https://my-n8n.fly.dev`)
- Update the Terminus extension URI to the public n8n URL
- Upstash credentials stay the same — the REST API is external, no changes needed
- No counter migration needed: Upstash data is already cloud-hosted
