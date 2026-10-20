---
name: cv-content
description: Use when editing CV text (experience, skills, projects, about, UI labels), adding or removing a language, or checking that translations are complete. Also the human-readable guide for Kyrylo.
---

# Editing CV content

Why this skill exists: the site's code and its text are separate, so the CV can be updated
without frontend knowledge. This is the single source of truth for how.

> Paths below are the agreed layout. If the scaffold differs, fix this file in the same
> commit — `strict-reviewer` treats a stale guide as a defect.

## Where text lives

```
content/
  cv/
    en.yaml      # English — the reference locale, every key must exist here
    uk.yaml      # Ukrainian — same keys as en.yaml
src/content.config.ts   # Zod schema: the shape every locale file must have
src/i18n/locales.ts     # the ONE list of enabled locales
```

Each locale file holds everything a visitor reads in that language: the CV itself and UI
labels (`ui:` section — nav items, button text, section headings, aria-labels).

## Change some text

1. Edit the value in `content/cv/en.yaml`.
2. Make the same change in every other locale file. Translate it; don't paste English.
3. Run `npm run build`. A missing key, wrong type, or bad date fails here with the file
   and field named.
4. Look at it: `npm run dev`, open `/` and `/uk/`.

## Add an entry (job, project, skill)

Copy an existing entry in `en.yaml`, edit it, then add the translated entry to every other
locale. Each entry has a stable `id` (kebab-case, English, never translated); entries are
matched across locales by `id`. **Display order comes from `en.yaml`** — to reorder, move
entries there; order in other files doesn't matter.

## Add a language

1. Copy `content/cv/en.yaml` to `content/cv/<code>.yaml` (ISO 639-1 code: `de`, `pl`…).
2. Translate every value. Keep keys and `id`s unchanged.
3. Add the code to `src/i18n/locales.ts` with its native name (shown in the switcher).
4. `npm run verify` — e2e tests automatically run for the new locale.

The downloadable PDF is generated from the same content, so a new locale gets its own PDF
with no extra step. (If the build ends up needing one, document it here.)

No component changes are allowed for this. If you find you need one, that is a bug in
the site: report it instead of patching around it.

## Remove a language

Reverse of the above: remove from `locales.ts`, delete the file, `npm run verify`.

## Rules for facts

- Every claim about Kyrylo needs a source (old CV, GitHub, GitLab, or Kyrylo himself).
  No invented numbers.
- Client names and details from Raccoon Gang work: only those Kyrylo approved for public use.
- Dates as `YYYY-MM`; the site formats them per locale.
