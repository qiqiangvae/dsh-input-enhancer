/**
 * dsh-input-enhancer — pure logic core (no DOM / React / Cordis dependency).
 *
 * The testable seam for the composer-lock triple-tap gesture and the draft-slot
 * swap. `src/client.js` stays thin glue: it owns timing (setTimeout) and DOM
 * side effects, while the *what happens next* decision lives here so it can be
 * unit-tested with node:test.
 *
 * Contracts:
 *  - `advanceTripleTap(tapCount)` → `{ tapCount, complete }`: increments the
 *    in-progress tap count; `complete === true` exactly when this tap is the
 *    third (unlock + send). The returned `tapCount` is what the store should
 *    hold next (counts 1..2 while gesture is open, resets to 0 once complete).
 *  - `nextSwap(nextStaged, currentDraft)` — not used; see `swapResult`.
 *  - `swapResult(stagedText, currentDraft)` → `{ staged: string, draft: string }`:
 *    the atomic slot⇄composer exchange. Empty slot stages the draft (composer
 *    empties); full slot swaps the two (nothing is lost). The returned `staged`
 *    is what the slot holds next; `draft` is what the composer should show.
 *
 * @module dsh-input-enhancer/core
 */

/**
 * Advance the locked-composer triple-tap counter.
 * @param {number} tapCount current stored tap count (0..2 while unlocked)
 * @returns {{ tapCount: number, complete: boolean }}
 */
export function advanceTripleTap(tapCount) {
  const count = tapCount + 1
  if (count >= 3) {
    return { tapCount: 0, complete: true }
  }
  return { tapCount: count, complete: false }
}

/**
 * The atomic draft-slot ⇄ composer exchange, a pure swap decided by occupancy.
 *   - slot empty  -> composer draft moves into the slot, composer empties.
 *   - slot full   -> the two contents swap (neither side is lost).
 * @param {string} stagedText current slot content ('' = empty)
 * @param {string} currentDraft current composer draft ('' = empty)
 * @returns {{ staged: string, draft: string }}
 */
export function swapResult(stagedText, currentDraft) {
  const staged = typeof stagedText === 'string' ? stagedText : ''
  const draft = typeof currentDraft === 'string' ? currentDraft : ''
  return { staged: draft, draft: staged }
}
