# Vendored: @posthog/hedgehog-mode

`src/` and `assets/` here are an unmodified copy of PostHog's
[hedgehog-mode](https://github.com/PostHog/hedgehog-mode) engine.

- Source: `hedgehog-mode/` package in that repo
- Pinned to commit `73cb168` (`origin/main`, version `0.0.52`)

## Why vendored instead of the npm package

The published `@posthog/hedgehog-mode` dist pre-bundles its own copy of pixi.js. pixi
generates shaders with `new Function`, which MV3 content scripts forbid, and because the
bundled pixi is internal we can't apply pixi's `unsafe-eval` polyfill to it. Compiling the
engine from source lets it share this extension's single pixi.js, which `src/content.jsx`
then patches (eval-free shaders + no blob-worker texture loading) so it runs on any page.

## Updating

Re-copy `src/` and `assets/` from a newer upstream checkout and update the commit above.
Keep the copy unmodified — all extension-specific glue lives in `../../src`.
