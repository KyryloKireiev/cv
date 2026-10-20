// Builds the v0 CV site into prototype/dist:
//   1. checks src/i18n.json: every locale has the same keys and value types as "en",
//      the plural forms its language needs, and every key the template uses exists
//      (the build fails otherwise);
//   2. renders one fully translated HTML page per locale (/ and /uk/) and a 404 page;
//   3. renders favicon PNGs and one PDF per locale from the built pages.
import { chromium } from "playwright";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { yearsInProduction } from "./years.mjs";

// Public address: used for canonical and hreflang links. Change here if the domain changes.
const SITE = "https://kyrylo-kireiev.pages.dev";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const DIST = resolve(HERE, "../dist");
const LOCALES = [
  { code: "en", path: "/", out: "index.html", pdf: "kyrylo-kireiev-cv-en.pdf", og: "en_US", font: "barlow-semi-condensed-700-latin" },
  { code: "uk", path: "/uk/", out: "uk/index.html", pdf: "kyrylo-kireiev-cv-uk.pdf", og: "uk_UA", font: "roboto-condensed-700-cyrillic" },
];
const PLURAL = /^meta\.years\.(zero|one|two|few|many|other)$/;

const fail = (msg) => { console.error(`\nBUILD FAILED: ${msg}`); process.exit(1); };
const typeOf = (v) => (Array.isArray(v) ? `array(${v.length})` : typeof v);

// ---- 1. checks -------------------------------------------------------------
const dict = JSON.parse(await readFile(join(SRC, "i18n.json"), "utf8"));
const template = await readFile(join(SRC, "index.html"), "utf8");

const base = Object.keys(dict.en).filter((k) => !PLURAL.test(k));
for (const { code } of LOCALES) {
  const t = dict[code];
  if (!t) fail(`locale "${code}" missing from i18n.json`);
  const keys = Object.keys(t).filter((k) => !PLURAL.test(k));
  const missing = base.filter((k) => !(k in t));
  const extra = keys.filter((k) => !(k in dict.en));
  if (missing.length) fail(`"${code}" is missing keys: ${missing.join(", ")}`);
  if (extra.length) fail(`"${code}" has keys not in "en": ${extra.join(", ")}`);
  const badType = keys.filter((k) => typeOf(t[k]) !== typeOf(dict.en[k]));
  if (badType.length) fail(`"${code}" values differ in type from "en": ${badType.map((k) => `${k} (${typeOf(t[k])})`).join(", ")}`);
  const empty = keys.filter((k) => (Array.isArray(t[k]) ? t[k].some((s) => !s) : !t[k]));
  if (empty.length) fail(`"${code}" has empty values: ${empty.join(", ")}`);
  const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  const noForm = needed.filter((c) => !t[`meta.years.${c}`]);
  if (noForm.length) fail(`"${code}" needs plural forms meta.years.${noForm.join(", meta.years.")}`);
}
const used = new Set();
for (const m of template.matchAll(/data-i18n(?:-text|-used)?="([^"]+)"/g)) used.add(m[1]);
for (const m of template.matchAll(/data-i18n-attr="([^"]+)"/g)) m[1].split(";").forEach((p) => used.add(p.split(":")[1]));
const unknown = [...used].filter((k) => !(k in dict.en));
if (unknown.length) fail(`template uses unknown keys: ${unknown.join(", ")}`);
console.log(`✓ i18n: ${base.length} keys × ${LOCALES.length} locales, ${used.size} used by the template`);

// ---- 2. pages --------------------------------------------------------------
const appMatch = template.match(/<script id="app">[\s\S]*?<\/script>/);
if (!appMatch) fail('template has no <script id="app">');
const shell = template.replace(appMatch[0], "");
const since = template.match(/data-since="([^"]+)"/)[1];

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "uk"), { recursive: true });
await cp(join(SRC, "assets"), join(DIST, "assets"), { recursive: true });
await cp(join(SRC, "favicon.svg"), join(DIST, "favicon.svg"));

const browser = await chromium.launch();
const page = await browser.newPage();

for (const loc of LOCALES) {
  const { code, out } = loc;
  const t = dict[code];
  const years = Object.fromEntries(Object.entries(t).filter(([k]) => PLURAL.test(k)).map(([k, v]) => [k.split(".").pop(), v]));
  const { n, label } = yearsInProduction(since);
  const prodText = years[new Intl.PluralRules(code).select(n)].replace("{n}", label);
  const head = {
    canonical: SITE + loc.path,
    alternates: [...LOCALES.map((l) => [l.code, SITE + l.path]), ["x-default", SITE + "/"]],
    og: loc.og,
    font: `/assets/fonts/${loc.font}.woff2`,
  };

  await page.setContent(shell, { waitUntil: "domcontentloaded" });
  const errors = await page.evaluate(({ t, code, prodText, head }) => {
    const errs = [], get = (k) => (k in t ? t[k] : (errs.push(k), ""));
    const root = document.documentElement;
    root.lang = code;
    root.removeAttribute("data-theme");
    // trusted, hand-written strings from i18n.json (some contain <span class="acc">)
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = get(el.dataset.i18n); el.removeAttribute("data-i18n"); });
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => { const [attr, key] = pair.split(":"); el.setAttribute(attr, get(key)); });
      el.removeAttribute("data-i18n-attr");
    });
    document.querySelectorAll("[data-i18n-text]").forEach((el) => { el.dataset.text = get(el.dataset.i18nText); el.removeAttribute("data-i18n-text"); });
    document.querySelectorAll("[data-i18n-used]").forEach((el) => { el.dataset.used = get(el.dataset.i18nUsed); el.removeAttribute("data-i18n-used"); });
    document.querySelectorAll(".langs a").forEach((a) => a.setAttribute("aria-current", String(a.dataset.lang === code)));
    document.getElementById("slot-word").textContent = t["hero.rotor"][0];
    document.getElementById("prod").textContent = prodText;
    // head: preload the font this locale actually uses; canonical, hreflang, og:locale
    document.querySelector('link[rel="preload"][as="font"]').href = head.font;
    const add = (tag, attrs) => document.head.appendChild(Object.assign(document.createElement(tag), attrs));
    add("link", { rel: "canonical", href: head.canonical });
    head.alternates.forEach(([hreflang, href]) => add("link", { rel: "alternate", hreflang, href }));
    const og = (property, content) => { const m = document.createElement("meta"); m.setAttribute("property", property); m.content = content; document.head.appendChild(m); };
    og("og:url", head.canonical); og("og:locale", head.og);
    return errs;
  }, { t, code, prodText, head });
  if (errors.length) fail(`"${code}" render missing keys: ${errors.join(", ")}`);

  const runtime = {
    rotor: t["hero.rotor"], years, showAll: t["exp.showAll"], showFewer: t["exp.showFewer"],
    copied: t["toast.copied"], copyFail: t["toast.copyFail"],
  };
  const json = JSON.stringify(runtime).replace(/</g, "\\u003c");
  const scripts = `<script id="t" type="application/json">${json}</script>\n${appMatch[0]}\n</body>`;
  // function replacer: "$&" etc. in translations must not be treated as patterns
  const html = "<!DOCTYPE html>\n" + (await page.evaluate(() => document.documentElement.outerHTML)).replace("</body>", () => scripts);
  await writeFile(join(DIST, out), html);
  console.log(`✓ page: ${loc.path}`);
}

// 404: both languages on one small page (Cloudflare Pages serves 404.html for unknown paths)
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
await writeFile(join(DIST, "404.html"), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 · Kyrylo Kireiev</title><meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/fonts.css">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F9F3ED;color:#323232;font:400 18px/1.5 "Barlow Semi Condensed","Roboto Condensed",sans-serif}
main{padding:24px;display:grid;gap:28px}h1{margin:0;font-size:96px;line-height:1;font-weight:700;color:#37604F}section{display:grid;gap:4px}
h2{margin:0;font-size:28px;text-transform:uppercase}a{color:#37604F;font-weight:600}a:focus-visible{outline:3px solid #323232;outline-offset:3px}
@media (prefers-color-scheme:dark){body{background:#323232;color:#F9F3ED}h1,a{color:#F89D6A}a:focus-visible{outline-color:#F89D6A}}</style></head>
<body><main><h1>404</h1>${LOCALES.map(({ code, path }) => `
<section lang="${code}"><h2>${esc(dict[code]["404.title"])}</h2><p>${esc(dict[code]["404.text"])}</p><a href="${path}">${esc(dict[code]["404.home"])}</a></section>`).join("")}
</main></body></html>\n`);
console.log("✓ page: 404.html");

// ---- 3. favicons and PDFs --------------------------------------------------
const svg = await readFile(join(SRC, "favicon.svg"), "utf8");
for (const [size, file, bg] of [[32, "favicon-32.png", "transparent"], [180, "apple-touch-icon.png", "#F9F3ED"]]) {
  const icon = await browser.newPage({ viewport: { width: size, height: size } });
  await icon.setContent(`<body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await icon.screenshot({ path: join(DIST, file), omitBackground: bg === "transparent" });
  await icon.close();
}
console.log("✓ favicons");

// Local server for printing the PDFs: loopback only, and confined to dist/.
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf" };
const server = createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { return res.writeHead(400).end(); }
  if (p.endsWith("/")) p += "index.html";
  const file = resolve(DIST, "." + p);
  if (!file.startsWith(DIST + sep)) return res.writeHead(403).end();
  try { res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;

for (const { path, pdf } of LOCALES) {
  const p = await browser.newPage();
  await p.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await p.goto(origin + path, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const buf = await p.pdf({ path: join(DIST, pdf), format: "A4", printBackground: true, preferCSSPageSize: true });
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (pages > 2) fail(`${pdf} has ${pages} pages; the CV must fit on 2`);
  console.log(`✓ pdf: ${pdf} (${pages} page${pages === 1 ? "" : "s"}, ${Math.round(buf.length / 1024)} KB)`);
  await p.close();
}

server.close();
await browser.close();
console.log(`\nBuilt into ${DIST}`);
