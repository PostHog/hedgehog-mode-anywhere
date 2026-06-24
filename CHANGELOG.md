# Changelog

## Unreleased

- Depend on `@posthog/hedgehog-mode@0.0.53` directly instead of vendoring its source; removes `vendor/`. This release externalizes pixi.js ([PostHog/hedgehog-mode#30](https://github.com/PostHog/hedgehog-mode/pull/30))

## 2026-06-22 (later)

- Bumped the vendored engine to upstream `73cb168` (v0.0.52): Spiderhog now slings a visible web (click to sling, hold + W/S to climb) and the skin system was refactored upstream

## 2026-06-22

- Replaced the hand-rolled engine with PostHog's official [hedgehog-mode](https://github.com/PostHog/hedgehog-mode) engine (pixi.js + matter-js), vendored as source under `vendor/hedgehog-mode/`
- Added an esbuild build step that bundles the content script and popup (`npm install && npm run build`)
- Patched pixi.js for MV3 / strict-CSP pages: eval-free shaders (`pixi.js/unsafe-eval`) and main-thread texture loading (no blob Web Worker)
- Two new skins (Hogzilla, Ghost), `rainbow` color, and extra secret codes (`spawn`, `chaos`, `hello`, `giant`, `tiny`, `slow`, `fast`, `cheatcodes`, `death`) from the upstream engine
- In-page message bubbles and cheat sheet
- Popup previews now render from the engine's spritesheet via `StaticHedgehog`
- Removed the custom physics, sprite loop, sound effects, and `shared.js`/`content.css`

## 2026-01-30

- Per-site toggle to disable hedgehog on specific websites
- Sound effects for jump, land, and fire (Web Audio API)
- Spiderhog web line visual during web-slinging
- Cross-tab config sync via `chrome.storage.onChanged`
- ARIA labels, focus outlines, keyboard navigation
- Extracted shared constants into `shared.js`
- Replaced magic numbers with named constants
- Deduplicated accessory selection logic
- Larger preview grid items
- Fixed global enable and per-site toggle interfering with each other
- Fixed hedgehog teleporting after browser lag spikes

## 2026-01-24

- Added demo GIF to README

## 2026-01-23

- Animated hedgehog buddy on any website
- Drag, throw, walk, jump, and double jump
- Spiderhog, Robohog skins and 10 color filters
- 16 accessories (headwear, eyewear, other)
- Secret keyboard codes
- Settings persist via `chrome.storage.sync`
- Dark theme popup with preview card
- Skin, color, and accessory grids
- Toggle pills for options
- Optimized animation loop with FPS throttling
- Cached ground element queries, sprite URLs, and filter values
