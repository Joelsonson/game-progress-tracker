# Journey Sprite Guide

Put journey character sprite sheets in this folder.

Recommended workflow:

- Keep your editable source file here too when useful, such as `Walking.ase`
- Export a PNG sprite sheet for the app to load, such as `Walking.png`
- Export JSON metadata if your art tool supports it, such as `Walking.json`
- The app should load the PNG at runtime
- The `.ase` file is for editing, not for direct browser use
- The JSON file is optional helper data for frame count, frame size, and duration

Current app usage:

- The journey preview is currently wired to `assets/journey/sprites/Walking.png`
- The matching `Walking.json` says this sheet is `3072x256`
- That export is `12` frames across
- Each frame is `256x256`
- Each frame duration is `100ms`

Suggested structure:

- `assets/journey/sprites/player/idle.png`
- `assets/journey/sprites/player/walk.png`
- `assets/journey/sprites/player/rest.png`
- `assets/journey/sprites/player/event.png`

Suggested naming:

- `idle` for standing, breathing, or subtle ready stance
- `walk` for side-scrolling travel or exploration
- `rest` for sleeping, sitting, kneeling, or campfire recovery
- `event` for dialogue, surprise, discovery, or special reactions

Recommended sprite-sheet setup:

- 4 to 12 frames per animation
- fixed frame sizes such as `64x64`, `96x96`, `128x128`, or `256x256`
- transparent background PNG
- side-view / side-scrolling character orientation
- one character centered consistently in every frame
- one row per animation if exported as separate sheets
- keep the same proportions, outfit, palette, and facing direction across all animations
- do not trim frames differently from one another if you want the motion to stay stable

LibreSprite / Aseprite export tips:

- export as a horizontal sprite sheet
- keep the background transparent
- disable trimming if possible
- keep frame size fixed across the whole animation
- export JSON data alongside the PNG when you want frame timing recorded
- keep the original `.ase` file so later edits do not require rebuilding from scratch

Visual direction that should read well in this app:

- classic JRPG-inspired side-scrolling pixel art
- clear silhouette first
- slightly exaggerated head and readable pose at small size
- strong contrast and clean shading
- avoid tiny details that disappear on mobile
- keep weapons, capes, hair, and accessories readable but simple
- animation should be easy to understand at a glance

Consistency tips:

- use the exact same character description in every prompt
- keep the same clothing colors and hairstyle every time
- keep the same frame size for every animation
- keep the same side-view angle and same facing direction
- use a reference image from the first successful generation when possible

When swapping the active sprite in the app:

- update the exported PNG in this folder
- if the frame count or timing changed, update the journey sprite constants in `src/features/journey/journeyView.js`
- if the sheet still uses a single horizontal row, the preview should auto-size from the image dimensions

Search terms to find reference styles:

- `side scrolling jrpg pixel character sprite sheet`
- `2d fantasy pixel adventurer side view sprite`
- `jrpg side view walk cycle pixel art`
- `pixel art campfire rest animation side view`
- `fantasy side scrolling character idle sprite sheet`
