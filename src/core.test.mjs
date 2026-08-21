import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceTripleTap, swapResult } from "./core.js";

test("advanceTripleTap: counts 1 then 2 while the gesture is open", () => {
  assert.deepEqual(advanceTripleTap(0), { tapCount: 1, complete: false });
  assert.deepEqual(advanceTripleTap(1), { tapCount: 2, complete: false });
});

test("advanceTripleTap: third tap completes and resets to 0", () => {
  assert.deepEqual(advanceTripleTap(2), { tapCount: 0, complete: true });
});

test("advanceTripleTap: does not fire before the third tap", () => {
  const first = advanceTripleTap(0);
  const second = advanceTripleTap(first.tapCount);
  assert.equal(first.complete, false);
  assert.equal(second.complete, false);
});

test("swapResult: empty slot stages the whole draft and empties the composer", () => {
  const out = swapResult("", "hello world");
  assert.deepEqual(out, { staged: "hello world", draft: "" });
});

test("swapResult: full slot swaps both sides atomically, losing nothing", () => {
  const out = swapResult("staged text", "current text");
  assert.deepEqual(out, { staged: "current text", draft: "staged text" });
});

test("swapResult: both empty is a no-op", () => {
  const out = swapResult("", "");
  assert.deepEqual(out, { staged: "", draft: "" });
});
