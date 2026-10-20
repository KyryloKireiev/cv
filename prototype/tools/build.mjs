// Builds the v0 CV site into prototype/dist:
//   1. checks that every locale in src/i18n.json has the same keys, and that
//      every key the template uses exists (the build fails otherwise);
//   2. renders one fully translated HTML page per locale (/ and /uk/);
//   3. renders favicon PNGs and one PDF per locale from the built pages.
import { chromium } from "playwright";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const DIST = resolve(HERE, "../dist");
const LOCALES = [
  { code: "en", out: "index.html", pdf: "kyrylo-kireiev-cv-en.pdf" },
  { code: "uk", out: "uk/index.html", pdf: "kyrylo-kireiev-cv-uk.pdf" },
];
const PLURAL = /^meta\.years\.(one|few|many|other)$/;

const fail = (msg) => { console.error(`\nBUILD FAILED: ${msg}`); process.exit(1); };

// ---- 1. checks -------------------------------------------------------------
const dict = JSON.parse(await readFile(join(SRC, "i18n.json"), "utf8"));
const template = await readFile(join(SRC, "index.html"), "utf8");

const base = Object.keys(dict.en).filter((k) => !PLURAL.test(k));
for (const { code } of LOCALES) {
  if (!dict[code]) fail(`locale "${code}" missing from i18n.json`);
  const keys = Object.keys(dict[code]).filter((k) => !PLURAL.test(k));
  const missing = base.filter((k) => !(k in dict[code]));
  const extra = keys.filter((k) => !(k in dict.en));
  if (missing.length) fail(`"${code}" is missing keys: ${missing.join(", ")}`);
  if (extra.length) fail(`"${code}" has keys not in "en": ${extra.join(", ")}`);
  if (!dict[code]["meta.years.other"]) fail(`"${code}" needs meta.years.other`);
  const empty = keys.filter((k) => dict[code][k] === "" || (Array.isArray(dict[code][k]) && !dict[code][k].length));
  if (empty.length) fail(`"${code}" has empty values: ${empty.join(", ")}`);
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

function yearsInProduction(since, now = new Date()) {
  const [y, m] = since.split("-").map(Number);
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  const plus = months >= 48 && months % 12 !== 0;
  const n = plus ? Math.floor(months / 12) : Math.round(months / 12);
  return { n, label: plus ? `${n}+` : String(n) };
}

await rm(DIST, { recursive: true, force: true });
await mkdir(join(DIST, "uk"), { recursive: true });
await cp(join(SRC, "assets"), join(DIST, "assets"), { recursive: true });
await cp(join(SRC, "favicon.svg"), join(DIST, "favicon.svg"));

const browser = await chromium.launch();
const page = await browser.newPage({ javaScriptEnabled: true });

for (const { code, out } of LOCALES) {
  const t = dict[code];
  const years = Object.fromEntries(Object.entries(t).filter(([k]) => PLURAL.test(k)).map(([k, v]) => [k.split(".").pop(), v]));
  const since = template.match(/data-since="([^"]+)"/)[1];
  const { n, label } = yearsInProduction(since);
  const prodText = (years[new Intl.PluralRules(code).select(n)] || years.other).replace("{n}", label);

  await page.setContent(shell, { waitUntil: "domcontentloaded" });
  const errors = await page.evaluate(({ t, code, prodText }) => {
    const errs = [], get = (k) => (k in t ? t[k] : (errs.push(k), ""));
    document.documentElement.lang = code;
    document.documentElement.removeAttribute("data-theme");
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
    return errs;
  }, { t, code, prodText });
  if (errors.length) fail(`"${code}" render missing keys: ${errors.join(", ")}`);

  const runtime = { rotor: t["hero.rotor"], years, showAll: t["exp.showAll"], showFewer: t["exp.showFewer"] };
  const json = JSON.stringify(runtime).replace(/</g, "\\u003c");
  let html = "<!DOCTYPE html>\n" + (await page.evaluate(() => document.documentElement.outerHTML));
  html = html.replace("</body>", `<script id="t" type="application/json">${json}</script>\n${appMatch[0]}\n</body>`);
  await writeFile(join(DIST, out), html);
  console.log(`✓ page: /${out.replace("index.html", "")}`);
}

// ---- 3. favicons and PDFs --------------------------------------------------
const svg = await readFile(join(SRC, "favicon.svg"), "utf8");
for (const [size, file, bg] of [[32, "favicon-32.png", "transparent"], [180, "apple-touch-icon.png", "#F9F3ED"]]) {
  const icon = await browser.newPage({ viewport: { width: size, height: size } });
  await icon.setContent(`<body style="margin:0;background:${bg}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await icon.screenshot({ path: join(DIST, file), omitBackground: bg === "transparent" });
  await icon.close();
}
console.log("✓ favicons");

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try { res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }).end(await readFile(join(DIST, p))); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const origin = `http://127.0.0.1:${server.address().port}`;

for (const { out, pdf } of LOCALES) {
  const p = await browser.newPage();
  await p.emulateMedia({ media: "print", reducedMotion: "reduce" });
  await p.goto(`${origin}/${out.replace("index.html", "")}`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const buf = await p.pdf({ path: join(DIST, pdf), format: "A4", printBackground: true, preferCSSPageSize: true });
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`✓ pdf: ${pdf} (${pages} page${pages === 1 ? "" : "s"}, ${Math.round(buf.length / 1024)} KB)`);
  await p.close();
}

server.close();
await browser.close();
console.log(`\nBuilt into ${DIST}`);
