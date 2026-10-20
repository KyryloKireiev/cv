// Years in production since a "YYYY-MM" start month. The page script repeats this rule
// (it cannot import modules); check.mjs verifies both agree by faking the browser clock.
//   under 4 full years: rounded        (47 months → "4")
//   from 4 years on:    whole years, "+" for extra months (48 → "4", 49 → "4+", 60 → "5")
export function yearsInProduction(since, now = new Date()) {
  const [y, m] = since.split("-").map(Number);
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  const plus = months >= 48 && months % 12 !== 0;
  const n = plus ? Math.floor(months / 12) : Math.round(months / 12);
  return { n, label: plus ? `${n}+` : String(n) };
}
