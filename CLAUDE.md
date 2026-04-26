# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Terminus is a Ruby/Hanami 2.x web server for self-hosting TRMNL e-ink devices (BYOS — Build Your Own Server). It manages devices, playlists, extensions (plugins), firmware, and renders screens as images for connected devices.

**Stack:** Ruby 4.0.2, Hanami 2.3, PostgreSQL (ROM/Sequel ORM), Valkey/Redis (Sidekiq), Puma, Sidekiq, htmx, Alpine.js, esbuild.

## Upstream Compatibility

This repo is a fork of the upstream Terminus project. Avoid modifying core files wherever possible to minimize merge conflicts when pulling upstream changes. Prefer adding new files (new actions, aspects, views, CSS pages, etc.) over editing existing ones. When a change to a core file is unavoidable, keep the diff minimal and localized.

## User-owned Files

The following are created and maintained by the user and can be freely modified:

- `doc/` — all documentation, including `doc/dashboard/` which contains the personal dashboard setup
- `assets/` — icons and images used by the dashboard

Key dashboard files:
- `doc/dashboard/template.html` — the Liquid template pasted into the Terminus extension UI
- `doc/dashboard/n8n_workflow.md` — full n8n workflow documentation (webhook, nodes, JSON shape)

## Commands

```bash
# Initial setup
bin/setup

# Development server (requires Overmind)
overmind start --port-step 10 --procfile Procfile.dev --can-die assets,migrate

# Console
bin/console

# All quality checks + tests (default rake task)
bin/rake

# Tests only
bin/rspec

# Run a single spec
bin/rspec spec/features/devices_spec.rb

# Quality checks only
bin/rake quality   # git_lint + reek + rubocop + hadolint

# Database migrations
bin/hanami db migrate

# Asset compilation (watch mode handled by Procfile.dev)
bundle exec hanami assets watch
```

## Architecture

### Hanami 2 Conventions

- **Actions** (`app/actions/`): Handle HTTP requests. Base class `Terminus::Action` includes Rodauth-based authentication via a `before :authorize` callback. API actions inherit from `app/actions/api/base.rb`.
- **Views** (`app/views/`): Hanami views. Base class `Terminus::View`.
- **Contracts** (`app/contracts/`): `dry-validation` contracts for input validation. Base class `Terminus::Contract` uses i18n for messages.
- **Relations** (`app/relations/`): ROM SQL relations extending `Terminus::DB::Relation`.
- **Repositories** (`app/repositories/`): ROM repos extending `Terminus::DB::Repository` (wraps `Hanami::DB::Repo`).
- **Structs** (`app/structs/`): Immutable ROM structs extending `Terminus::DB::Struct`.
- **Jobs** (`app/jobs/`): Sidekiq workers. Base class `app/jobs/base.rb`.

### Aspects

`app/aspects/` contains domain logic/service objects that don't fit neatly into actions or repositories. Organized by domain (devices, extensions, screens, playlists, etc.). This is where business logic like image rendering, template fetching, and data synchronization lives.

### Slices

`slices/` contains isolated Hanami slices:
- `slices/authentication/`: Rodauth-based auth middleware.
- `slices/health/`: `/up` health endpoint.

### Background Jobs

Scheduled via `config/sidekiq_scheduler.yml`. Synchronizers pull data from the TRMNL Core API:
- Screen sync: every 5 minutes (proxied device screens)
- Sensor sync: every minute
- Firmware/fonts/models/palettes: daily or every 6 hours

Disable synchronizers with env vars: `FIRMWARE_SYNCHRONIZER=0`, `MODEL_SYNCHRONIZER=0`, `SCREEN_SYNCHRONIZER=0`.

### Extensions (Plugins)

Extensions are user-defined plugins that fetch data (Poll/Recipe kind) from external URLs and render screens using Liquid templates against the TRMNL Framework. The `app/aspects/extensions/` directory handles fetching, parsing, and rendering.

### CSS Architecture

Pure CSS, no framework. Files live in `app/assets/css/`:
- `bits/`: Reusable components
- `pages/`: Page-specific styles
- `colors`, `defaults`, `layout`, `settings`, `keyframes`, `view-transitions`

### Routes

`config/routes.rb` defines all routes. Two parallel route namespaces exist: `api/` (JSON API consumed by TRMNL device firmware) and UI routes (HTML pages). The `/api/display` endpoint is the key device polling endpoint.

## Testing

Two test helpers:
- `spec/spec_helper.rb`: Unit/integration tests (no Hanami boot).
- `spec/hanami_helper.rb`: Full integration tests using Capybara+Cuprite (Chrome). Require this for `spec/features/` and `spec/requests/`.

Test types are auto-detected by path: `spec/features/` → `:feature` (Capybara), `spec/requests/` → `:request` (Rack::Test).

Factories via `rom-factory` are in `spec/support/factories/`. Coverage enforced at 95% line/branch minimum.

## Logging

Default log level is `INFO`. Set `LOG_LEVEL=debug` for verbose output.
