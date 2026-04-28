# Dashboard

Personal TRMNL dashboard — 2×3 grid of 240×240px zones on an 800×480 display.

## Extension Configuration

- **Kind**: `poll`
- **URIs**: one single URI → `http://<host>:5678/webhook/dashboard`
- Since there is only one URI, Terminus exposes data as `source` (not `source_1`, `source_2`)

All data — weather, calendar, bonus points, content — flows through n8n. See `n8n_workflow.md` for setup.

## Grid

```
800×480px canvas. Outer padding: 0px top/bottom, 40px left/right.
Zones: 240×240px each. Column gap: 20px. Row divider: 1px solid.
Inner padding: 16px standard.

┌───────────┬───────────┬───────────┐
│   date    │  weather  │   wheel   │  row 1 (240px)
├───────────┼───────────┼───────────┤  1px divider
│ bons-pts  │  family   │  content  │  row 2 (240px)
└───────────┴───────────┴───────────┘
  40px margin              40px margin
```

Edit `grid-template-areas` in the template to reorder zones.

## Day / Night Mode

| Mode | Hours (Paris) | Look | Weather | Calendar |
|---|---|---|---|---|
| Day | 00:00–16:59 | White bg | Today | Today |
| Night | 17:00–23:59 | Inverted (black bg) | Tomorrow | Tomorrow |

`night_mode` is computed in the n8n Date Prep node and passed through as `source.night_mode`.

## Zones

### date (top-left)

Displays day of week and date in French, current time, and tonight's bed owner (Maman/Papa) with a moon icon. Shows a random pixel-art invader sprite in the middle when available.

- Day/month names computed via Liquid lookup arrays (no server locale dependency)
- Bed owner alternates every 2 days from a stored anchor date in Upstash Redis

### weather (top-center)

Two weather slots: current conditions + today's (or tomorrow's in night mode) max feels-like.

| Variable | Description |
|---|---|
| `source.weather.temp` | Current temperature (°C) |
| `source.weather.feels_like` | Current apparent temperature |
| `source.weather.code` | Current WMO weather code |
| `source.weather.icon` | Current condition SVG (inline string) |
| `source.weather.max_temp` | Today's max temperature |
| `source.weather.max_feels_like` | Today's max apparent temperature |
| `source.weather.daily_code` | Today's daily WMO code |
| `source.weather.tomorrow_*` | Same fields for tomorrow |

WMO code → icon key: 0–1=`sun`, 2–3=`cloud`, 51–82=`rain`/`snow`, 95–99=`storm`.

### wheel (top-right)

Split zone: 56px clothing column on the left, spinning wheel on the right.

**Clothing column** — 4 SVG icons stacked (hat → top → bottom → feet), selected by n8n Dashboard Code based on the day's forecast:
- Rain/snow (WMO 51–82): full rain set regardless of temperature
- Otherwise: each item independently chosen by max feels-like thresholds

| Position | Cold | Hot |
|---|---|---|
| Hat | < 8°C | > 28°C |
| Top | < 12°C | > 25°C |
| Bottom | < 10°C | > 27°C |
| Feet | < 10°C | > 24°C |

Source SVGs: `assets/img/clothes/*.svg`. Build with `ruby scripts/build_clothes_library.rb`.

**Wheel** — decorative spinner. Angle = `source.random % 8 * 45°`.

### bons-points (bottom-left)

Weekly bonus point counter (0–10). Circular progress ring with the count displayed large in the center. When the goal is reached the counter disappears and a gift icon appears inside the completed ring.

Counter is stored in Upstash Redis. Increment/decrement via the Counter Up n8n workflow. Resets every Monday at 00:00 Paris time.

### family (bottom-center)

One row per family member with their calendar events for the day (or tomorrow in night mode) shown as SVG icons. Unknown event titles fall back to plain text.

| Variable | Description |
|---|---|
| `source.family[].member` | Member name |
| `source.family[].icons[].svg` | Event icon SVG string (if matched) |
| `source.family[].icons[].text` | Event title fallback (if no icon match) |

Calendar icons are matched case-insensitively against `assets/icons/*.svg` filenames. Add icons with `ruby scripts/build_icon_library.rb`.

### content (bottom-right)

Random item from a Redis list: joke, fact, or quiz (with answer).

| Variable | Description |
|---|---|
| `source.content.type` | `joke`, `fact`, or `quiz` |
| `source.content.text` | Main text |
| `source.content.answer` | Answer (quiz only) |

Add items via `curl` to Upstash `rpush/content`. See `n8n_workflow.md` for format.

## Files

| File | Purpose |
|---|---|
| `template.html` | Full Liquid template — paste into Terminus extension UI |
| `n8n_workflow.md` | Complete n8n workflow setup and node-by-node reference |
| `icon_library.js` | Generated — paste into n8n Icon Library node |
| `clothes_library.js` | Generated — paste into n8n Clothes Library node |
| `README.md` | This file |

## Build Scripts

```bash
ruby scripts/build_icon_library.rb    # regenerate icon_library.js from assets/icons/*.svg
ruby scripts/build_clothes_library.rb # regenerate clothes_library.js from assets/img/clothes/*.svg
```

## Notes

- Terminus HTTP client does not follow redirects — use n8n as a proxy for any service that redirects
- Fly.io migration: update extension URI to public n8n URL, update `WEBHOOK_URL` in n8n env
