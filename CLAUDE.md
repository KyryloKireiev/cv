# Kyrylo Kireiev — CV site

Single-page CV, static site, multi-language (EN default, UK). Owner is a Python/Django
developer with base-level JS: explain frontend decisions in plain terms, and keep the
content editable without touching code.

This project is also a learning exercise in AI-assisted development. Every agent, skill,
hook, plugin and rule in `.claude/` must have a one-line reason to exist (see the table at
the end). If it stops earning its place, delete it.

## Stack

- Astro (static output) + TypeScript (strict). Client-side JS only as small islands, and
  only when a feature cannot work without it.
- Plain CSS with custom properties (design tokens). No CSS framework.
- Content: YAML files validated by a Zod schema via Astro content collections.
- Tests: Vitest (unit), Playwright + @axe-core/playwright (e2e + accessibility),
  Lighthouse CI (performance budget).
- Lint/format: ESLint, Prettier, `astro check`.
- Node 22 via nvm (`.nvmrc`).

**Shell one-liners:** use `jq` for JSON and the Read/Grep tools for files. Avoid
`python3 -c` / `python3 -` snippets and `sed -i`: each needs Kyrylo's approval, and
"always allow" on them would auto-approve arbitrary code.

**Node version gotcha:** each Bash call is a fresh shell and may start on an old Node.
Always switch and run in the *same* command:
`source ~/.nvm/nvm.sh && nvm use >/dev/null && npm run verify`

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Static build into `dist/` (fails on content/schema errors) |
| `npm run check` | `astro check` + ESLint + Prettier check |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e + axe, against a production build |
| `npm run lighthouse` | Lighthouse CI against `dist/`, fails below the budget (rule 6) |
| `npm run verify` | build → check → test → test:e2e → lighthouse. Must pass before any commit. |

A PreToolUse hook (`.claude/hooks/verify-before-commit.sh`) blocks Claude's `git commit`
while `npm run verify` fails. It is a strong guard, not a guarantee: it checks the working
tree (not the staged snapshot) and does not block if it times out. See the script header.

## Hard rules

1. **No user-visible text in components.** All text — including UI labels like "Experience"
   or "Download PDF" — lives in the per-language content files. Components only render it.
2. **Every language is a first-class citizen.** Any change must work in every configured
   locale. A key missing in one locale fails the build; it never silently falls back.
3. **Adding a language = add a content file + register the locale in one place.** No
   component changes. If a change would break this, redesign it.
4. **Tests first** for behaviour (superpowers:test-driven-development). Each e2e test runs
   for every locale.
5. **Accessibility is not optional:** WCAG 2.2 AA, axe clean, keyboard reachable, visible
   focus, every animation respects `prefers-reduced-motion`.
6. **Performance budget:** Lighthouse performance ≥ 95, accessibility = 100,
   best-practices ≥ 95, SEO ≥ 95 on mobile. No third-party trackers or runtime CDNs.
7. **Facts about Kyrylo must have a source** (old CV, GitHub, GitLab, or his own words).
   Never invent numbers, dates, clients or achievements. Client work from Raccoon Gang may
   be under NDA: only publish client names or details Kyrylo has explicitly approved.
   Research notes live in git-ignored `docs/research/`; never commit them.
8. **New dependency = written justification** in the commit message. Prefer the platform.

## Definition of done

In this order:

1. `npm run verify` passes — run it, read the output, don't assume.
2. For anything visible: `qa-tester` agent checked it in every locale, mobile + desktop,
   light + dark. Fix what it finds, then re-run verify.
3. `strict-reviewer` agent returns **APPROVE**. It is the last gate and the only review
   that counts for "done"; any change after APPROVE needs a new review.

## Why each piece of the AI setup exists

| Piece | Reason |
|---|---|
| `strict-reviewer` agent | Fresh-context blocking review; the author can't judge its own work |
| `qa-tester` agent | Sees the site like a visitor; catches what tests didn't think of |
| `content-researcher` agent | Reads many sources so the main session only gets sourced conclusions |
| `cv-content` skill | One guide for editing text and adding languages (for Claude and Kyrylo) |
| verify-before-commit hook | Turns "verify before commit" from a rule Claude may forget into an enforced check |
| superpowers plugin | The process: brainstorm → plan → test-first → verify before claiming done |
| frontend-design plugin | Pushes the design away from the generic AI-site look |
| playwright plugin | Lets Claude open, click and screenshot the real page |
| context7 plugin | Current library docs instead of possibly stale training knowledge |
| pr-review-toolkit plugin | Optional specialist second opinions (tests, silent failures, simplification). Never replaces `strict-reviewer` |
| security-guidance plugin | Warns on risky code patterns as they're written |
| commit-commands plugin | `/commit`, `/commit-push-pr` shortcuts; the hook still enforces verify |

## Reference

Inspiration: https://kholodenko.dev (colleague at the same company, same domain). Reuse
ideas, not structure wholesale; animations must be our own.
