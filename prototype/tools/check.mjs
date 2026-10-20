// Smoke-checks a built v0 site in a real browser, for every locale.
// Usage: node check.mjs http://127.0.0.1:8080
import { chromium } from "playwright";

const origin = process.argv[2] || "http://127.0.0.1:8080";
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };

const browser = await chromium.launch();
for (const [code, path] of [["en", "/"], ["uk", "/uk/"]]) {
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [], foreign = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) foreign.push(r.url()); });
  const res = await page.goto(origin + path, { waitUntil: "networkidle" });
  ok(res.ok(), `${code}: page status ${res.status()}`);

  ok((await page.getAttribute("html", "lang")) === code, `${code}: <html lang> is not ${code}`);
  const title = await page.title();
  ok(title.includes("Kyrylo Kireiev"), `${code}: bad title "${title}"`);

  // favicons and PDF exist and have the right type
  for (const sel of ['link[rel=icon][type="image/svg+xml"]', 'link[rel=icon][type="image/png"]', "link[rel=apple-touch-icon]", "a.btn-pdf"]) {
    const href = await page.getAttribute(sel, "href");
    const r = href && (await page.request.get(origin + href));
    ok(r && r.ok(), `${code}: ${sel} → ${href} not found`);
    if (sel === "a.btn-pdf") ok(r.headers()["content-type"]?.includes("pdf") && href.endsWith(`-${code}.pdf`), `${code}: PDF link wrong (${href})`);
  }

  // links
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => ({ h: a.getAttribute("href"), t: a.target, rel: a.rel })));
  ok(hrefs.filter((a) => a.h === "mailto:kirillkireev888@gmail.com").length >= 3, `${code}: expected 3 mailto links`);
  for (const want of ["https://github.com/KyryloKireiev", "https://www.linkedin.com/in/kyrylo-kireiev-594381244/", "https://t.me/Kyrylo_Kireiev", "https://www.facebook.com/profile.php?id=100017270206165", "https://github.com/KyryloKireiev/cv"])
    ok(hrefs.some((a) => a.h === want), `${code}: missing link ${want}`);
  ok(hrefs.filter((a) => a.h.startsWith("http")).every((a) => a.t === "_blank" && a.rel.includes("noopener")), `${code}: external link without target=_blank/noopener`);
  ok(hrefs.filter((a) => a.h.startsWith("#")).every((a) => a.h === "#" || true), "");
  for (const a of hrefs.filter((x) => x.h.startsWith("#") && x.h.length > 1))
    ok(await page.$(a.h), `${code}: anchor ${a.h} has no target`);
  const socialsTop = await page.$$eval(".socials a", (as) => [...new Set(as.map((a) => Math.round(a.getBoundingClientRect().top)))]);
  ok(socialsTop.length === 1, `${code}: social links wrap onto ${socialsTop.length} lines at 1280px`);

  // untranslated text on the Ukrainian page: visible text with no Cyrillic, 3+ words
  if (code === "uk") {
    const latin = await page.evaluate(() => {
      const keep = /^(Kyrylo Kireiev|Software Engineer|Python Developer|Raccoon Gang|Yalantis|UTC|B1|PDF|EN|UK|Open edX|GitHub|LinkedIn|Telegram|Facebook|R&D|Open source)/;
      const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const s = w.currentNode.textContent.trim(), el = w.currentNode.parentElement;
        if (!s || /[а-яіїєґ]/i.test(s) || !/[a-z]/i.test(s) || s.split(/\s+/).length < 3) continue;
        if (el.closest("script,style,.stack,.tags,.mini,.chips,.prlinks,.mod small") || keep.test(s)) continue;
        out.push(s);
      }
      return out;
    });
    ok(latin.length === 0, `uk: possibly untranslated text: ${JSON.stringify(latin)}`);
  }

  // interactions
  await page.click("#copy");
  ok((await page.evaluate(() => navigator.clipboard.readText())) === "kirillkireev888@gmail.com", `${code}: copy button did not copy`);
  ok(await page.isVisible("#toast.on"), `${code}: no "copied" feedback`);
  const before = await page.getAttribute("html", "data-theme");
  await page.click("#theme"); await page.waitForTimeout(1400);
  ok((await page.getAttribute("html", "data-theme")) !== before, `${code}: theme did not switch`);
  ok((await page.evaluate(() => localStorage.getItem("theme"))) === (await page.getAttribute("html", "data-theme")), `${code}: theme not remembered`);
  await page.click("#tab-p1"); await page.keyboard.press("ArrowRight");
  ok(await page.isVisible("#p2") && (await page.getAttribute("#tab-p2", "aria-selected")) === "true", `${code}: arrow key did not switch tab`);
  await page.click("#p2 [data-id=m3]"); await page.waitForTimeout(1500);
  ok((await page.textContent("#p2 .readout")).includes("36969"), `${code}: rack readout did not update`);
  await page.click("#showall");
  ok((await page.$$eval("#areas .area", (as) => as.filter((a) => a.offsetParent).length)) === 10, `${code}: show-all did not reveal 10 areas`);
  await page.click(".chip >> nth=8");
  ok(!(await page.textContent("#used")).includes(code === "en" ? "Click a skill" : "Натисніть"), `${code}: skill chip did not update panel`);
  const prod = await page.textContent("#prod");
  ok(/^\d\+? /.test(prod), `${code}: years in production looks wrong: "${prod}"`);

  ok(errors.length === 0, `${code}: console errors ${JSON.stringify(errors)}`);
  ok(foreign.length === 0, `${code}: third-party requests ${JSON.stringify(foreign)}`);
  console.log(`${code}: checked (${prod}, title "${title}")`);
  await ctx.close();
}

// reduced motion: everything visible, nothing hidden waiting for an animation
const rm = await browser.newPage({ reducedMotion: "reduce" });
await rm.goto(origin + "/", { waitUntil: "networkidle" });
const hidden = await rm.$$eval(".reveal", (els) => els.filter((e) => getComputedStyle(e).opacity !== "1").length);
ok(hidden === 0, `reduced motion: ${hidden} sections still hidden`);

// JS disabled: content present
const nojs = await browser.newContext({ javaScriptEnabled: false });
const np = await nojs.newPage(); await np.goto(origin + "/uk/");
ok((await np.textContent("h2")).length > 3 && (await np.textContent("#prod")).length > 0, "no-JS: content missing");

await browser.close();
const real = problems.filter(Boolean);
console.log(real.length ? `\n${real.length} PROBLEM(S):\n- ${real.join("\n- ")}` : "\nAll checks passed.");
process.exit(real.length ? 1 : 0);
