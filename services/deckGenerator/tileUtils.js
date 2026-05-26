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
 * from `tilePool`, ordered in three difficulty-ascending sections:
 *
 *   Section 1 (slots 1–⌊size/3⌋)   : weighted toward tile level 1
 *   Section 2 (next ⌊size/3⌋)      : weighted toward tile level 2
 *   Section 3 (remainder)           : weighted toward tile level 3
 *
 * The section weights shift with stageLevel so that easier stages draw more
 * level-1 tiles overall and harder stages draw more level-3 tiles overall.
 *
 * stageTheme format: { rock: 0.6, bio: 0.4 } – multiplied on top of section
 * weights. If empty / omitted, only section weights apply.
 *
 * @param {number}   size
 * @param {object[]} tilePool    full tile objects { _id, edges, level, … }
 * @param {object}   [stageTheme]
 * @param {number}   [stageLevel=3]  stage difficulty 1-5
 * @returns {object[]}  ordered array of tile objects (length === size)
 */
function generateInitialDeck(size, tilePool, stageTheme = {}, stageLevel = 3) {
  // Group catalog tiles by their level field.
  const byLevel = { 1: [], 2: [], 3: [] };
  for (const tile of tilePool) {
    const lv = tile.level || 2;
    (byLevel[lv] || byLevel[2]).push(tile);
  }

  // [wL1, wL2, wL3] per section per stage level.
  // Rows = stage difficulty 1-5; cols = [section1, section2, section3].
  const SECTION_WEIGHTS = {
    1: [[8, 2, 0], [3, 6, 1], [0, 7, 3]],
    2: [[7, 3, 0], [2, 6, 2], [0, 5, 5]],
    3: [[6, 4, 0], [1, 6, 3], [0, 3, 7]],
    4: [[4, 5, 1], [1, 5, 4], [0, 2, 8]],
    5: [[3, 5, 2], [0, 4, 6], [0, 1, 9]],
  };

  const sw = SECTION_WEIGHTS[stageLevel] ?? SECTION_WEIGHTS[3];
  const hasTheme = stageTheme && Object.keys(stageTheme).length > 0;

  function themeWeight(tile) {
    if (!hasTheme) return 1;
    let w = 0;
    for (const [resource, tw] of Object.entries(stageTheme)) {
      w += tile.edges.filter(e => e === resource).length * tw;
    }
    return w > 0 ? w : 1;
  }

  const secSize = Math.floor(size / 3);
  const sections = [
    { count: secSize,          lw: sw[0] },
    { count: secSize,          lw: sw[1] },
    { count: size - 2*secSize, lw: sw[2] },
  ];

  const deck = [];
  for (const { count, lw: [wL1, wL2, wL3] } of sections) {
    const pool = [], weights = [];
    for (const [lv, lvW] of [[1, wL1], [2, wL2], [3, wL3]]) {
      if (lvW === 0) continue;
      for (const tile of byLevel[lv] ?? []) {
        pool.push(tile);
        weights.push(lvW * themeWeight(tile));
      }
    }
    // Fallback: uniform draw if a section's level groups are all empty.
    const src = pool.length > 0
      ? { pool, weights }
      : { pool: tilePool, weights: tilePool.map(() => 1) };
    for (let i = 0; i < count; i++) {
      deck.push(weightedPick(src.pool, src.weights));
    }
  }

  return deck;
}

module.exports = { getTileWeight, weightedPick, randomPick, generateInitialDeck };
