'use strict';

const { getTileWeight } = require('./tileUtils');

/**
 * Replace one tile in `deck` to nudge difficulty in the requested direction.
 *
 * SR landscape insight (shuffle-simulation model):
 *   - W=2 tiles (contiguous bi-resource: 4+2 or 3+3 in one arc): moderate SR,
 *     versatile placements — the dominant resource forms a concentrated arc that
 *     neighbours can match easily from multiple angles regardless of draw order.
 *   - W=3 tiles (non-contiguous bi-resource: split/alternating patterns): harder
 *     to match because the minority resource interrupts the arc, so placements
 *     that satisfy all touching edges require specific draw-order alignment.
 *   - W=1 MIXED mono tiles: SR → 0 % (different mono resources never match each
 *     other).  NEVER use for 'ease'.
 *
 * Safe mutations:
 *   'harden' (SR too high → need harder deck):
 *     Replace a W=2 tile with a W=3 tile.  Non-contiguous patterns break the
 *     arc matching that makes W=2 decks easy, pushing SR down.
 *   'ease' (SR too low → need easier deck):
 *     Replace a W=3 tile with a W=2 tile.  Contiguous patterns restore the
 *     dominant-arc advantage.  Never replace with W=1 mono.
 *
 * Returns a new array (deck is never mutated in-place).
 *
 * @param {object[]} deck       Current deck (tile objects with _id + edges)
 * @param {'harden'|'ease'} direction
 * @param {object[]} tilePool   Full tile catalog (64 templates)
 * @returns {object[]}          New deck of the same length
 */
function mutateDeck(deck, direction, tilePool) {
  const newDeck = deck.slice(); // shallow copy

  if (direction === 'harden') {
    // Swap OUT one W=2 tile (contiguous) and swap IN one W=3 tile (non-contiguous).
    const targets = newDeck
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => getTileWeight(t) <= 2);

    if (targets.length === 0) return newDeck;

    const hardPool = tilePool.filter(t => getTileWeight(t) === 3);
    if (hardPool.length === 0) return newDeck;

    const { i } = targets[Math.floor(Math.random() * targets.length)];
    newDeck[i] = hardPool[Math.floor(Math.random() * hardPool.length)];

  } else { // 'ease'
    // Swap OUT one W=3 tile (non-contiguous) and swap IN one W=2 tile (contiguous).
    // Never swap in W=1 mono — a mixed-resource mono deck drives SR to near 0 %.
    const targets = newDeck
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => getTileWeight(t) >= 3);

    if (targets.length === 0) return newDeck;

    const easyPool = tilePool.filter(t => getTileWeight(t) === 2);
    if (easyPool.length === 0) return newDeck;

    const { i } = targets[Math.floor(Math.random() * targets.length)];
    newDeck[i] = easyPool[Math.floor(Math.random() * easyPool.length)];
  }

  return newDeck;
}

module.exports = { mutateDeck };
