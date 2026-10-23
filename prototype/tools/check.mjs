// Browser checks for a built v0 site, for every locale.
// Usage: node check.mjs [origin]   (default http://127.0.0.1:8080, serving prototype/dist)
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const dict = JSON.parse(await readFile(new URL("../src/i18n.json", import.meta.url), "utf8"));

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

  // ---- experience tiles: click → text typed beside the tiles; again, Esc or "show fewer" → closed ----
  const btns = "#areas .area-btn", pick = dict[code]["exp.pick"], exam = dict[code]["area.exam.x"];
  const nonePressed = () => page.$$eval(btns, (bs) => bs.every((b) => b.getAttribute("aria-pressed") === "false"));
  ok((await page.$$(btns)).length === 10 && (await nonePressed()), `${code}: expected 10 tile buttons, none pressed`);
  ok((await page.textContent("#exp-out .tx")).trim() === pick, `${code}: tile readout should start with the hint "${pick}"`);
  const tile0 = await page.locator("#areas .area").first().boundingBox();
  await page.click("#areas .area >> nth=0", { position: { x: 16, y: tile0.height - 10 } }); // the whole tile is clickable, not only its title
  ok((await page.getAttribute(`${btns} >> nth=0`, "aria-pressed")) === "true" && (await page.textContent("#exp-live")) === exam, `${code}: clicking a tile did not select it or announce its text`);
  await page.waitForFunction((w) => document.querySelector("#exp-out .tx").textContent === w, exam, { timeout: 8000 }).catch(() => {});
  ok((await page.textContent("#exp-out .tx")) === exam, `${code}: tile text was not typed out in full`);
  const beside = await page.evaluate(() => {
    const o = document.getElementById("exp-out").getBoundingClientRect(), a = document.querySelector("#areas .area").getBoundingClientRect();
    return o.width > 0 && o.right <= a.left && o.top >= 0 && o.bottom <= innerHeight;
  });
  ok(beside, `${code}: tile text is not visible to the left of the tiles at 1280px`);
  await page.$eval("#areas .area:last-child", (a) => a.scrollIntoView({ block: "center", behavior: "instant" }));
  const titleTop = await page.$eval("#experience h2", (h) => h.getBoundingClientRect().top);
  ok(titleTop >= 64 && titleTop < 200, `${code}: section title is not pinned beside the last tile (top ${Math.round(titleTop)}px)`);
  await page.click(`${btns} >> nth=0`);
  ok((await nonePressed()) && (await page.textContent("#exp-out .tx")).trim() === pick, `${code}: clicking the open tile again did not close it`);
  await page.focus(`${btns} >> nth=1`); await page.keyboard.press("Enter");
  ok((await page.getAttribute(`${btns} >> nth=1`, "aria-pressed")) === "true", `${code}: Enter on a tile did not open it`);
  await page.keyboard.press("Escape");
  ok(await nonePressed(), `${code}: Esc did not close the tile text`);
  await page.click(`${btns} >> nth=9`); await page.click("#showall");
  ok(!(await page.$("#areas .area.on")) && (await nonePressed()), `${code}: hiding the open tile with "show fewer" left it open`);

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
      await p.click("#showall"); await p.click("#areas .area-btn >> nth=0");
      const axe =await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
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

  // ---- phones: no tile hint until a tap, then the text opens right under the tapped tile ----
  {
    const c = await browser.newContext({ viewport: { width: 375, height: 800 } }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    ok(!(await p.isVisible("#exp-out")), `${code}: tile hint shown on phones before any tap`);
    await p.click("#areas .area-btn >> nth=1");
    const under = await p.evaluate(() => {
      const o = document.getElementById("exp-out");
      return o.previousElementSibling === document.querySelectorAll("#areas .area")[1] && o.getBoundingClientRect().height > 0;
    });
    ok(under, `${code}: on phones the tile text should open under the tapped tile`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${code}: horizontal scroll at 375px with tile text open`);
    await c.close();
  }

  // ---- copy status never covers the links (success and failure, phone and tablet) ----
  for (const width of [375, 800]) {
    for (const fails of [false, true]) {
      const c = await browser.newContext({ viewport: { width, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
      if (fails) await c.addInitScript(() => { navigator.clipboard.writeText = () => Promise.reject(new Error("denied")); });
      const p = await c.newPage();
      await p.goto(origin + path, { waitUntil: "networkidle" });
      const clicked = await p.click("#copy", { timeout: 3000 }).then(() => true, () => false);
      ok(clicked, `${code}: copy button not clickable at ${width}px in the ${fails ? "failure" : "success"} run (covered by another element?)`);
      if (!clicked) { await c.close(); continue; }
      // the status text appears only after the clipboard promise settles: wait for it, then measure
      const want = dict[code][fails ? "toast.copyFail" : "toast.copied"];
      await p.waitForFunction(() => document.getElementById("toast").textContent.trim(), null, { timeout: 3000 }).catch(() => {});
      ok((await p.textContent("#toast")).trim() === want, `${code}: copy ${fails ? "failure" : "success"} at ${width}px should say "${want}"`);
      const hit = await p.evaluate(() => {
        const t = document.getElementById("toast").getBoundingClientRect();
        return [...document.querySelectorAll(".socials a, .mail .btn")].some((a) => {
          const r = a.getBoundingClientRect();
          return t.width && r.left < t.right && t.left < r.right && r.top < t.bottom && t.top < r.bottom;
        });
      });
      ok(!hit, `${code}: copy ${fails ? "failure" : "success"} message overlaps a link at ${width}px`);
      await c.close();
    }
  }

  // ---- rack starting texts are available to screen readers before any click ----
  const sr = await browser.newPage(); await sr.goto(origin + path);
  const empties = await sr.$$eval(".readout .live", (els) => els.filter((e) => !e.textContent.trim()).length);
  ok(empties === 0, `${code}: ${empties} rack readout(s) have no screen-reader text on load`);
  await sr.close();

  // ---- reduced motion: nothing hidden; JS off: content present ----
  const rm = await browser.newContext({ reducedMotion: "reduce" }); const rp = await rm.newPage();
  await rp.goto(origin + path, { waitUntil: "networkidle" });
  const hidden = await rp.$$eval(".reveal", (els) => els.filter((e) => getComputedStyle(e).opacity !== "1").length);
  ok(hidden === 0, `${code}: reduced motion leaves ${hidden} sections hidden`);
  await rp.click("#areas .area-btn >> nth=0");
  ok((await rp.textContent("#exp-out .tx")) === dict[code]["area.exam.x"], `${code}: with reduced motion the tile text should appear at once`);
  await rm.close();
  const nj = await browser.newContext({ javaScriptEnabled: false }); const np = await nj.newPage();
  await np.goto(origin + path);
  ok((await np.textContent("h2")).trim().length > 3 && (await np.textContent("#prod")).trim().length > 0, `${code}: content missing with JS off`);
  ok(!(await np.isVisible("#exp-out")), `${code}: tile hint shown with JS off, where tiles cannot open`);
  await nj.close();

  console.log(`${code}: checked`);
}

// ---- 404 page: loads, links home in both languages, passes axe in both themes ----
for (const theme of ["light", "dark"]) {
  const c = await browser.newContext({ colorScheme: theme }); const p = await c.newPage();
  const r = await p.goto(origin + "/404.html");
  ok(r.ok() && (await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))).join() === "/,/uk/", `404 (${theme}): page or home links wrong`);
  const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  for (const v of axe.violations) ok(false, `404 ${theme}: axe ${v.id} × ${v.nodes.length}`);
  ok((await p.$eval("h1", (h) => parseFloat(getComputedStyle(h).fontSize))) >= 90, `404 (${theme}): heading not at display size`);
  await c.close();
}
console.log("404: checked");

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n- ${problems.join("\n- ")}` : "\nAll checks passed.");
process.exit(problems.length ? 1 : 0);
