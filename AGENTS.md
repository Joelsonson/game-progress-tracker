# Game Tracker AI Guide

Read this file first before making changes. Use it as the routing map for what to inspect and edit.

## Purpose

- This app is a single-page vanilla JS tracker with modular feature folders.
- The app is intentionally mobile-only now, even on desktop-sized screens.
- `index.html` is the shell.
- `src/main.js` wires startup, rendering, and feature event binding.
- `styles/` is split by responsibility, not by feature.

## Architecture Rules

- Views render HTML.
- Controllers handle clicks, form submits, and user-triggered updates.
- Engine/service modules hold rules, calculations, and feature logic.
- Repo/data modules only read and write persisted data.
- Shared formatting and small utility helpers live in `src/core/`.

## App Map

### Entry

- `src/main.js`
  - App boot
  - Global event binding
  - Full render pass

### Data Layer

- `src/data/db.js`
  - IndexedDB schema
  - record normalization
  - raw persistence helpers
- `src/data/gamesRepo.js`
  - game reads/writes
- `src/data/sessionsRepo.js`
  - session reads/writes
- `src/data/metaRepo.js`
  - meta reads/writes

### Core Shared Files

- `src/core/constants.js`
  - shared constants and feature metadata
  - journey weapon metadata
  - journey bag metadata
- `src/core/dom.js`
  - cached DOM references
- `src/core/state.js`
  - lightweight app state
- `src/core/formatters.js`
  - formatting, summaries, sorting, shared helpers
- `src/core/ui.js`
  - generic UI helpers like messages and deck scrolling

### Features

- `src/features/navigation/navigation.js`
  - screen switching for the always-mobile single-screen flow

- `src/features/games/gamesController.js`
  - add game
  - tracker list actions
  - art picker routing for games
- `src/features/games/gamesView.js`
  - stats
  - main quest
  - tracker cards
  - completion spotlight

- `src/features/sessions/sessionsController.js`
  - log session flow
- `src/features/sessions/sessionsView.js`
  - recent sessions UI
  - session target dropdown
  - sessions screen ordering is:
    - log session
    - add game panel
    - recent sessions

- `src/features/journey/journeyController.js`
  - journey clicks
  - modal actions
  - user-triggered journey updates
  - character equipment actions like equip, replace, and discard
- `src/features/journey/journeyEngine.js`
  - idle journey state sync
  - progression rules
  - event generation
  - simulation
  - inventory rules
  - bag carry limits
  - weapon rewards and stat bonuses
- `src/features/journey/journeyView.js`
  - home journey UI
  - journey screen UI
  - character sheet UI
  - journey modals
- `src/features/journey/journeyEvents.js`
  - event and choice normalization

- `src/features/art/imageCropper.js`
  - crop modal flow
  - file reading
  - image loading
- `src/features/art/completionCard.js`
  - completion card canvas rendering
  - blob download helpers

- `src/features/backup/backupController.js`
  - export/import
  - reset and clear data actions

## Style Map

- `styles/tokens.css`
  - CSS variables only
  - book-like color palette and light/dark theme tokens
- `styles/base.css`
  - reset, typography, body, inputs, buttons, base form elements
- `styles/layout.css`
  - grids, stacks, panel layout, shared spacing structures
- `styles/components.css`
  - cards, badges, modals, journey widgets, reusable pieces
- `styles/screens.css`
  - responsive behavior and screen-specific layout adjustments

## Change Routing

### If the request is about navigation or screen switching

- Read `src/main.js`
- Read `src/features/navigation/navigation.js`
- Check `index.html` for the always-mobile screen order:
  - Home
  - Journey
  - Character
  - Tracker
  - Sessions
- Check `styles/screens.css`

### If the request is about adding or editing games

- Read `src/features/games/gamesController.js`
- Read `src/features/games/gamesView.js`
- Check `index.html` because the add game panel now lives inside the Sessions screen
- Read `src/data/gamesRepo.js`
- Check `src/core/formatters.js` for shared summaries or sorting

### If the request is about session logging or session summaries

- Read `src/features/sessions/sessionsController.js`
- Read `src/features/sessions/sessionsView.js`
- Check `index.html` because the Sessions screen now also contains the add game panel and settings panel
- Read `src/data/sessionsRepo.js`
- Check `src/core/formatters.js`

### If the request is about idle journey behavior

- Read `src/features/journey/journeyEngine.js` first
- Then read `src/features/journey/journeyController.js`
- Then read `src/features/journey/journeyView.js`
- If events are involved, also read `src/features/journey/journeyEvents.js`

### If the request is about journey UI only

- Read `src/features/journey/journeyView.js`
- Note that the RPG UI is now split:
  - Journey screen for travel progress, events, and travel log
  - Character screen for portrait, health, hunger, stats, class, radar chart, and inventory
- Check `styles/components.css`
- Check `styles/screens.css`

### If the request is about the character sheet or RPG build UI

- Read `src/features/journey/journeyView.js`
- Read `src/features/journey/journeyController.js`
- Read `src/features/journey/journeyEngine.js`
- Read `src/core/constants.js` for weapon and bag metadata
- Check `styles/components.css`
- Check `styles/screens.css`

### If the request is about journey sprites or animation previews

- Read `src/features/journey/journeyView.js`
- Check `styles/components.css`
- Read `assets/journey/sprites/README.md`
- The browser runtime should use exported PNG sprite sheets, not `.ase` source files
- Keep `.ase` files in the repo as editable source when helpful
- JSON sprite metadata is optional reference data for frame count, frame size, and timing
- The travel animation preview is wired from `assets/journey/sprites/Walking.png`
- The character portrait is wired from `assets/journey/sprites/Idlethink.png`

### If the request is about image cropping, art uploads, or completion cards

- Read `src/features/art/imageCropper.js`
- Read `src/features/art/completionCard.js`
- If the art belongs to a game flow, also read `src/features/games/gamesController.js`

### If the request is about import, export, backup, or reset behavior

- Read `src/features/backup/backupController.js`
- Read `src/data/metaRepo.js`
- Read `src/data/db.js`

### If the request is about app-wide progress, summaries, or percentages

- Read `src/main.js`
- Read `src/core/formatters.js`
- Read the relevant feature view:
  - games: `src/features/games/gamesView.js`
  - sessions: `src/features/sessions/sessionsView.js`
  - journey: `src/features/journey/journeyView.js`

## Editing Guidance

- Prefer the smallest layer that matches the request.
- Do not put data writes into views.
- Do not put DOM rendering into repo files.
- If a rule change affects text and numbers, update the engine/helper first, then update the view copy.
- If UI text references a computed value, verify whether the calculation lives in `src/core/formatters.js` or a feature engine before changing the markup.
- For journey sprite changes, update the asset in `assets/journey/sprites/` first, then verify any frame count or timing constants in `src/features/journey/journeyView.js`.
- Keep the journey screen focused on travel-state UI and the character screen focused on character-sheet UI unless the request explicitly merges them again.
- Keep equipment rules, bag sizes, weapon bonuses, and carry limits inside `src/features/journey/journeyEngine.js` and `src/core/constants.js`, not inside the view.
- Do not add separate desktop layouts unless the user explicitly asks for desktop support again.

## Prompt Shortcut

When asking AI for changes in this repo, start with:

`Read AGENTS.md first, then update ...`

That should be enough to route the change to the right files quickly.
