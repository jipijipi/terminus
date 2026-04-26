# n8n Dashboard Workflow

Single webhook that fetches weather + Google Calendar events, merges all data into one JSON response.

## Node Graph

```
Webhook → Date Prep ──► Ulysse Calendar ──┐
                    ├──► Mia Calendar ─────┤
                    ├──► Maman Calendar ───┤
                    └──► Papa Calendar ────┤
Webhook → Icon Library ────────────────────┤
Webhook → Weather Request ─────────────────┤
Webhook → Upstash GET ─────────────────────┤
Webhook → Content Length ──► Content Index ──► Content Item ──┴──► Merge ──► Dashboard Code
```

### 1. Webhook node
- Method: `GET`
- Path: `dashboard`
- Response mode: `When last node finishes`

### 2. Date Prep node (Code)

- **Mode: `Run once for all items`** — same reason as Dashboard Code; avoids outputting one item per branch instead of one.

Computes `timeMin`/`timeMax` for the relevant day. In night mode (17:00–23:59 Paris time) it targets tomorrow's events; in day mode (00:00–16:59) it targets today's. All 4 Calendar nodes share this single pair.

```js
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const parisHour = parseInt(
  now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }),
  10
);
const night_mode = parisHour >= 17;

const target = new Date(now);
if (night_mode) target.setDate(target.getDate() + 1);
const next = new Date(target);
next.setDate(next.getDate() + 1);

return [{ json: {
  timeMin: `${ymd(target)}T00:00:00Z`,
  timeMax: `${ymd(next)}T00:00:00Z`,
  night_mode,
} }];
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

One node per family member. Date Prep already decided whether `timeMin`/`timeMax` covers today or tomorrow, so these nodes are unchanged from the original. Enable **"Continue on error"** on each (Settings tab).

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
  https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,weather_code,apparent_temperature&daily=temperature_2m_max,weather_code,apparent_temperature_max&timezone=Europe/Paris&forecast_days=2
  ```
- `forecast_days=2` returns today (index 0) and tomorrow (index 1) in the `daily` arrays.
- Response format: `JSON`

### 6. Upstash GET node (HTTP Request)

Enable **"Continue on error"** (Settings tab).

- Method: `GET`
- URL: `https://YOUR_UPSTASH_HOST/get/bonusPoints`
- Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
- Response format: `JSON`

Upstash REST API returns `{ "result": "4" }` — the value is a string, coerced to int in Dashboard Code.

### 7. Content nodes (×3)

Fetch a random item from the `content` Redis list. Chain: Content Length → Content Index → Content Item.

**Content Length** (HTTP Request, "Continue on error"):
- Method: `GET`
- URL: `https://YOUR_UPSTASH_HOST/llen/content`
- Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
- Returns: `{ "result": 42 }`

**Content Index** (Code):
```js
const count = $('Content Length').item.json.result || 0;
const idx = count > 0 ? Math.floor(Math.random() * count) : 0;
return { idx };
```

**Content Item** (HTTP Request, "Continue on error"):
- Method: `GET`
- URL (expression): `https://YOUR_UPSTASH_HOST/lindex/content/{{ $('Content Index').item.json.idx }}`
- Headers: `Authorization: Bearer YOUR_UPSTASH_TOKEN`
- Returns: `{ "result": "{\"type\":\"joke\",\"text\":\"...\"}" }` — result is a JSON string

### 8. Merge node
- Mode: `Append`
- Inputs: all 4 Calendar nodes + Icon Library + Weather Request + Upstash GET + Content Item (9 total)
- Ensures all branches have executed before Dashboard Code runs
- **Do not use "Combine by position"** — it tries to pair items across branches and fails when branch item counts differ. Dashboard Code references each upstream node by name directly, so Append is correct.

### 9. Dashboard Code node (Code)

- **Mode: `Run once for all items`** — required because Merge Final outputs one item per branch. In per-item mode n8n tries to pair each item back to its source node and fails. In all-items mode the node runs once and references upstream nodes directly by name with `.first().json`.

References all original nodes by name (not Merge).

```js
const icons = $('Icon Library').first().json;

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

const { night_mode, timeMin: targetDate } = $('Date Prep').first().json;

// Weather — defensive against API errors and network failures
const weatherRaw = $('Weather Request').first().json;
let weather;
if (weatherRaw.error || !weatherRaw.current) {
  weather = {
    temp: null, code: null, max_temp: null, daily_code: null, icon: null, condition: null,
    feels_like: null, max_feels_like: null,
    tomorrow_max_temp: null, tomorrow_daily_code: null, tomorrow_icon: null, tomorrow_condition: null,
    tomorrow_max_feels_like: null,
  };
} else {
  const code     = weatherRaw.current.weather_code;
  const tmrwCode = weatherRaw.daily.weather_code[1];
  weather = {
    // today
    temp:           weatherRaw.current.temperature_2m,
    code,
    max_temp:       weatherRaw.daily.temperature_2m_max[0],
    daily_code:     weatherRaw.daily.weather_code[0],
    icon:           icons[WMO_ICON[code]] || null,
    condition:      WMO_LABEL[code] || 'Weather',
    feels_like:     weatherRaw.current.apparent_temperature,
    max_feels_like: weatherRaw.daily.apparent_temperature_max[0],
    // tomorrow
    tomorrow_max_temp:       weatherRaw.daily.temperature_2m_max[1],
    tomorrow_daily_code:     tmrwCode,
    tomorrow_icon:           icons[WMO_ICON[tmrwCode]] || null,
    tomorrow_condition:      WMO_LABEL[tmrwCode] || 'Weather',
    tomorrow_max_feels_like: weatherRaw.daily.apparent_temperature_max[1],
  };
}

// Calendar — extract all-day event icons per member, strictly on the target date
// Google Calendar returns multi-day events that start before timeMin, so filter by exact date
const targetDateStr = targetDate.slice(0, 10);
function memberIcons(nodeName) {
  const raw = $(nodeName).first().json;
  if (raw.error || !raw.items) return [];
  return raw.items
    .filter(e => e.start && e.start.date === targetDateStr)
    .map(e => {
      const key = Object.keys(icons).find(k => k.toLowerCase() === (e.summary || '').toLowerCase());
      return key ? { svg: icons[key] } : { text: e.summary || '' };
    })
    .filter(e => e.svg || e.text);
}

// family always contains the relevant day's events (today or tomorrow)
// depending on what Date Prep targeted — no separate family_tomorrow needed
const family = [
  { member: "Ulysse", icons: memberIcons('Ulysse Calendar') },
  { member: "Mia",    icons: memberIcons('Mia Calendar') },
  { member: "Maman",  icons: memberIcons('Maman Calendar') },
  { member: "Papa",   icons: memberIcons('Papa Calendar') },
];

// Bons Points — read from Upstash GET node
const upstashRaw = $('Upstash GET').first().json;
const bonusPoints = parseInt(upstashRaw?.result ?? 0, 10) || 0;

// Generic random integer 0–999. Liquid derives all random features from it via modulo.
const random = Math.floor(Math.random() * 1000);

// Content (jokes, facts, quizzes) — fetched from Redis list by Content Item node
const contentRaw = $('Content Item').first().json;
let content = { type: 'fact', text: '', answer: null };
if (contentRaw.result) {
  try {
    // Upstash stores the value as a JSON string, so double-parse is needed
    const parsed = JSON.parse(JSON.parse(contentRaw.result));
    content = { type: parsed.type || 'fact', text: parsed.text || '', answer: parsed.answer || null };
  } catch (e) {}
}

return [{ json: { weather, family, bonusPoints, random, content, night_mode } }];
```

`icons: []` means no events → Liquid renders `—` placeholder.

## JSON shape exposed to Terminus

```json
{
  "weather": {
    "temp": 14.2, "code": 2, "max_temp": 19.4, "daily_code": 2, "icon": "<svg...>", "condition": "Cloudy",
    "feels_like": 12.8, "max_feels_like": 17.1,
    "tomorrow_max_temp": 22.1, "tomorrow_daily_code": 0, "tomorrow_icon": "<svg...>", "tomorrow_condition": "Clear",
    "tomorrow_max_feels_like": 20.3
  },
  "family": [
    { "member": "Ulysse", "icons": [{ "svg": "<svg...>" }] },
    { "member": "Mia",    "icons": [] },
    { "member": "Maman",  "icons": [{ "svg": "<svg...>" }] },
    { "member": "Papa",   "icons": [] }
  ],
  "bonusPoints": 4,
  "random": 317,
  "content": { "type": "quiz", "text": "Capitale de l'Australie ?", "answer": "Canberra" },
  "night_mode": true
}
```

## Template Variables

| Data | Variable |
|---|---|
| Night mode flag | `{{ source.night_mode }}` — `true` from 05:00, `false` 00:00–04:59 |
| Current temp | `{{ source.weather.temp }}` |
| Weather code | `{{ source.weather.code }}` |
| Max temp today | `{{ source.weather.max_temp }}` |
| Daily weather code | `{{ source.weather.daily_code }}` |
| Weather icon (SVG) | `{{ source.weather.icon }}` |
| Weather condition | `{{ source.weather.condition }}` |
| Current feels like | `{{ source.weather.feels_like }}` |
| Max feels like today | `{{ source.weather.max_feels_like }}` |
| Max temp tomorrow | `{{ source.weather.tomorrow_max_temp }}` |
| Tomorrow weather code | `{{ source.weather.tomorrow_daily_code }}` |
| Tomorrow icon (SVG) | `{{ source.weather.tomorrow_icon }}` |
| Tomorrow condition | `{{ source.weather.tomorrow_condition }}` |
| Max feels like tomorrow | `{{ source.weather.tomorrow_max_feels_like }}` |
| Family rows | `{% for m in source.family %}` — always the relevant day |
| Member name | `{{ m.member }}` |
| Member icons | `{% for icon in m.icons %}{{ icon.svg }}{% endfor %}` |
| Bons Points count | `{{ source.bonusPoints }}` |
| Random 0–999 | `{{ source.random }}` — derive with `modulo: N` |
| Content type | `{{ source.content.type }}` — `joke`, `fact`, or `quiz` |
| Content text | `{{ source.content.text }}` |
| Content answer | `{{ source.content.answer }}` — present only for quizzes |

## Day/Night Mode

The dashboard has two visual and content modes driven by time of day (Paris timezone).

| Mode | Hours | Look | Weather | Calendar |
|---|---|---|---|---|
| Day | 00:00–16:59 | White background | Today's forecast | Today's events |
| Night | 17:00–23:59 | Inverted (black bg) | Tomorrow's forecast | Tomorrow's events |

`night_mode` is computed once in Date Prep (alongside the calendar date range) and read by Dashboard Code, which passes it through to the Liquid template as `source.night_mode`.

### Visual inversion (Liquid template)

Add this in the `<head>` of the template. The CSS invert is applied before Ferrum takes the screenshot, so the existing MiniMagick monochrome pipeline handles it transparently — no Terminus core changes needed.

```liquid
{% if source.night_mode %}
<style>
  html { background: #000; }
  body { filter: invert(1); }
</style>
{% endif %}
```

### Content branching (Liquid template)

`source.family` already contains the relevant day's events. The only branching needed is for labels and which weather slot to show:

```liquid
{% if source.night_mode %}
  <small>tomorrow</small>
  {{ source.weather.tomorrow_icon }} {{ source.weather.tomorrow_max_temp }}°
{% else %}
  <small>today</small>
  {{ source.weather.icon }} {{ source.weather.max_temp }}°
{% endif %}

{% for m in source.family %}…{% endfor %}
```

### Testing night mode

To test without waiting for 17:00, temporarily hardcode `night_mode` in Date Prep's return:

```js
return [{ json: { timeMin: ..., timeMax: ..., night_mode: true } }]; // remove override after testing
```

Then trigger the webhook manually and check the generated image in the Terminus UI.

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

## Content Pool (jokes, facts, quizzes)

Items live in an Upstash Redis **List** at key `content`. Each item is a JSON string.

**Item format:**
```json
{ "type": "joke", "text": "Pourquoi les plongeurs plongent en arrière ? Parce que sinon ils tomberaient dans le bateau." }
{ "type": "fact", "text": "Les pieuvres ont trois cœurs." }
{ "type": "quiz", "text": "Capitale de l'Australie ?", "answer": "Canberra" }
```

**Add an item** (Upstash console → CLI, or curl):
```bash
curl -X POST https://YOUR_UPSTASH_HOST/rpush/content \
  -H "Authorization: Bearer YOUR_UPSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["{\"type\":\"joke\",\"text\":\"Votre blague ici.\"}"]'
```

**View all items:** Upstash console → Data Browser → key `content`

**Remove an item:** use `LREM` or edit directly in the console.

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
