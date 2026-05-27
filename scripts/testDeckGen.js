'use strict';

/**
 * Standalone test: Tile Stack Generation Algorithm
 * Run with:  node scripts/testDeckGen.js
 *
 * Tests all 5 difficulty levels end-to-end:
 *   Phase A → B → C (generateStageDeck)  then verifies SR with 200 quick sims.
 * Finishes with a detailed move-by-move trace for Level 3.
 */

const { performance } = require('perf_hooks');
const path = require('path');

// ── Resolve module paths relative to the project root ────────────────────────
const root = path.join(__dirname, '..');
const { generateStageDeck }    = require(path.join(root, 'services/deckGenerator/index'));
const { simulateGame,
        simulateGameVerbose }  = require(path.join(root, 'services/deckGenerator/simulationCore'));
const { getTileWeight }        = require(path.join(root, 'services/deckGenerator/tileUtils'));
const { TARGET_BY_LEVEL }      = require(path.join(root, 'config/stageConfig'));

// ── SR windows per difficulty level ──────────────────────────────────────────
const WINDOWS = {
  1: [90, 100],
  2: [65, 80],
  3: [40, 60],
  4: [20, 35],
  5: [5,  15],
};

// ── 64-tile catalog (mirrors seed/seedHexTiles.js) with deterministic IDs ────
// _id is a plain string so generateStageDeck can map IDs → tile objects.
const CATALOG = [
  // Category 1 — Mono (W=1): 4 tiles
  { _id: 'tile_00', type: 'allRock',  center: 'rock',  edges: ['rock','rock','rock','rock','rock','rock'] },
  { _id: 'tile_01', type: 'allWater', center: 'water', edges: ['water','water','water','water','water','water'] },
  { _id: 'tile_02', type: 'allBio',   center: 'bio',   edges: ['bio','bio','bio','bio','bio','bio'] },
  { _id: 'tile_03', type: 'allLava',  center: 'lava',  edges: ['lava','lava','lava','lava','lava','lava'] },
  // Category 2 — Bi 4+2 Contiguous [A,A,A,A,B,B] (W=2): 12 tiles
  { _id: 'tile_04', type: 'moreRockWater',  center: 'rock',  edges: ['rock','rock','rock','rock','water','water'] },
  { _id: 'tile_05', type: 'moreRockBio',    center: 'rock',  edges: ['rock','rock','rock','rock','bio','bio'] },
  { _id: 'tile_06', type: 'moreRockLava',   center: 'rock',  edges: ['rock','rock','rock','rock','lava','lava'] },
  { _id: 'tile_07', type: 'moreWaterRock',  center: 'water', edges: ['water','water','water','water','rock','rock'] },
  { _id: 'tile_08', type: 'moreWaterBio',   center: 'water', edges: ['water','water','water','water','bio','bio'] },
  { _id: 'tile_09', type: 'moreWaterLava',  center: 'water', edges: ['water','water','water','water','lava','lava'] },
  { _id: 'tile_10', type: 'moreBioRock',    center: 'bio',   edges: ['bio','bio','bio','bio','rock','rock'] },
  { _id: 'tile_11', type: 'moreBioWater',   center: 'bio',   edges: ['bio','bio','bio','bio','water','water'] },
  { _id: 'tile_12', type: 'moreBioLava',    center: 'bio',   edges: ['bio','bio','bio','bio','lava','lava'] },
  { _id: 'tile_13', type: 'moreLavaRock',   center: 'lava',  edges: ['lava','lava','lava','lava','rock','rock'] },
  { _id: 'tile_14', type: 'moreLavaWater',  center: 'lava',  edges: ['lava','lava','lava','lava','water','water'] },
  { _id: 'tile_15', type: 'moreLavaBio',    center: 'lava',  edges: ['lava','lava','lava','lava','bio','bio'] },
  // Category 3 — Bi 4+2 Non-Contiguous Pattern A [A,A,A,B,A,B] (W=3): 12 tiles
  { _id: 'tile_16', type: 'altA_moreRockWater',  center: 'rock',  edges: ['rock','rock','rock','water','rock','water'] },
  { _id: 'tile_17', type: 'altA_moreRockBio',    center: 'rock',  edges: ['rock','rock','rock','bio','rock','bio'] },
  { _id: 'tile_18', type: 'altA_moreRockLava',   center: 'rock',  edges: ['rock','rock','rock','lava','rock','lava'] },
  { _id: 'tile_19', type: 'altA_moreWaterRock',  center: 'water', edges: ['water','water','water','rock','water','rock'] },
  { _id: 'tile_20', type: 'altA_moreWaterBio',   center: 'water', edges: ['water','water','water','bio','water','bio'] },
  { _id: 'tile_21', type: 'altA_moreWaterLava',  center: 'water', edges: ['water','water','water','lava','water','lava'] },
  { _id: 'tile_22', type: 'altA_moreBioRock',    center: 'bio',   edges: ['bio','bio','bio','rock','bio','rock'] },
  { _id: 'tile_23', type: 'altA_moreBioWater',   center: 'bio',   edges: ['bio','bio','bio','water','bio','water'] },
  { _id: 'tile_24', type: 'altA_moreBioLava',    center: 'bio',   edges: ['bio','bio','bio','lava','bio','lava'] },
  { _id: 'tile_25', type: 'altA_moreLavaRock',   center: 'lava',  edges: ['lava','lava','lava','rock','lava','rock'] },
  { _id: 'tile_26', type: 'altA_moreLavaWater',  center: 'lava',  edges: ['lava','lava','lava','water','lava','water'] },
  { _id: 'tile_27', type: 'altA_moreLavaBio',    center: 'lava',  edges: ['lava','lava','lava','bio','lava','bio'] },
  // Category 4 — Bi 4+2 Non-Contiguous Pattern B [A,A,B,A,A,B] (W=3): 12 tiles
  { _id: 'tile_28', type: 'altB_moreRockWater',  center: 'rock',  edges: ['rock','rock','water','rock','rock','water'] },
  { _id: 'tile_29', type: 'altB_moreRockBio',    center: 'rock',  edges: ['rock','rock','bio','rock','rock','bio'] },
  { _id: 'tile_30', type: 'altB_moreRockLava',   center: 'rock',  edges: ['rock','rock','lava','rock','rock','lava'] },
  { _id: 'tile_31', type: 'altB_moreWaterRock',  center: 'water', edges: ['water','water','rock','water','water','rock'] },
  { _id: 'tile_32', type: 'altB_moreWaterBio',   center: 'water', edges: ['water','water','bio','water','water','bio'] },
  { _id: 'tile_33', type: 'altB_moreWaterLava',  center: 'water', edges: ['water','water','lava','water','water','lava'] },
  { _id: 'tile_34', type: 'altB_moreBioRock',    center: 'bio',   edges: ['bio','bio','rock','bio','bio','rock'] },
  { _id: 'tile_35', type: 'altB_moreBioWater',   center: 'bio',   edges: ['bio','bio','water','bio','bio','water'] },
  { _id: 'tile_36', type: 'altB_moreBioLava',    center: 'bio',   edges: ['bio','bio','lava','bio','bio','lava'] },
  { _id: 'tile_37', type: 'altB_moreLavaRock',   center: 'lava',  edges: ['lava','lava','rock','lava','lava','rock'] },
  { _id: 'tile_38', type: 'altB_moreLavaWater',  center: 'lava',  edges: ['lava','lava','water','lava','lava','water'] },
  { _id: 'tile_39', type: 'altB_moreLavaBio',    center: 'lava',  edges: ['lava','lava','bio','lava','lava','bio'] },
  // Category 5 — Bi 3+3 Contiguous [A,A,A,B,B,B] (W=2): 6 tiles
  { _id: 'tile_40', type: 'halfRockWater',  center: 'rock',  edges: ['rock','rock','rock','water','water','water'] },
  { _id: 'tile_41', type: 'halfRockBio',    center: 'rock',  edges: ['rock','rock','rock','bio','bio','bio'] },
  { _id: 'tile_42', type: 'halfRockLava',   center: 'rock',  edges: ['rock','rock','rock','lava','lava','lava'] },
  { _id: 'tile_43', type: 'halfWaterBio',   center: 'water', edges: ['water','water','water','bio','bio','bio'] },
  { _id: 'tile_44', type: 'halfWaterLava',  center: 'water', edges: ['water','water','water','lava','lava','lava'] },
  { _id: 'tile_45', type: 'halfBioLava',    center: 'bio',   edges: ['bio','bio','bio','lava','lava','lava'] },
  // Category 6 — Bi 3+3 Non-Contiguous Pattern A [A,A,B,A,B,B] (W=3): 6 tiles
  { _id: 'tile_46', type: 'altA_halfRockWater',  center: 'rock',  edges: ['rock','rock','water','rock','water','water'] },
  { _id: 'tile_47', type: 'altA_halfRockBio',    center: 'rock',  edges: ['rock','rock','bio','rock','bio','bio'] },
  { _id: 'tile_48', type: 'altA_halfRockLava',   center: 'rock',  edges: ['rock','rock','lava','rock','lava','lava'] },
  { _id: 'tile_49', type: 'altA_halfWaterBio',   center: 'water', edges: ['water','water','bio','water','bio','bio'] },
  { _id: 'tile_50', type: 'altA_halfWaterLava',  center: 'water', edges: ['water','water','lava','water','lava','lava'] },
  { _id: 'tile_51', type: 'altA_halfBioLava',    center: 'bio',   edges: ['bio','bio','lava','bio','lava','lava'] },
  // Category 7 — Bi 3+3 Non-Contiguous Pattern B [A,A,B,B,A,B] (W=3): 6 tiles
  { _id: 'tile_52', type: 'altB_halfRockWater',  center: 'rock',  edges: ['rock','rock','water','water','rock','water'] },
  { _id: 'tile_53', type: 'altB_halfRockBio',    center: 'rock',  edges: ['rock','rock','bio','bio','rock','bio'] },
  { _id: 'tile_54', type: 'altB_halfRockLava',   center: 'rock',  edges: ['rock','rock','lava','lava','rock','lava'] },
  { _id: 'tile_55', type: 'altB_halfWaterBio',   center: 'water', edges: ['water','water','bio','bio','water','bio'] },
  { _id: 'tile_56', type: 'altB_halfWaterLava',  center: 'water', edges: ['water','water','lava','lava','water','lava'] },
  { _id: 'tile_57', type: 'altB_halfBioLava',    center: 'bio',   edges: ['bio','bio','lava','lava','bio','lava'] },
  // Category 8 — Bi 3+3 Non-Contiguous Pattern C [A,B,A,B,A,B] (W=3): 6 tiles
  { _id: 'tile_58', type: 'altC_halfRockWater',  center: 'rock',  edges: ['rock','water','rock','water','rock','water'] },
  { _id: 'tile_59', type: 'altC_halfRockBio',    center: 'rock',  edges: ['rock','bio','rock','bio','rock','bio'] },
  { _id: 'tile_60', type: 'altC_halfRockLava',   center: 'rock',  edges: ['rock','lava','rock','lava','rock','lava'] },
  { _id: 'tile_61', type: 'altC_halfWaterBio',   center: 'water', edges: ['water','bio','water','bio','water','bio'] },
  { _id: 'tile_62', type: 'altC_halfWaterLava',  center: 'water', edges: ['water','lava','water','lava','water','lava'] },
  { _id: 'tile_63', type: 'altC_halfBioLava',    center: 'bio',   edges: ['bio','lava','bio','lava','bio','lava'] },
];

// Build a fast ID → tile lookup used throughout.
const TILE_BY_ID = new Map(CATALOG.map(t => [t._id, t]));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEP = '─'.repeat(50);

function weightLabel(w) {
  return `W${w}`;
}

/** Fisher-Yates shuffle — returns a new array. */
function shuffled(arr) {
  const d = arr.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = d[i]; d[i] = d[j]; d[j] = tmp;
  }
  return d;
}

/**
 * Run N synchronous simulations, shuffling the deck before each one.
 * Shuffling is essential: simulateGame is deterministic, so without it
 * all N runs produce the same outcome and SR is always 0% or 100%.
 * Shuffling models different tile draw orders for the same 30-tile composition.
 */
function quickSR(deck, targetScore, n = 200) {
  const deckTiles = deck.map(t => ({ edges: t.edges }));
  let wins = 0;
  for (let i = 0; i < n; i++) {
    if (simulateGame(shuffled(deckTiles), targetScore).success) wins++;
  }
  return Math.round((wins / n) * 100);
}

/** Dominant resource in a tile's edges (for board display). */
function dominantResource(tile) {
  const counts = {};
  for (const e of tile.edges) counts[e] = (counts[e] || 0) + 1;
  return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
}

// Resource → single uppercase letter for the ASCII grid.
const RES_LETTER = { rock: 'R', water: 'W', bio: 'B', lava: 'L' };

/**
 * Render the board as an ASCII hex grid.
 *
 * Mapping: each placed tile at axial (q, r) occupies position
 *   aCol = q*2 + r,  aRow = r
 * in the character grid.  Positions where (aCol - aRow) is odd are
 * structural gaps (they can never correspond to an integer-q hex cell).
 * Each cell is 2 characters wide (letter/dot + space; gap = 2 spaces).
 */
function renderBoard(board) {
  if (board.size === 0) return '(empty)';

  // Map from "aCol,aRow" → display letter.
  const cellMap = new Map();
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;

  for (const [key, { tile }] of board) {
    const comma = key.indexOf(',');
    const q = parseInt(key, 10);
    const r = parseInt(key.slice(comma + 1), 10);
    const aCol = q * 2 + r;
    const aRow = r;

    minCol = Math.min(minCol, aCol);
    maxCol = Math.max(maxCol, aCol);
    minRow = Math.min(minRow, aRow);
    maxRow = Math.max(maxRow, aRow);

    const letter = RES_LETTER[dominantResource(tile)] ?? '?';
    cellMap.set(`${aCol},${aRow}`, letter);
  }

  // 1-cell padding so the blob isn't flush against the edge.
  minCol -= 1; maxCol += 1;
  minRow -= 1; maxRow += 1;

  const lines = [];
  for (let aRow = minRow; aRow <= maxRow; aRow++) {
    let line = '';
    for (let aCol = minCol; aCol <= maxCol; aCol++) {
      // Positions where (aCol - aRow) is odd are hex-grid gaps.
      if ((aCol - aRow) % 2 !== 0) {
        line += '  ';
        continue;
      }
      const letter = cellMap.get(`${aCol},${aRow}`);
      line += (letter ?? '.') + ' ';
    }
    lines.push(line.trimEnd());
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-level test
// ─────────────────────────────────────────────────────────────────────────────

async function runLevelTest(level) {
  const targetScore = TARGET_BY_LEVEL[level];
  const [lo, hi] = WINDOWS[level];

  console.log(SEP);
  console.log(`LEVEL ${level} | Target: ${targetScore} | SR window: ${lo}–${hi}%`);
  console.log(SEP);

  // ── Phase A→B→C deck generation ──────────────────────────────────────────
  const tileIds = await generateStageDeck({
    level,
    targetScore,
    stageTheme: {},
    tiles: CATALOG,
    deckSize: 30,
  });

  // Resolve IDs → full tile objects.
  const deck = tileIds.map(id => {
    const t = TILE_BY_ID.get(id);
    if (!t) throw new Error(`Unknown tile id: ${id}`);
    return t;
  });

  // ── Deck display ──────────────────────────────────────────────────────────
  const weightCounts = { 1: 0, 2: 0, 3: 0 };
  const weightLabels = deck.map(t => {
    const w = getTileWeight(t);
    weightCounts[w] = (weightCounts[w] || 0) + 1;
    return weightLabel(w);
  });

  // Print weights as a compact bracketed list, 10 per line.
  const rows = [];
  for (let i = 0; i < weightLabels.length; i += 10) {
    rows.push(weightLabels.slice(i, i + 10).join(', '));
  }
  console.log('Deck:');
  rows.forEach((r, i) => {
    const prefix = i === 0 ? '  [' : '   ';
    const suffix = i === rows.length - 1 ? ']' : ',';
    console.log(`${prefix}${r}${suffix}`);
  });

  const breakdown = [1, 2, 3]
    .filter(w => weightCounts[w] > 0)
    .map(w => `W${w}×${weightCounts[w]}`)
    .join('  ');
  console.log(`Tile breakdown: ${breakdown}`);

  // ── 500 quick simulations for SR verification (200 is too noisy for L5 ~10%) ─
  const sr = quickSR(deck, targetScore, 500);
  const pass = sr >= lo && sr <= hi;

  console.log(`Simulated SR: ${sr}%`);
  if (pass) {
    console.log('Result: ✓ PASS');
  } else {
    console.log(`Result: ✗ FAIL  (got ${sr}%, expected ${lo}–${hi}%)`);
  }
  console.log();

  return { pass, deck };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Level-3 trace
// ─────────────────────────────────────────────────────────────────────────────

function runDetailedTrace(deck, targetScore) {
  // Shuffle once so the trace shows a realistic draw order, not the generation order.
  // Keep the full tile objects (with type + edges) so we can display them later.
  const shuffledDeck = shuffled(deck.slice());
  const deckTiles    = shuffledDeck.map(t => ({ edges: t.edges, type: t.type }));
  const { moves, board, success, finalScore } = simulateGameVerbose(deckTiles, targetScore);

  console.log(SEP);
  console.log(`DETAILED SIMULATION — LEVEL 3  (target: ${targetScore})`);
  console.log(SEP);

  // Column header
  const HDR = 'Move  Type                          W   (q, r)  rot  conn  total';
  console.log(HDR);
  console.log('─'.repeat(HDR.length));

  for (const mv of moves) {
    // Look up from the SHUFFLED deck — mv.tileIdx is a position in the shuffled order.
    const tile     = shuffledDeck[mv.tileIdx];
    const tileType = (tile?.type ?? 'unknown').padEnd(28);
    const w        = `W${getTileWeight(tile)}`;
    const coord    = `(${String(mv.q).padStart(2)},${String(mv.r).padStart(2)})`;
    const line =
      String(mv.tileIdx).padStart(4) + '  ' +
      tileType + ' ' + w.padEnd(3) + '  ' +
      coord + '    ' +
      String(mv.rotation) + '    ' +
      String(mv.connections).padStart(2) + '    ' +
      String(mv.runningTotal).padStart(3);
    console.log(line);
  }

  console.log('─'.repeat(HDR.length));
  const outcome = success ? '✓ WIN' : '✗ LOSE';
  console.log(`Final score: ${finalScore} / ${targetScore}  →  ${outcome}`);
  console.log();

  // ── ASCII board ───────────────────────────────────────────────────────────
  console.log('Board  (R=rock  W=water  B=bio  L=lava  .=empty):');
  console.log();
  console.log(renderBoard(board));
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = performance.now();
  console.log();
  console.log('═'.repeat(50));
  console.log('  Planet Crafters — Deck Generator Test Suite');
  console.log('═'.repeat(50));
  console.log();

  let passed = 0;
  let level3Deck = null;

  for (let level = 1; level <= 5; level++) {
    const { pass, deck } = await runLevelTest(level);
    if (pass) passed++;
    if (level === 3) level3Deck = deck;
  }

  // Detailed trace uses the Level-3 deck generated above.
  if (level3Deck) {
    runDetailedTrace(level3Deck, TARGET_BY_LEVEL[3]);
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

  console.log(SEP);
  const summaryIcon = passed === 5 ? '✓' : '✗';
  console.log(`SUMMARY: ${summaryIcon} ${passed}/5 PASSED`);
  console.log(`Total time: ${elapsed}s`);
  console.log(SEP);
  console.log();

  process.exit(passed === 5 ? 0 : 1);
}

main().catch(err => {
  console.error('\n✗ Unexpected error:', err.message ?? err);
  process.exit(1);
});
