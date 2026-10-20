# CV site — design

Date: 2026-10-20 · Owner: Kyrylo Kireiev · Status: draft for approval

## 1. Intent

A single-page CV for Kyrylo Kireiev, a Python/Django software engineer working on Open
edX at Raccoon Gang. Two reasons it exists, equally weighted:

1. **A real, credible CV** that can be sent to anyone and still holds up in an interview:
   every claim traceable to a source.
2. **A learning exercise in AI-assisted development.** The process (spec → plan →
   test-first → strict review → QA) matters as much as the result. The repo is public and
   is itself a portfolio piece.

There is no specific job target. Kyrylo's own words on content: "don't include too much
text, no one is going to read it, but the design should be attractive and interactive."

## 2. Audience and goals

- **Primary reader:** a recruiter or engineering lead skimming for under a minute, on a
  phone or a laptop, in English or Ukrainian.
- **Secondary:** an engineer who clicks into the case studies and checks the links.

Goals:
- Answer the first-screen questions in about 6 seconds: who, what role, where, current
  company, proof, how to contact, PDF.
- Show proof instead of adjectives: merged Open edX PRs, named systems, real numbers.
- Feel alive: animation and interaction a visitor notices and plays with.
- Easy upkeep: Kyrylo edits YAML, never components.

Non-goals: a blog, a projects archive, analytics, a CMS, a contact form, comments.

Anti-goals (a failure even if it "works"):
- A look-alike of kholodenko.dev (a colleague at the same company and domain). We share
  its structure on purpose; the skin, diagrams and animation must be clearly our own.
- Any invented fact or number, or any client name Kyrylo hasn't approved.
- Content that only exists after JS or animation runs (crawlers, PDF, screen readers,
  thumbnails must see everything).
- Long paragraphs.
- Looking like an official Raccoon Gang page: RG colours and type are used, the RG logo
  never is.

## 3. Constraints

All of `CLAUDE.md` applies. In particular:
- Text only in per-locale content files; a missing key fails the build; adding a locale
  needs no component change.
- WCAG 2.2 AA, axe clean; every animation respects `prefers-reduced-motion`.
- Lighthouse mobile: performance ≥ 95, accessibility 100, best practices ≥ 95, SEO ≥ 95.
- No third-party requests at runtime: fonts and icons are self-hosted and bundled.
- Facts come from `docs/research/facts.md` (local, git-ignored) and Kyrylo's answers.
  Client names are never published (§6.4).
- Public personal data: email, LinkedIn, GitHub, Telegram, Facebook, city. **No phone, no
  street address**, on the page or in the PDF. The illness behind the 2020 career change
  is never mentioned.

## 4. Decided by Kyrylo

| Topic | Decision |
|---|---|
| Structure | kholodenko.dev's: sticky nav with PDF + Email, big name, facts row, highlight metrics, timeline, tabbed case studies (diagram left, card right) |
| Skin | "Patch Bay": case-study diagrams are synth-rack modules joined by patch cables |
| Colours and type | Raccoon Gang design system (tokens in §7); no RG logo |
| Portrait | None |
| Text | Very little; short lines; details behind clicks |
| Languages | EN default at `/`, UK at `/uk/`; easy to add more |
| Career story | Music and TV: one short "Before code" entry, nothing on the first screen |
| Illness | Not mentioned |
| Contacts | Email, LinkedIn, GitHub, Telegram, Facebook; no phone, no address |
| Title | Software Engineer |
| English | B1 |
| Flagship case study | The exam platform, both parts: Odoo task bank and Django + Datastar exam service |
| Upstream PRs | All six merged PRs featured with numbers and links; #2749 shown as open |
| AI work | May be described as "AI tooling for Open edX at Raccoon Gang" |
| Frontend | Must be visible: React, Datastar, HTMX, Open edX MFEs |
| Experience | Expanded into work-area cards, 4 shown, "Show all 10" for the rest |
| Theme switch | **Circle reveal** from the toggle button |
| Motion | Lively: rotating words, waveform, count-ups, cable plug-in, signal pulse, scroll reveals |

The approved visual reference is [`docs/design/mockup-v4.html`](../../design/mockup-v4.html).
It is throwaway code (CDN fonts and icons, inline everything): match its look and behaviour,
not its code.

## 5. Page structure

One page, top to bottom. Section ids are stable anchors (`#experience`, `#work`, `#skills`,
`#contact`) and are the same in every locale.

### 5.1 Header (sticky)
Name with a small square status mark that slowly alternates green ↔ peach · nav links
(Experience, Work, Skills, Contact; underline slides in on hover and marks the current
section) · language switch (EN | UK) · theme toggle · "PDF" button (current locale's PDF)
· "Email" button (mailto). On narrow screens the nav links hide; language, theme, PDF and
Email stay.

### 5.2 Hero (cream band)
- Eyebrow: "Software Engineer · Dnipro, Ukraine".
- Name as display heading, surname in the accent colour.
- Rotating line: "I build" + a word that rolls every ~2.4 s through Django services →
  Open edX plugins → Odoo add-ons → React & Datastar UIs → AI tooling. Words come from
  the locale file.
- One-sentence summary.
- Tech tags (~11). Frontend tags styled differently (green outline).
- Contact row: email button with a copy button · GitHub, LinkedIn, Telegram, Facebook
  links with arrow icons.
- Facts row: Location, Time zone (UTC+2/+3), English (B1), Updated (month year).
- Right column: 3 metric cards with clipped corner. Values and labels from content:
  6 PRs merged into Open edX core · 127 MRs on a two-service exam platform in 8 months ·
  494 merged changes across 84 projects since 2023.
- Under the hero, full width: the animated waveform (two lines, green and peach).

### 5.3 Experience (graphite band)
Heading with one accent word. A vertical timeline whose peach line grows with scroll.
- **Raccoon Gang**, May 2023 – now, Software Engineer · Open edX vendor · 84 projects.
  Work-area cards (year range, title, one line, 2–4 mini tags). First 4 visible; "Show
  all 10 areas" reveals the rest with a stagger. Areas, in order: Exam platform; AI tooling
  for Open edX; Auth & organisation service; Gamification; Adaptive learning & XBlocks;
  Mobile API; Corporate access control; Frontend & MFEs; Deployments & releases;
  Localisation. (Wording as in the mockup.)
- **Yalantis**, Nov 2022 – May 2023, Python Developer: US healthcare startup for
  kidney-disease patients (social network for doctors and patients); team of 25.
- **Before code**, 2012 – 2020: musician · journalist and TV presenter at Suspilne.
  Dimmed marker.

### 5.4 Selected work (cream band)
Numbered tabs, sticky under the header: 01 Exam platform · 02 Open edX core · 03 AI
tooling · 04 Adaptive learning · 05 Gamification. Each panel = rack (left) + case card
(right). On narrow screens the rack stacks above the card and stops being sticky.

**Rack:** a graphite panel with a clipped corner, a header line ("01 / 05 · exam
platform"), 4–7 modules in a 2-column grid, patch cables drawn between module jacks, and a
"readout" line under the grid with a blinking cursor. Each module has a name, a short
sub-label, an LED and 1–2 jacks. Clicking a module selects it, highlights its cables, sends
a signal pulse along them and prints that module's one-line text in the readout.
Modules, links and texts are **content** (per locale), not code.

**Case card:** pill (e.g. Greenfield, Open source) + period · title · context line ·
Role / Team · Problem (one line) · What I did (≤ 3 bullets) · a highlighted box (for 01:
"Hardest bug") · up to 3 numbers · stack line. Fields other than title are optional.

Case content:
**Where the mockup and `facts.md` disagree, `facts.md` wins** (CLAUDE.md rule 7). The
mockup's copy is a draft; the build uses the corrected wording below, and the strict
reviewer checks every claim against facts.md.

- **01 Exam platform.** Context "Ukrainian public body · qualification exams · two
  services". Modules: Digital-ID SSO, Exam service (Django 5.2 · Datastar · SSE), Task bank
  (**Odoo 18 · custom add-ons** — not "24 add-ons", which is the project's total, not his),
  PostgreSQL (data · jobs). Role wording must stay "built features across both services and
  much of the integration"; never "architect" or "introduced Datastar" (facts.md §Role
  summary). Hardest-bug box, corrected to the source (MR !304): "A browser freeze in the live
  exam UI: two DOM observers — a Datastar attribute binding and a web component — fighting
  over one attribute. Found the root cause, moved the binding, added a regression test."
  Numbers: 127 MRs, 123 merged, 8 months. Do not use the 93% coverage figure (project-wide,
  not his).
- **02 Open edX core.** One module per PR — **all seven**: #34848, #34859, #36969, #36970,
  cookie-banner #445 (Enzyme → React Testing Library), edx-enterprise #2488 (merged, green
  LED) and authoring #2749 (in review, peach LED); each links to its PR. Card includes the
  2023 credit line: "Open edX mobile API (2023): my code, merged upstream through a
  teammate's pull requests."
- **Skills "where used" for Odoo:** "Exam platform task bank: 67 merge requests on custom
  Odoo add-ons."
- **03 AI tooling, 04 Adaptive learning, 05 Gamification** — not yet written. The
  builder drafts them from facts.md in the same format; **Kyrylo approves the wording before
  they are published.** Until approved they are excluded from the build by a content flag
  (§6.3), and the tab bar shows only the approved cases.

### 5.5 Skills (deep-green band)
Rows: Backend, Frontend, Platforms, Data, AI, Delivery. Each skill is a chip; white
filled = core (used for years), outlined = used. No ratings. Clicking a chip shows, in a
panel under the rows, where it was used (one line from content). Initial panel text tells
the visitor to click a skill. The skill list and "where used" lines come from facts.md
§Significant technologies; flagged items stay out.

### 5.6 Contact (green band)
Large "Let's talk" + email button. Footer (graphite): name, "Static site, no trackers",
Updated date, link to the GitHub repo.

## 6. Content model

### 6.1 Files
```
content/cv/en.yaml        reference locale
content/cv/uk.yaml        same keys and ids
src/i18n/locales.ts       the one registry: code, native name, path prefix, PDF filename
src/content.config.ts     Zod schema
```
One file per locale holds everything a visitor reads in that language: meta (title,
description), UI labels (nav, buttons, section headings, aria-labels, "Show all 10
areas", readout hint…), hero, metrics, experience, cases (including rack modules), skills,
contact. Dates are `YYYY-MM` strings; display formatting is per locale via `Intl`.

### 6.2 Parity
Lists are matched across locales by `id`; display order comes from `en.yaml`. The build
fails if any locale is missing a key or an id present in `en.yaml`, or has extra ones.

### 6.3 Publication flags
- Each case study has `status: published | draft`. Drafts are skipped in the build.
- Each case and work area has `disclosure: public | anonymised`. Anonymised entries must
  not contain any term from a deny-list kept in `docs/research/` (local) — checked by a
  unit test that runs only when that file exists, so CI on GitHub skips it.
  (Builder may choose a simpler equivalent, but there must be an automated check that an
  anonymised entry contains no client name.)

### 6.4 Wording rules
- Ukrainian is a rewrite, not a literal translation. Job titles and tech names stay in
  English. Kyrylo reviews the Ukrainian text before release.
- Counts that change over time (MRs, projects) live in content with an `asOf` month.
- No client or internal project names. Exam platform = "an exam platform for a Ukrainian
  public body".

## 7. Visual design

Source: Raccoon Gang Design System (claude.ai artifact, org default). Use its tokens and
rules; do not import its components or logo.

**Colours:** graphite `#323232`, cream `#F9F3ED`, green `#559479`, green-700 `#37604F`,
green-900 `#20322A`, peach `#F89D6A`, peach-300 `#FFB992`, peach-600 `#E08A58`, white,
graphite-800 `#2A2A2A`, graphite-600 `#4A4A4A`, cream-200 `#EDE7E1`, muted-on-light
`#6B6560`, muted-on-dark `#B8B2AC`.

**Contrast fix (my call, palette only):** the mockup put muted-on-dark and peach text on
graphite-600 (4.2:1, fails AA; the RG system also forbids muted-on-dark on graphite-600).
In the build, **no small text sits on graphite-600**. Dark cards and rack modules use
graphite-800 on a graphite surface, or graphite on a graphite-800 surface, each with a
1 px hairline (`rgba(249,243,237,.16)`) so the card edge stays visible (the two surfaces
differ by only 1.12:1). Measured text contrast on those surfaces: muted 6.1–6.8:1, peach
6.1–6.9:1, cream 11.6–13:1. graphite-600 may remain only as a hover fill behind cream text
(8.05:1). Any colour pair not listed here must be checked against AA before use.

**Rules to keep:** graphite/cream bands alternate, green bands punctuate, white only for
cards; peach text only on graphite; never white/cream text on peach; green text on light
only at ≥ 24 px (smaller: green-700); one accent word per heading; radius 0 except circles
for jacks; signature 45° clipped top-left corner (24 px; 12 px on small cards); no
gradients, glows, blur or extra shadows; Lucide icons, 2 px stroke.

**Type:** Barlow Semi Condensed (400/500/600/700; display and headings uppercase 700),
Barlow 600 for buttons, JetBrains Mono for tech tags, dates, stack lines and the readout.
Self-hosted with Latin + Cyrillic subsets, static weights.

**Dark theme:** page background graphite, cards graphite-800 with hairline, text cream, accent peach
(replaces green accents), rack and bands keep their own colours (graphite band becomes
graphite-800). Defaults to the OS setting; the toggle overrides and is remembered.

## 8. Motion and interaction

Every item: off under `prefers-reduced-motion: reduce` (final state shown instantly), and
the content is fully present in the HTML without JS.

| # | What | Trigger | Detail |
|---|---|---|---|
| 1 | Header square mark | always | slow green ↔ peach alternation |
| 2 | Rotating "I build …" word | every ~2.4 s | old word slides up and out, new slides in; pauses when the tab is hidden; screen readers get a static sentence listing all words |
| 3 | Waveform | always | two looping lines, seamless; pure CSS transform; decorative |
| 4 | Metric count-up | first time visible | 0 → value in ~1.1 s, ease-out; the HTML holds the final value |
| 5 | Section reveal | scroll into view | rise 24 px + fade; never applied to the hero (LCP) |
| 6 | Timeline line | scroll | peach line grows with scroll progress |
| 7 | Show all areas | click | extra cards appear with a short stagger |
| 8 | Rack power-on | first time visible, and on tab switch | cables draw one by one, LEDs switch on in sequence |
| 9 | Signal pulse | module click | a dot runs along that module's cables (~0.7 s); readout text updates (aria-live) |
| 10 | Tab switch | click / arrow keys | panel rises in; numbers re-count |
| 11 | Skill chip | click | chip lifts and fills peach; "where used" panel updates (aria-live) |
| 12 | Theme switch | toggle | **circle reveal** from the toggle centre to the far corner, ~1.2 s, View Transitions API; icon rotates; instant fallback where unsupported |
| 13 | Hovers | hover | nav underline, link arrow nudge, tag lift, card lift |

Accessibility of interactive parts: rack modules are buttons with `aria-pressed`; cables
are decorative (`aria-hidden`), the card holds the same facts as text; tabs follow the
WAI-ARIA tabs pattern (arrow keys, `aria-selected`, `aria-controls`); the "Show all" button
has `aria-expanded`; focus is always visible.

## 9. Languages

- EN at `/`, UK at `/uk/`; one page file renders every locale from the registry.
- `<html lang>`, `hreflang` alternates (+ `x-default` → EN), canonical per locale.
- The switcher links to the other locale's page and keeps the current section anchor.
- The rotating words, readout texts and "where used" lines are per locale.
- Dates and months formatted with `Intl` for the locale.

## 10. PDF

- One PDF per locale, generated at build time from the same content, e.g.
  `/kyrylo-kireiev-cv-en.pdf`, `/kyrylo-kireiev-cv-uk.pdf`; the header button links to the
  current locale's file.
- Purpose: screening and ATS. Single column, real text, standard headings, no icons, no
  animation, no colours beyond one accent, A4, 1 page target (2 max).
- Content: name, title, contacts (no phone/address), summary, highlights, experience (all
  10 areas as one line each), the published case studies as 2–3 lines each, skills, Open
  edX PR links, Before code (one line), education (Physics and Technology faculty, Oles
  Honchar Dnipro National University, 2006–2012), languages (Ukrainian native, English B1).
- Approach left to the builder (print route of the site rendered with Playwright
  `page.pdf()` is the researched default; see `docs/research/design/04-tech-patterns.md`
  locally).

## 11. Technical approach

- Astro static output, TypeScript strict. **No UI framework runtime**: interactive parts
  are small vanilla TypeScript modules attached to Astro components (rotor, count-up,
  reveal, timeline, rack, tabs, show-all, skills panel, theme). Each degrades to static
  content.
- Theme: an inline `<head>` script sets the theme before first paint (no flash); stored
  choice in `localStorage` wrapped in try/catch.
- Fonts via Astro's font handling with `latin` + `cyrillic` subsets; icons inlined as SVG
  at build time.
- SEO: title and description per locale, Open Graph tags with a static share image, JSON-LD
  `Person`, sitemap.
- **Site URL:** one setting (Astro `site`), used by canonical, hreflang, sitemap, Open
  Graph, JSON-LD and the PDF. Value: see §15 (open question). Until it is set, the build
  uses a clearly marked placeholder and a unit test fails the release build if the
  placeholder is still present (dev and CI builds only warn).
- Email: `mailto:` link with light obfuscation that works without JS (e.g. entity-encoded).
- Known version pitfalls from research: pin TypeScript 6 (Astro's checker doesn't support
  7); Lighthouse CI runs an older Lighthouse; PDF generation needs Chromium at build time.

## 12. Quality

Definition of done per `CLAUDE.md` (verify → qa-tester → strict-reviewer APPROVE).
Tests that must exist:
- **Unit:** locale parity (keys and ids), schema failures produce readable errors, date
  formatting per locale, draft cases excluded, anonymised-entry check (§6.3).
- **E2E, for every locale:** all sections and published cases render; nav anchors;
  language switch keeps the anchor; tabs by mouse and keyboard; rack module click updates
  the readout and `aria-pressed`; "Show all" toggles; skill chip updates the panel; theme
  toggle switches and persists; with reduced motion nothing animates and everything is
  visible; with JS disabled all content is present; no console errors; no third-party
  requests; axe clean in light and dark; PDF link returns a PDF.
- **Lighthouse CI** on every locale page against the budget.
- **CI:** GitHub Actions runs `npm run verify` on every push and pull request.

## 13. Out of scope for this build

Hosting and deployment (next step: Cloudflare Pages via GitHub Actions is the researched
default), custom domain, a real illustration, case studies 03–05 going live (needs
Kyrylo's approval), more languages.

## 14. My calls (Claude), for Kyrylo to check

- No UI framework at all (vanilla TS), even though React is in the stack: smallest JS, best
  Lighthouse, nothing to hydrate.
- Dark theme swaps the green accent for peach (RG rule: green text only on light).
- Cases 03–05 are hidden until approved rather than shown as "coming soon".
- The PDF lists all 10 work areas, while the page shows 4 + "Show all".
- The Cyrillic name line from mockup v2 is dropped (spelling unconfirmed).
- Tech tags use JetBrains Mono, which the RG system reserves for code; tech names are
  code-like, so it's a deliberate small exception.
- Contrast fix within the RG palette (§7): dark cards and rack modules become graphite-800
  with a hairline instead of graphite-600. Visually close to the mockup, AA-compliant.
- Facts beat mockup copy (§5.4): corrected "hardest bug" and Odoo wording; Open edX rack
  shows all seven PRs.

## 15. Open question

- **Public address of the site.** Needed for canonical URLs, hreflang, sitemap and share
  previews. Does not block building (§11 placeholder), but must be set before release.

## 16. Left to the builder

File and component layout, CSS organisation, exact easing and timings within ±30%, the
anonymised-name check mechanism, PDF generation mechanism, share-image design, test file
layout, cable path geometry.
