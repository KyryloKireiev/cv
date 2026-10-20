// Browser checks for a built v0 site, for every locale.
// Usage: node check.mjs [origin]   (default http://127.0.0.1:8080, serving prototype/dist)
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const origin = process.argv[2] || "http://127.0.0.1:8080";
const LOCALES = [["en", "/"], ["uk", "/uk/"]];
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };

const browser = await chromium.launch();

for (const [code, path] of LOCALES) {
  // ---- content, links and interactions at desktop width ----
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], foreign = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) foreign.push(r.url()); });
  const res = await page.goto(origin + path, { waitUntil: "networkidle" });
  ok(res.ok(), `${code}: page status ${res.status()}`);
  ok((await page.getAttribute("html", "lang")) === code, `${code}: <html lang> is not ${code}`);
  ok((await page.title()).includes("Kyrylo Kireiev"), `${code}: bad title`);
  ok((await page.$$("link[rel=alternate][hreflang]")).length === 3 && (await page.$("link[rel=canonical]")), `${code}: hreflang/canonical missing`);

  for (const sel of ['link[rel=icon][type="image/svg+xml"]', 'link[rel=icon][type="image/png"]', "link[rel=apple-touch-icon]", "a.btn-pdf"]) {
    const href = await page.getAttribute(sel, "href");
    const r = href && (await page.request.get(origin + href));
    ok(r && r.ok(), `${code}: ${sel} → ${href} not found`);
    if (sel === "a.btn-pdf") ok(r.headers()["content-type"]?.includes("pdf") && href.endsWith(`-${code}.pdf`), `${code}: PDF link wrong (${href})`);
  }
  const notFound = await page.request.get(origin + path + "no-such-page");
  ok(notFound.status() === 404, `${code}: unknown path should be 404 (got ${notFound.status()})`);

  const links = await page.$$eval("a[href]", (as) => as.map((a) => ({ h: a.getAttribute("href"), t: a.target, rel: a.rel })));
  ok(links.filter((a) => a.h === "mailto:kirillkireev888@gmail.com").length >= 3, `${code}: expected 3 mailto links`);
  for (const want of ["https://github.com/KyryloKireiev", "https://www.linkedin.com/in/kyrylo-kireiev-594381244/", "https://t.me/Kyrylo_Kireiev", "https://www.facebook.com/profile.php?id=100017270206165", "https://github.com/KyryloKireiev/cv"])
    ok(links.some((a) => a.h === want), `${code}: missing link ${want}`);
  ok(links.filter((a) => a.h.startsWith("http")).every((a) => a.t === "_blank" && a.rel.includes("noopener")), `${code}: external link without target=_blank/noopener`);
  for (const a of links.filter((x) => x.h.startsWith("#") && x.h.length > 1)) ok(await page.$(a.h), `${code}: anchor ${a.h} has no target`);
  const socialRows = await page.$$eval(".socials a", (as) => new Set(as.map((a) => Math.round(a.getBoundingClientRect().top))).size);
  ok(socialRows === 1, `${code}: social links wrap onto ${socialRows} lines at 1280px`);

  if (code === "uk") {
    const latin = await page.evaluate(() => {
      const keep = /^(Kyrylo Kireiev|Software Engineer|Python Developer|Raccoon Gang|Yalantis|UTC|B1|PDF|EN|UA|Open edX|GitHub|LinkedIn|Telegram|Facebook|R&D|Open source)/;
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

  ok((await page.textContent("#toast")) === "", `${code}: status region not empty before copying`);
  await page.click("#copy");
  ok((await page.evaluate(() => navigator.clipboard.readText())) === "kirillkireev888@gmail.com", `${code}: copy button did not copy`);
  ok((await page.textContent("#toast")).length > 0, `${code}: no "copied" status after copying`);

  const before = await page.getAttribute("html", "data-theme");
  await page.click("#theme"); await page.waitForTimeout(1400);
  const after = await page.getAttribute("html", "data-theme");
  ok(after !== before && (await page.evaluate(() => localStorage.getItem("theme"))) === after, `${code}: theme did not switch or was not remembered`);

  await page.click("#tab-p1"); await page.keyboard.press("ArrowRight");
  ok((await page.isVisible("#p2")) && (await page.getAttribute("#tab-p2", "aria-selected")) === "true", `${code}: arrow key did not switch tab`);
  await page.click("#p2 [data-id=m3]");
  ok((await page.textContent("#p2 .live")).includes("36969"), `${code}: rack live region did not get the full text`);
  ok((await page.getAttribute("#p2 [data-id=m3]", "aria-pressed")) === "true", `${code}: module aria-pressed not set`);
  await page.click("#showall");
  ok((await page.$$eval("#areas .area", (as) => as.filter((a) => a.offsetParent).length)) === 10, `${code}: show-all did not reveal 10 areas`);
  const hint = await page.textContent("#used");
  await page.click(".chip >> nth=8");
  ok((await page.textContent("#used")) !== hint, `${code}: skill chip did not update panel`);

  await page.click("#pause");
  ok((await page.getAttribute("html", "class")).includes("paused") && (await page.getAttribute("#pause", "aria-pressed")) === "true", `${code}: pause button did not pause`);
  ok((await page.$eval(".wave .t1", (g) => getComputedStyle(g).animationPlayState)) === "paused", `${code}: waveform still moving when paused`);

  ok(errors.length === 0, `${code}: console errors ${JSON.stringify(errors)}`);
  ok(foreign.length === 0, `${code}: third-party requests ${JSON.stringify(foreign)}`);
  await ctx.close();

  // ---- years in production: the page's own rule, at fixed dates ----
  for (const [date, want] of [["2026-10-15", "4"], ["2026-11-15", "4"], ["2026-12-15", "4+"], ["2027-11-15", "5"]]) {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.clock.setFixedTime(new Date(date + "T12:00:00"));
    await p.goto(origin + path);
    const text = (await p.textContent("#prod")).trim();
    ok(text.startsWith(want + " "), `${code}: on ${date} years should start with "${want} ", got "${text}"`);
    await c.close();
  }

  // ---- axe + layout, phone and desktop, light and dark ----
  for (const width of [375, 1280]) {
    for (const theme of ["light", "dark"]) {
      const c = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
      const p = await c.newPage();
      await p.goto(origin + path, { waitUntil: "networkidle" });
      ok((await p.getAttribute("html", "data-theme")) === theme, `${code} ${width} ${theme}: OS theme not followed`);
      await p.click("#showall");
      const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of axe.violations) ok(false, `${code} ${width}px ${theme}: axe ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0].target.join(" ")}`);
      await c.close();
    }
  }
  for (const width of [320, 375]) {
    const c = await browser.newContext({ viewport: { width, height: 800 } }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${code}: horizontal scroll at ${width}px`);
    const clipped = await p.$$eval(".socials a, header .tools > *", (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().right > innerWidth).length);
    ok(clipped === 0, `${code}: ${clipped} header/social element(s) cut off at ${width}px`);
    const names = await p.$$eval("header a, header button", (els) => els.filter((e) => e.offsetParent).map((e) => (e.getAttribute("aria-label") || e.textContent).trim()));
    ok(names.every(Boolean), `${code}: unnamed header control at ${width}px`);
    await c.close();
  }

  // ---- reduced motion: nothing hidden; JS off: content present ----
  const rm = await browser.newContext({ reducedMotion: "reduce" }); const rp = await rm.newPage();
  await rp.goto(origin + path, { waitUntil: "networkidle" });
  const hidden = await rp.$$eval(".reveal", (els) => els.filter((e) => getComputedStyle(e).opacity !== "1").length);
  ok(hidden === 0, `${code}: reduced motion leaves ${hidden} sections hidden`);
  await rm.close();
  const nj = await browser.newContext({ javaScriptEnabled: false }); const np = await nj.newPage();
  await np.goto(origin + path);
  ok((await np.textContent("h2")).trim().length > 3 && (await np.textContent("#prod")).trim().length > 0, `${code}: content missing with JS off`);
  await nj.close();

  console.log(`${code}: checked`);
}

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n- ${problems.join("\n- ")}` : "\nAll checks passed.");
process.exit(problems.length ? 1 : 0);
