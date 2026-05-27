'use strict';

/**
 * Derives tile weight (complexity) from its 6 edges.
 *
 * W=1  mono        – all 6 edges same resource           (allRock, allWater, …)
 * W=2  contiguous  – 2 unique types, edges clustered     (4+2 or 3+3 in one arc)
 * W=3  split       – 2 unique types, edges non-contiguous (alternating/split pattern)
 *
 * Contiguity test: count circular transitions between adjacent edges.
 * Exactly 2 transitions → one arc per resource (contiguous, W=2).
 * More than 2 transitions → split or alternating pattern (non-contiguous, W=3).
 *
 * @param {{ edges: string[] }} tile
 * @returns {1|2|3}
 */
function getTileWeight(tile) {
  const counts = {};
  for (const e of tile.edges) counts[e] = (counts[e] || 0) + 1;

  if (Object.keys(counts).length === 1) return 1; // mono

  // Count circular transitions to distinguish contiguous from non-contiguous.
  let transitions = 0;
  for (let i = 0; i < 6; i++) {
    if (tile.edges[i] !== tile.edges[(i + 1) % 6]) transitions++;
  }

  return transitions <= 2 ? 2 : 3;
}

/**
 * Weighted random pick.  Assumes weights are all > 0.
 *
 * @param {any[]} arr
 * @param {number[]} weights  – same length as arr
 * @returns {any}
 */
function weightedPick(arr, weights) {
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

/**
 * Build a plain random pick (equal weight) helper.
 *
 * @param {any[]} arr
 * @returns {any}
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate an initial candidate deck of `size` tiles drawn (with replacement)
 * from `tilePool`, weighted by `stageTheme`.
 *
 * stageTheme format: { rock: 0.6, bio: 0.4 }  – resource → relative weight.
 * If empty / omitted, all tiles have equal probability.
 *
 * @param {number}   size
 * @param {object[]} tilePool  – full tile objects { _id, edges, … }
 * @param {object}   [stageTheme]
 * @returns {object[]}  array of tile objects (length === size)
 */
function generateInitialDeck(size, tilePool, stageTheme = {}) {
  const hasTheme = stageTheme && Object.keys(stageTheme).length > 0;

  const weights = tilePool.map(tile => {
    if (!hasTheme) return 1;
    let w = 0;
    for (const [resource, themeWeight] of Object.entries(stageTheme)) {
      w += tile.edges.filter(e => e === resource).length * themeWeight;
    }
    return w > 0 ? w : 1; // ensure > 0
  });

  return Array.from({ length: size }, () => weightedPick(tilePool, weights));
}

module.exports = { getTileWeight, weightedPick, randomPick, generateInitialDeck };
