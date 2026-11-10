// Browser checks for a built v0 site, for every locale.
// Usage: node check.mjs [origin]   (default http://127.0.0.1:8080, serving prototype/dist)
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const dict = JSON.parse(await readFile(new URL("../src/i18n.json", import.meta.url), "utf8"));
// committer date of the last commit touching prototype/src, as "YYYY-MM" in the committer's own time zone
const lastSiteChange = execFileSync("git", ["log", "-1", "--format=%cI", "--", "prototype/src"], { cwd: new URL("../..", import.meta.url), encoding: "utf8" }).slice(0, 7);

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

  // link preview card: absolute og:image on the public domain, one 1200×630 PNG per locale, described for screen readers
  const meta = (sel) => page.evaluate((s) => document.querySelector(s)?.getAttribute("content") ?? null, sel);
  const site = new URL(await page.getAttribute("link[rel=canonical]", "href")).origin;
  ok((await meta('meta[property="og:image"]')) === `${site}/og-${code}.png`, `${code}: og:image is ${await meta('meta[property="og:image"]')}`);
  ok((await meta('meta[property="og:image:width"]')) === "1200" && (await meta('meta[property="og:image:height"]')) === "630", `${code}: og:image size tags missing`);
  ok((await meta('meta[property="og:image:alt"]')) === dict[code]["og.alt"], `${code}: og:image:alt missing or not from i18n`);
  ok((await meta('meta[name="twitter:card"]')) === "summary_large_image", `${code}: twitter:card is not summary_large_image`);
  // profile data for search engines (schema.org Person, JSON-LD): matches what the page shows; GitHub and LinkedIn only
  const ld = await page.evaluate(() => { try { return JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent); } catch { return null; } });
  const shown = await page.evaluate(() => ({
    name: document.querySelector(".brand").textContent.trim(), desc: document.querySelector('meta[name="description"]').content,
    profiles: [...document.querySelectorAll(".socials a")].map((a) => a.href).filter((h) => /github\.com|linkedin\.com/.test(h)),
  }));
  ok(ld?.["@context"] === "https://schema.org" && ld?.["@type"] === "Person", `${code}: no schema.org Person data`);
  ok(ld?.name === shown.name && ld?.jobTitle === dict[code]["ld.jobTitle"] && ld?.description === shown.desc,
    `${code}: Person name/jobTitle/description differ from the page: ${JSON.stringify(ld && [ld.name, ld.jobTitle])}`);
  ok(ld?.url === `${site}${path}` && ld?.homeLocation?.name === dict[code]["meta.locationValue"], `${code}: Person url or location wrong`);
  ok(shown.profiles.length === 2 && JSON.stringify(ld?.sameAs) === JSON.stringify(shown.profiles), `${code}: Person profiles are not exactly the page's GitHub and LinkedIn links: ${JSON.stringify(ld?.sameAs)}`);

  // "Updated": month of the last commit that changed the site itself (prototype/src), month names from i18n
  const [uy, um] = lastSiteChange.split("-").map(Number);
  const updated = await page.evaluate(() => document.getElementById("updated")?.textContent ?? null);
  ok(updated === `${(dict[code]["meta.months"] || [])[um - 1]} ${uy}`, `${code}: "Updated" shows ${JSON.stringify(updated)}, not the last site change (${lastSiteChange})`);

  const card = await page.request.get(`${origin}/og-${code}.png`), cardBuf = card.ok() ? await card.body() : Buffer.alloc(0);
  ok(cardBuf.length > 24 && cardBuf.toString("latin1", 1, 4) === "PNG" && cardBuf.readUInt32BE(16) === 1200 && cardBuf.readUInt32BE(20) === 630,
    `${code}: /og-${code}.png is not a 1200×630 PNG`);

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

  // six case studies, the last one about how this site is built; every rack says "NN / total"
  const tabCount = await page.$$eval("[role=tab]", (ts) => ts.length);
  ok(tabCount === 6, `${code}: expected 6 work tabs, found ${tabCount}`);
  await page.click("#tab-p1"); await page.keyboard.press("End");
  ok((await page.isVisible("#p6")) && (await page.getAttribute("#tab-p6", "aria-selected")) === "true", `${code}: End did not select the last tab (06)`);
  for (let t = 1; t <= tabCount; t++) {
    const head = (await page.textContent(`#p${t} .rhead span`)) || "";
    ok(head.startsWith(`0${t} / 0${tabCount} `), `${code}: rack ${t} header "${head}" does not read 0${t} / 0${tabCount}`);
  }
  // every module of the new rack fills the readout with its own text
  for (const id of await page.$$eval("#p6 .mod", (ms) => ms.map((m) => m.dataset.id))) {
    await page.click(`#p6 [data-id=${id}]`);
    const live = await page.textContent("#p6 .live"), want = dict[code][`c6.m.${id}.x`];
    ok(!!want && live === want, `${code}: module ${id} on rack 6 did not put its text in the readout`);
  }
  ok((await page.getAttribute("#p2 [data-id=m3]", "aria-pressed")) === "true", `${code}: module aria-pressed not set`);
  await page.click("#showall");
  ok((await page.$$eval("#areas .area", (as) => as.filter((a) => a.offsetParent).length)) === 10, `${code}: show-all did not reveal 10 areas`);

  // ---- experience tiles: click → text typed beside the tiles; again, Esc or "show fewer" → closed ----
  const btns = "#areas .area-btn", pick = dict[code]["exp.pick"], exam = dict[code]["area.exam.x"];
  const nonePressed = () => page.$$eval(btns, (bs) => bs.every((b) => b.getAttribute("aria-pressed") === "false"));
  ok((await page.$$(btns)).length === 10 && (await nonePressed()), `${code}: expected 10 tile buttons, none pressed`);
  ok((await page.textContent("#exp-out .tx")).trim() === pick, `${code}: tile readout should start with the hint "${pick}"`);
  const selectable = await page.$eval("#areas .area p", (el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + 4, r.top + r.height / 2) === el; });
  ok(selectable, `${code}: a tile's description is covered by its button, so its text cannot be selected`);
  // Bring the tile on screen instantly, then click with the raw mouse. The page scrolls smoothly (CSS), and
  // page.click() sometimes runs its own pre-click scroll, which then animates: the page measured the readout
  // mid-animation and the check failed about 2 runs in 3, depending on where the page happened to be.
  await page.$eval("#areas .area", (a) => a.scrollIntoView({ block: "center", behavior: "instant" }));
  const tile0 = await page.locator("#areas .area").first().boundingBox();
  await page.mouse.click(tile0.x + 16, tile0.y + tile0.height - 10); // the whole tile is clickable, not only its title
  ok((await page.getAttribute(`${btns} >> nth=0`, "aria-pressed")) === "true" && (await page.textContent("#exp-live")) === exam, `${code}: clicking a tile did not select it or announce its text`);
  const typingH = await page.$eval("#exp-out", (o) => o.getBoundingClientRect().height);
  await page.waitForFunction((w) => document.querySelector("#exp-out .tx").textContent === w, exam, { timeout: 8000 }).catch(() => {});
  ok((await page.textContent("#exp-out .tx")) === exam, `${code}: tile text was not typed out in full`);
  const typedH = await page.$eval("#exp-out", (o) => o.getBoundingClientRect().height);
  ok(Math.abs(typedH - typingH) < 1, `${code}: tile text box grows while typing (${typingH}px → ${typedH}px), so the page jumps`);
  const beside = await page.evaluate(() => {
    const o = document.getElementById("exp-out").getBoundingClientRect(), a = document.querySelector("#areas .area").getBoundingClientRect();
    return { ok: o.width > 0 && o.right <= a.left && o.top >= 0 && o.bottom <= innerHeight, at: `text ${Math.round(o.top)}–${Math.round(o.bottom)}px of ${innerHeight}, right ${Math.round(o.right)} vs tiles ${Math.round(a.left)}, scrollY ${Math.round(scrollY)}` };
  });
  ok(beside.ok, `${code}: tile text is not visible to the left of the tiles at 1280px (${beside.at})`);
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

  ok(!(await page.$(".wave-row, .wave, #pause, .pause-row")), `${code}: a removed feature (waveform, pause button) is back on the page`);
  // no pause control, so no CSS animation may loop forever (WCAG 2.2.2: blinking/moving stops within 5 s).
  // The hero rotor is a deliberate exception: JS-driven, Kyrylo's choice, still off under reduced motion.
  const endless = await page.evaluate(() => document.getAnimations().filter((a) => a.effect.getTiming().iterations === Infinity).map((a) => a.animationName || a.id));
  ok(endless.length === 0, `${code}: animations that never stop: ${JSON.stringify(endless)}`);
  ok(await page.$eval(".brand .sq", (s) => s.getAnimations().every((a) => a.effect.getComputedTiming().endTime <= 5000)), `${code}: logo square pulses for more than 5 s`);
  // readouts type word by word and finish; the cursor then blinks again (restarted), for under 5 s
  const typesOut = (sel, want) => page.waitForFunction(([s, w]) => document.querySelector(s).textContent === w, [sel, want], { timeout: 8000 }).then(() => true, () => false);
  const curFresh = (sel) => page.$eval(sel, (c) => { const a = c.getAnimations()[0]; return !!a && a.currentTime < 2000 && a.effect.getComputedTiming().endTime <= 5000; });
  await page.click("#tab-p1"); await page.click("#p1 [data-id=sso]");
  ok((await page.textContent("#p1 .readout .tx")).length < dict[code]["c1.m.sso.x"].length, `${code}: readouts appear at once instead of typing`);
  ok(await typesOut("#p1 .readout .tx", dict[code]["c1.m.sso.x"]), `${code}: a readout never finished typing`);
  ok(await curFresh("#p1 .readout .cur"), `${code}: readout cursor does not blink (briefly) after typing`);
  await page.click("#areas .area-btn >> nth=0");
  ok((await page.textContent("#exp-out .tx")).length < dict[code]["area.exam.x"].length, `${code}: tile text appears at once instead of typing`);
  ok(await typesOut("#exp-out .tx", dict[code]["area.exam.x"]), `${code}: tile text never finished typing`);
  ok(await curFresh("#exp-out .cur"), `${code}: tile text cursor does not blink (briefly) after typing`);

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

  // ---- a selected module keeps its cable highlight after a resize (own page: resizing the shared desktop
  //      page left a stray smooth scroll behind that broke later steps) ----
  {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    await p.click("#tab-p2"); await p.click("#p2 [data-id=m3]");
    await p.setViewportSize({ width: 1200, height: 900 }); await p.waitForFunction(() => innerWidth === 1200); await p.waitForTimeout(100);
    ok((await p.$$("#p2 svg.cables path.hot")).length === 2 && (await p.$$("#p2 svg.cables circle.port.hot")).length === 4, `${code}: selected module lost its cable highlight after a resize`);
    await c.close();
  }

  // ---- PDF / print: the "this site" case study stays on the web; the work case studies stay in ----
  {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.emulateMedia({ media: "print" }); await p.goto(origin + path, { waitUntil: "networkidle" });
    ok(await p.$eval("#p6", (el) => getComputedStyle(el).display === "none").catch(() => false), `${code}: the "this site" case study is in the PDF`);
    ok(await p.$eval("#p5", (el) => getComputedStyle(el).display !== "none"), `${code}: work case studies missing from print`);
    await c.close();
  }

  // ---- rack cables: from each module's top edge, only through the gaps, right angles only, every cable in
  //      its own lane, and clear of other cables' ports ----
  for (const width of [1280, 375, 320]) {
    const c = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    const nTabs = await p.$$eval("[role=tab]", (ts) => ts.length);
    for (let t = 1; t <= nTabs; t++) {
      await p.click(`#tab-p${t}`); await p.waitForTimeout(100);
      const bad = await p.$eval(`#p${t} .bay`, (bay) => {
        const rects = [...bay.querySelectorAll(".mod")].map((m) => m.getBoundingClientRect()), svgR = bay.querySelector("svg.cables").getBoundingClientRect();
        const paths = [...bay.querySelectorAll("svg.cables path")], out = [];
        if (paths.length !== bay.dataset.links.split(",").length) out.push(`expected ${bay.dataset.links.split(",").length} cables, found ${paths.length}`);
        for (const pth of paths) {
          const L = pth.getTotalLength(), start = pth.getPointAtLength(0), end = pth.getPointAtLength(L);
          // both ends sit on the top edge of a module
          for (const [pt, id] of [[start, pth.dataset.a], [end, pth.dataset.b]]) {
            const r = bay.querySelector(`[data-id="${id}"]`).getBoundingClientRect(), x = svgR.left + pt.x, y = svgR.top + pt.y;
            if (Math.abs(y - r.top) > 1 || x < r.left || x > r.right) out.push(`${pth.dataset.a}-${pth.dataset.b}: end not on the top edge of ${id}`);
          }
          for (let s = 0; s <= L; s += 3) {
            const pt = pth.getPointAtLength(s), x = svgR.left + pt.x, y = svgR.top + pt.y;
            const hit = rects.find((r) => x > r.left + 2 && x < r.right - 2 && y > r.top + 2 && y < r.bottom - 2);
            if (hit) { out.push(`${pth.dataset.a}-${pth.dataset.b} crosses a module`); break; }
          }
          // right angles only: straight runs are horizontal or vertical, every corner is a quarter turn
          const d = pth.getAttribute("d"), name = `${pth.dataset.a}-${pth.dataset.b}`;
          if (/[^MLQ\d.\s,-]/.test(d)) out.push(`${name}: uses curve commands other than corners`);
          let cur = null;
          for (const seg of d.match(/[MLQ][^MLQ]*/g)) {
            const n = seg.slice(1).trim().split(/[\s,]+/).map(Number), near = (u, v) => Math.abs(u - v) < .5;
            if (seg[0] === "L" && !near(n[0], cur[0]) && !near(n[1], cur[1])) { out.push(`${name}: diagonal run`); break; }
            if (seg[0] === "Q" && !((near(n[0], cur[0]) && near(n[1], n[3])) || (near(n[1], cur[1]) && near(n[0], n[2])))) { out.push(`${name}: corner is not a right angle`); break; }
            cur = seg[0] === "Q" ? [n[2], n[3]] : [n[0], n[1]];
          }
        }
        // sample every cable at 1px for the two tests below
        const samples = paths.map((pth) => { const L = pth.getTotalLength(), pts = []; for (let s = 0; s <= L; s += 1) { const q = pth.getPointAtLength(s); pts.push([q.x, q.y]); } return pts; });
        const dist = (p, pts) => Math.min(...pts.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
        // own lane: no two cables run within 2px of each other for 8px or more (a right-angle crossing is ~4px)
        for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
          let run = 0, worst = 0;
          for (const p of samples[i]) { run = dist(p, samples[j]) < 2 ? run + 1 : 0; worst = Math.max(worst, run); }
          if (worst >= 8) out.push(`${paths[i].dataset.a}-${paths[i].dataset.b} and ${paths[j].dataset.a}-${paths[j].dataset.b} share a line for ${worst}px`);
        }
        // clear of ports: a cable never passes within 7.5px of a port that is not one of its own two ends
        const ports = [...bay.querySelectorAll("svg.cables circle.port")].map((c) => ({ l: c.dataset.l, p: [+c.getAttribute("cx"), +c.getAttribute("cy")] }));
        if (ports.length !== 2 * paths.length || [...ports.map((p) => p.l), ...paths.map((p) => p.dataset.l)].some((l) => l === undefined))
          out.push(`expected 2 ports per cable, each cable and port tagged with its link (data-l)`);
        paths.forEach((pth, i) => {
          const close = ports.find((pt) => pt.l !== pth.dataset.l && dist(pt.p, samples[i]) < 7.5);
          if (close) out.push(`${pth.dataset.a}-${pth.dataset.b} runs through another cable's port`);
        });
        return out;
      });
      for (const b of bad) ok(false, `${code} ${width}px rack ${t}: ${b}`);
    }
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
    await p.keyboard.press("Escape");
    ok(!(await p.isVisible("#exp-out")), `${code}: Esc did not close the tile text on phones`);
    // widen to a short laptop window with the longest text open: back in the side column, and not cut off once pinned
    await p.click("#areas .area-btn >> nth=0"); await p.setViewportSize({ width: 1024, height: 600 });
    const backInSide = await p.waitForFunction(() => {
      const o = document.getElementById("exp-out");
      return o.nextElementSibling?.id === "exp-live" && o.getBoundingClientRect().height > 0;
    }, null, { timeout: 2000 }).then(() => true, () => false);
    ok(backInSide, `${code}: open tile text did not move back to the side column when the window widened`);
    const typedWide = await p.waitForFunction((w) => document.querySelector("#exp-out .tx").textContent === w, dict[code]["area.exam.x"], { timeout: 8000 }).then(() => true, () => false);
    ok(typedWide, `${code}: after widening, the tile text never finished typing`);
    await p.$eval("#showall", (b) => b.scrollIntoView({ block: "center", behavior: "instant" }));
    const fitsWide = await p.$eval("#exp-out", (o) => o.getBoundingClientRect().bottom <= innerHeight + 1);
    ok(fitsWide, `${code}: after widening to 1024×600 the pinned tile text is cut off at the bottom`);
    await c.close();
  }

  // ---- a tile opened at the very bottom of the screen: its text scrolls into view ----
  // fresh page with reduced motion, so no smooth scroll from earlier steps moves the start position
  for (const [width, height] of [[375, 800], [1024, 640]]) {
    const c = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    await p.$eval("#areas .area:nth-child(3)", (a) => a.scrollIntoView({ block: "end", behavior: "instant" }));
    const start = await p.$eval("#areas .area:nth-child(3)", (a) => a.getBoundingClientRect().bottom - innerHeight);
    ok(Math.abs(start) < 2, `${code}: test setup at ${width}×${height}: tile not at the bottom of the screen (off by ${start}px)`);
    await p.focus("#areas .area-btn >> nth=2"); await p.keyboard.press("Enter");
    const fits = await p.$eval("#exp-out", (o) => { const r = o.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
    ok(fits, `${code}: text of a tile at the bottom of the screen opens off-screen at ${width}×${height}`);
    await c.close();
  }

  // ---- short laptop window: the pinned column shifts up so the open text is never cut off ----
  for (const [width, height] of [[1024, 640], [920, 700]]) {
    const c = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" }); const p = await c.newPage();
    await p.goto(origin + path, { waitUntil: "networkidle" });
    // the exam text is the longest; open it, then scroll on so the column is pinned
    await p.click("#showall"); await p.click("#areas .area-btn >> nth=0");
    await p.$eval("#areas .area:nth-child(7)", (a) => a.scrollIntoView({ block: "center", behavior: "instant" }));
    const fits = await p.$eval("#exp-out", (o) => { const r = o.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; });
    ok(fits, `${code}: pinned tile text is cut off at the bottom at ${width}×${height}`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${code}: horizontal scroll at ${width}px with tile text open`);
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
