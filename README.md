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
cd prototype/tools && npm install && npm run build   # → prototype/dist (pages, favicons, PDFs)
node check.mjs http://127.0.0.1:8080                 # browser checks against a served dist/
```

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

Available once the site is scaffolded (Node 22, see `.nvmrc`):

```bash
npm run dev      # local dev server
npm run verify   # build, lint, unit + e2e tests, Lighthouse — must pass before a commit
```

## Contact

[kirillkireev888@gmail.com](mailto:kirillkireev888@gmail.com) ·
[GitHub](https://github.com/KyryloKireiev) ·
[LinkedIn](https://www.linkedin.com/in/kyrylo-kireiev-594381244/)
