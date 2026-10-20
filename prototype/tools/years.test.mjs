import { test } from "node:test";
import assert from "node:assert/strict";
import { yearsInProduction } from "./years.mjs";

// start Nov 2022; months counted to the first of each date's month
const at = (y, m) => yearsInProduction("2022-11", new Date(y, m - 1, 15));

test("under four years the count is rounded", () => {
  assert.deepEqual(at(2026, 4), { n: 3, label: "3" }); // 41 months
  assert.deepEqual(at(2026, 10), { n: 4, label: "4" }); // 47 months
});

test("exactly four years shows no plus", () => {
  assert.deepEqual(at(2026, 11), { n: 4, label: "4" }); // 48 months
});

test("extra months after four years show a plus", () => {
  assert.deepEqual(at(2026, 12), { n: 4, label: "4+" }); // 49 months
  assert.deepEqual(at(2027, 10), { n: 4, label: "4+" }); // 59 months
});

test("whole years after that roll over", () => {
  assert.deepEqual(at(2027, 11), { n: 5, label: "5" }); // 60 months
  assert.deepEqual(at(2027, 12), { n: 5, label: "5+" }); // 61 months
});
