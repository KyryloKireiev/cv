# Kyrylo Kireiev — CV

Personal CV site of a Python / Django software engineer working on Open edX.
Single page, English and Ukrainian, with a downloadable PDF.

> **Status:** v0 is live-ready in [`prototype/`](prototype): a static page in English and
> Ukrainian with PDFs. The full Astro build described in the
> [design spec](docs/superpowers/specs/2026-10-20-cv-site-design.md) will replace it.

## v0 (current)

All text lives in [`prototype/src/i18n.json`](prototype/src/i18n.json), English and
Ukrainian side by side. The build refuses to run if a key is missing in either language.

```bash
cd prototype/tools
npm install && npx playwright install chromium   # once: build tools and the browser they drive
npm test                                         # unit tests
npm run build                                    # → prototype/dist: /, /uk/, 404, favicons, PDFs
python3 -m http.server 8080 --bind 127.0.0.1 -d ../dist   # serve dist/ (another terminal)
npm run check                                    # browser + axe checks against the served dist/
```

Stop the server with `Ctrl+C`. There is no live reload: after editing, run `npm run build`
again and refresh the browser.

**Deploying:** live at [kyrylo-kireiev.dev](https://kyrylo-kireiev.dev). `dist/` is build
output and is not committed. [GitHub Actions](.github/workflows/deploy.yml) runs the tests,
the build and all browser checks on every pull request; after a merge to `main` it does the
same and then deploys `dist/` to a Cloudflare Worker ([`wrangler.jsonc`](wrangler.jsonc)).
It needs two repository secrets: `CLOUDFLARE_API_TOKEN` (template "Edit Cloudflare Workers")
and `CLOUDFLARE_ACCOUNT_ID`. The public address is set once in
`prototype/tools/build.mjs` (`SITE`).

**Known gap:** the page uses inline scripts and styles, so a strict Content Security Policy
would need hashes. Planned for the Astro build, together with security headers.

## Stack

- [Astro](https://astro.build) (static output) + TypeScript
- Plain CSS with design tokens, Raccoon Gang colours and type
- CV content in YAML, one file per language, validated at build time
- Vitest, Playwright + axe (accessibility), Lighthouse CI (performance budget)

## Built with an AI-assisted workflow

This repo is also an experiment in developing with [Claude Code](https://claude.com/claude-code).
The setup lives in [`.claude/`](.claude) and [`CLAUDE.md`](CLAUDE.md):

| Piece | Job |
|---|---|
| `strict-reviewer` agent | Blocking code review in a fresh context: `APPROVE` or `BLOCK` with `file:line` evidence |
| `qa-tester` agent | Checks the built site in a real browser: every language, mobile/desktop, light/dark, keyboard |
| `content-researcher` agent | Gathers sourced facts for the CV; never invents numbers |
| `cv-content` skill | How to edit CV text and add a language |
| `verify-before-commit` hook | Blocks a commit while the checks fail |

## Editing the CV

All text lives in `content/cv/<language>.yaml`. Adding a language means adding one file
and registering it in one place — no component changes. See the
[`cv-content` skill](.claude/skills/cv-content/SKILL.md) for the steps.

## Commands

For the planned Astro build only; they do not exist yet. For the current site use the v0
commands above. (Node 22, see `.nvmrc`):

```bash
npm run dev      # local dev server
npm run verify   # build, lint, unit + e2e tests, Lighthouse — must pass before a commit
```

## Contact

[kirillkireev888@gmail.com](mailto:kirillkireev888@gmail.com) ·
[GitHub](https://github.com/KyryloKireiev) ·
[LinkedIn](https://www.linkedin.com/in/kyrylo-kireiev-594381244/)
