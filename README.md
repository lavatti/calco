<p align="center">
  <img src="assets/brand/banner.svg" alt="Calco — clone any production website into a clean Astro codebase" width="100%" />
</p>

<p align="center">
  <a href="https://qvacode-ltda.github.io/calco/"><img src="https://img.shields.io/badge/live_demo-tailwindcss.com_clone-22D3EE?style=flat-square&labelColor=0A0E1A" alt="Live demo" /></a>
  <img src="https://img.shields.io/badge/Astro-7-F4F7FB?style=flat-square&labelColor=0A0E1A&logo=astro&logoColor=22D3EE" alt="Astro 7" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-F4F7FB?style=flat-square&labelColor=0A0E1A&logo=tailwindcss&logoColor=22D3EE" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F4F7FB?style=flat-square&labelColor=0A0E1A&logo=cloudflareworkers&logoColor=22D3EE" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Claude_Code-driven-F4F7FB?style=flat-square&labelColor=0A0E1A&logo=claude&logoColor=22D3EE" alt="Claude Code" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-F4F7FB?style=flat-square&labelColor=0A0E1A" alt="MIT license" /></a>
</p>

<p align="center"><b>English</b> · <a href="README.es.md">Español</a></p>

# Calco

**Clone any production website into a clean, static Astro codebase you own.**

_Calco_ is Spanish for a tracing, an exact copy. Point it at a URL from Codex or Claude Code and it
captures the site's real HTML and CSS, extracts the design system into auditable artifacts,
and rebuilds the page section by section as an [Astro 7](https://astro.build) +
[Tailwind CSS v4](https://tailwindcss.com) project that deploys to Cloudflare in one command.

## Why founders use this

A serious company's production website is not a mockup. It is the surviving result of months
of design, UX and conversion research — every spacing decision, every headline hierarchy,
every interaction already tested against real traffic. Calco turns that validated ground into
your starting codebase:

- **Speed with validated results.** A pixel-perfect rebuild in hours, not a redesign project
  in weeks. Start from patterns that already work, then make them yours.
- **Real code, not a scrape.** Clean `.astro` components, design tokens in `@theme`,
  self-hosted assets, vanilla JS + GSAP for motion. Zero framework runtime by default.
- **Production-ready by default.** TypeScript strict, ESLint, Prettier, SEO shell, and a
  one-command Cloudflare Workers deploy are already wired.

## Proof

Judge it yourself — we pointed Calco at one of the hardest homepages on the internet:

|              |                                                                        |
| ------------ | ---------------------------------------------------------------------- |
| **Original** | <https://tailwindcss.com>                                              |
| **Clone**    | <https://qvacode-ltda.github.io/calco/> (upstream demo) |
| **Source**   | [`examples/tailwindcss.com`](examples/tailwindcss.com)                 |

Everything in the demo is rebuilt as real code: the hatch-rail frame, the live bento demo
components, the inline-SVG sponsor logos, the fonts. No screenshots, no iframes.

## Quick start

You need **Node 20+** (22 recommended) and either **Codex CLI** or **Claude Code**.

### Codex

```bash
git clone https://github.com/lavatti/calco my-site && cd my-site
npm run setup -- --agent=codex
npm run codex
# In the Codex session: $clone-website https://example.com
```

The launcher supplies Playwright MCP immediately. If you start `codex` directly, trust this
repository so its project-local [`.codex/config.toml`](.codex/config.toml) loads the Playwright
and Context7 MCP servers. The Codex skill is
[`.agents/skills/clone-website/SKILL.md`](.agents/skills/clone-website/SKILL.md); it uses the
same capture, asset, Astro, and QA scripts directly. It does not invoke Claude Code or the
Claude-only worktree workflow. To check the CLI prerequisites without installing dependencies,
run `npm run setup -- --agent=codex --check`. Check the launcher with
`npm run codex -- mcp list`. Deployment is a separate, explicit step.

If this Codex environment blocks MCP browser calls, use Calco's direct headless capture:

```bash
npm run browser:capture -- https://example.com docs/design-references/example.com/home
```

It saves screenshots, rendered HTML, assets and design signals, and computed styles at 1440,
768, and 390 px, plus `inspection.json` with links, media, errors, failed requests, and HTTP
4xx/5xx resources. Pass `--actions actions.json` to capture click, hover, or scroll states,
and `--selectors selectors.json` to extract styles for specific sections. The Codex skill uses
this evidence when MCP is unavailable.

Calco is an **agent-guided rebuilding kit**, not an automatic full-site mirror. A capture command
records one URL. For a multi-page job, first agree the route scope, save each page, build its
Astro route, and verify the links and interactions that connect those pages.

### Claude Code

```bash
# 1. Get the code — or click "Use this template" on GitHub
git clone https://github.com/lavatti/calco my-site && cd my-site

# 2. Install everything: deps + the Playwright browser used for extraction
npm run setup -- --agent=claude

# 3. Open Claude Code and clone your first site
claude
/clone-website https://example.com

# 4. Ship it
npm run deploy        # astro build && wrangler deploy
```

Claude Code reads [`.mcp.json`](.mcp.json) for Playwright and Context7. Codex reads the
project config above when the folder is trusted.

## How it works

Calco is **source-first**: it works from the target's real markup, never from screenshots or
memory. The `/clone-website` skill orchestrates five phases:

1. **Capture** — `scripts/inspection/fetch-source.mjs` snapshots the real HTML + CSS to disk.
2. **Extract** — the `design-extractor` agent distills tokens, fonts, assets and behaviors
   into auditable artifacts (`DESIGN.md`, `BEHAVIORS.md`, per-section specs).
3. **Build** — `astro-builder` agents rebuild the global frame and each section from the real
   markup, fanned out in parallel git worktrees (max 3 at once, auto-retry on failure).
4. **Assemble** — merge worktrees, batch-download assets, wire fonts and SEO.
5. **QA** — the `design-critic` agent screenshots clone vs original at 1440 and 390 and flags
   every fidelity gap; `npm run verify` gates types, lint and build. A separate browser smoke
   check validates routes and the site-specific navigation journeys.

| Agent              | Role                                                      |
| ------------------ | --------------------------------------------------------- |
| `design-extractor` | inspects the live site → tokens, assets, behaviors, specs |
| `astro-builder`    | builds one `.astro` component from a spec                 |
| `code-reviewer`    | reviews the diff for correctness, a11y, perf, fidelity    |
| `design-critic`    | visual QA diff against the original + "AI slop" audit     |
| `commit-crafter`   | Conventional Commits grouped by change                    |

Extraction is deterministic where possible: color conversion, style capture and downloads run
in Node/browser scripts (`scripts/inspection/*`), so the model spends tokens on judgment, not
grunt work. See [`docs/research/INSPECTION_GUIDE.md`](docs/research/INSPECTION_GUIDE.md).

## Commands

**In Claude Code:** `/clone-website <url>` · `/extract-design <url>` · `/build-section <spec>`
· `/review` · `/qa <url>` · `/refine` · `/commit` · `/deploy`

**In Codex:** `$clone-website <url>`; follow the same source-first phases in the Codex skill.

**npm scripts:**

| Script                            | Does                                          |
| --------------------------------- | --------------------------------------------- |
| `setup`                           | install deps + Playwright browser, run checks |
| `codex`                           | start Codex with Playwright MCP               |
| `browser:capture`                 | headless screenshots and rendered DOM         |
| `clone:smoke <config.json>`       | route inventory + desktop/mobile browser journeys |
| `dev` / `build` / `preview`       | Astro dev / build → `dist/` / preview         |
| `check` / `lint` / `format`       | `astro check` / ESLint / Prettier             |
| `verify`                          | check + lint + build (run before shipping)    |
| `deploy` / `cf:preview`           | `wrangler deploy` / local Workers preview     |
| `assets:download <manifest.json>` | batch-download clone assets (concurrency 3)   |

Before reporting a clone as working, create a site-specific JSON smoke config with `baseUrl`,
`routesFile` (a `pages.json` containing captured `path` and `status` values), and `journeys`.
Start from [`clone-smoke.example.json`](docs/research/templates/clone-smoke.example.json) and replace its example selectors, paths, and route count with observed values for the target site.
Each journey names an entry `path`, desktop or mobile `viewport`, optional `visible`/`hidden`
selectors and expected CSS values, `hover`/`click` steps, and an `expectPath`. Run
`npm run clone:smoke -- <config.json>` against the local preview. The command checks every
captured route for HTML HTTP 200 and walks the named browser journeys, writing screenshots
and `report.json`. Compilation success alone does not pass this gate.

## What you get

```
src/
  pages/            # routes (index.astro → /)
  layouts/          # BaseLayout.astro (HTML shell + SEO)
  components/       # section components + icons/ (extracted SVGs)
  styles/global.css # @import "tailwindcss" + @theme tokens (the design contract)
scripts/
  inspection/       # deterministic extraction: source capture, styles, colors
  setup.mjs         # one-shot environment setup
  codex.mjs         # Codex launcher with Playwright MCP
.claude/            # agents, skills, commands, workflows for the pipeline
.mcp.json           # Playwright + context7, preconfigured
.agents/skills/     # Codex clone-website skill
.codex/config.toml  # Codex Playwright + Context7 MCP configuration
examples/
  tailwindcss.com/  # the finished upstream demo clone
```

## Design principles

- **Pixel-perfect emulation.** The target site _is_ the design system; fidelity beats flair.
- **Real content, real assets.** Actual text, images, videos and SVGs — never placeholders.
- **No AI slop.** A taste rubric guards every ambiguous decision: no generic fonts, no
  unmotivated gradients or glassmorphism, real hierarchy.
- **Enhance deliberately.** Want to go beyond 1:1? `/refine` applies taste dials on top of
  the clone instead of improvising.

## Responsible use

Calco is a research and prototyping accelerator, not a plagiarism machine. A clone of someone
else's site is a **starting point for your own product**: respect trademarks, copyright and
brand assets; replace content, imagery and branding with your own before shipping anything
public. The bundled tailwindcss.com demo exists to prove fidelity, is `noindex`ed, and is not
affiliated with or endorsed by Tailwind Labs.

## License

[MIT](LICENSE) © 2026 David E. Hernández

---

<p align="center">
  Built by <a href="https://qvacode.com.br"><b>QVACODE</b></a> — growth engineering for founders and SaaS.<br />
  <a href="https://qvacode.com.br">qvacode.com.br</a> ·
  <a href="https://www.linkedin.com/in/ernesto-growth">LinkedIn</a> ·
  <a href="https://x.com/qvacode">X</a>
</p>
