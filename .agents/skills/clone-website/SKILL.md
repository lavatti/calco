---
name: clone-website
description: Capture and rebuild one or more approved website URLs in Calco's Astro project, with source evidence, assets, responsive interaction checks, and visual QA. Use when asked to clone or faithfully reproduce a website in Codex.
---

# Clone website in Codex

This is the Codex adapter for Calco's source-first workflow. Run the deterministic scripts directly and use Codex's own file, browser, and editing tools for interpretation and implementation. Do not start Claude Code or execute `.claude/workflows/clone-sections.js`: that file uses Claude-specific `agent()`, `phase()`, and `parallel()` globals. Do not deploy unless the user explicitly asks.

## Input and boundaries

1. Take the exact URL list and output scope from the user's request. Do not crawl extra sites, subdomains, or languages without approval. Treat each approved URL as a separate page; group artifacts by hostname and page path so two pages on one host do not overwrite one another.
2. Check `git status --short`, existing artifacts, `AGENTS.md`, and the user's restrictions before editing. Preserve unrelated changes. Do not commit, push, or deploy by default.
3. Use `npm run setup -- --agent=codex` once per fresh checkout and launch Codex with `npm run codex`, which supplies Playwright MCP without stored project trust. Project MCP servers are also in `.codex/config.toml`; a direct `codex` launch must trust this repository for that config to load. If MCP browser calls are unavailable or blocked, use `npm run browser:capture -- <url> <outDir> [--actions <actions.json>] [--selectors <selectors.json>]` for headless desktop/tablet/mobile evidence. The actions file is an array of `{ "type": "click"|"hover", "selector": "..." }` or `{ "type": "scroll", "pixels": 600 }`. The selectors file is a JSON array of CSS selectors for computed-style extraction. Report a blocker only if neither browser path works.
4. Confirm the unmodified project builds with `npm run build`. When the user requests capture only, stop after evidence and do not build a clone.
5. Define the expected route inventory and at least one desktop and one mobile navigation journey before calling the result a clone. A single captured page is one page, even when the source site has many routes.

## Capture each page before editing Astro

1. Normalize the approved URL and choose a path-safe artifact slug. Run `node scripts/inspection/fetch-source.mjs <url> docs/research/<host>/<slug>/raw`. Keep server HTML and all downloaded CSS as evidence. Run Prettier on `index.html` to produce `index.pretty.html` for inspection.
2. Open the live page in a **headless** browser at 1440, 768, and 390 px. Save full-page and section screenshots under `docs/design-references/<host>/<slug>/`. The `browser:capture` script saves rendered DOM, screenshots, asset/design signals, computed styles, title, headings, links, media, console errors, and failed requests at all three widths. If the page is client rendered, keep its rendered DOM alongside the server response; do not overwrite the latter.
3. Follow `docs/research/INSPECTION_GUIDE.md`. Run the browser payloads in `scripts/inspection/discover-assets.js` and `extract-styles.js` through browser evaluation. Record fonts, palette, spacing, layout frame, exact text, sections, CSS selectors, media URLs, and interactive states. Scroll before clicking to identify scroll-controlled behavior; then test click, hover, keyboard, and mobile states. Record failures and missing resources explicitly.
4. Fill the existing templates `DESIGN.md`, `BEHAVIORS.md`, `PAGE_TOPOLOGY.md`, and one `components/<Name>.spec.md` for every section. Separate observed facts from inferences. A spec must include source range/selector, desktop and mobile screenshot, exact content, styles, assets, states, and the intended Astro file. Do not dispatch or build a section with an incomplete spec.

## Build in Calco's Astro project

1. Build the global frame first in `src/layouts/BaseLayout.astro` and `src/styles/global.css`; integrate actual fonts and design tokens. Use Context7 for current Astro/Tailwind APIs. Preserve site-specific frame details such as gutters, rails, and sticky chrome.
2. Inventory every image layer and build `assets.json`; use `node scripts/download-assets.mjs <manifest>` to download approved assets. Use `scripts/inspection/rewrite-media.mjs` for source media URLs. Record unavailable assets; never silently substitute unrelated imagery.
3. Implement one `.astro` component per completed section spec, then assemble the page in `src/pages/`. Use the captured structure and classes where compatible; translate framework-specific syntax into valid Astro. Reproduce SVG/CSS visuals as code, retain actual copy, and implement observed interactions in scoped client scripts.
4. Keep page routes and evidence isolated when handling several URLs. Do not assume every source site uses Tailwind, is server rendered, or can be reduced to one page. A successful fetch alone is not an Astro clone.
   If source scripts are removed, inspect what they controlled: loading overlays, header colors, menus, lazy media, forms, and transitions. Reproduce required behavior or mark that route incomplete.
5. Run `npm run check` after each meaningful component batch; fix errors before continuing. Run `npm run verify` at the end.

## Compare and report

1. Launch a local Astro preview and capture the same viewports and interaction states as the source. Compare the original and clone section by section: geometry, fonts, color, media, responsive layout, navigation, transitions, and missing resources. Correct deviations and repeat the comparison.
   Create a site-specific smoke config with the captured `pages.json` route inventory and observed desktop/mobile navigation journeys. Run `npm run clone:smoke -- <config.json>` against the local preview. Its route and journey failures block any claim that the clone is working. `npm run verify` checks compilation only.
2. Review changed files for correctness, accessibility, performance, and fidelity. Report which URLs, languages, sections, assets, and interactions were actually captured and verified; list gaps honestly. Do not equate source snapshots or a passing build with visual parity.
3. Keep any user-specific project approval and deployment gates outside this generic skill. Do not create speculative claims, routes, or content during reproduction.
