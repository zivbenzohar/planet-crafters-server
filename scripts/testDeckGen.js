'use strict';

/**
 * Standalone test: Tile Stack Generation Algorithm
 * Run with:  node scripts/testDeckGen.js
 *
 * Tests all 5 difficulty levels end-to-end:
 *   Phase A (ordered draw) → B → C (generateStageDeck), then verifies SR with
 *   500 quick shuffled simulations.
 * Finishes with a detailed move-by-move trace for Level 3.
 */

const { performance } = require('perf_hooks');
const path = require('path');

const root = path.join(__dirname, '..');
const { generateStageDeck }   = require(path.join(root, 'services/deckGenerator/index'));
const { simulateGame,
        simulateGameVerbose } = require(path.join(root, 'services/deckGenerator/simulationCore'));
const { getTileWeight }       = require(path.join(root, 'services/deckGenerator/tileUtils'));
const { TARGET_BY_LEVEL }     = require(path.join(root, 'config/stageConfig'));

const WINDOWS = {
  1: [90, 100],
  2: [65, 85],
  3: [40, 60],
  4: [20, 35],
  5: [5,  20],
};

// ── 64-tile catalog (mirrors seed/seedHexTiles.js) ────────────────────────
// level 1 = mono, level 2 = contiguous bi-resource, level 3 = non-contiguous
const R = 'rock', C = 'crystal', B = 'bio', T = 'terra';

const CATALOG = [
  // Category 1 — Mono (W=1, level 1): 4 tiles
  { _id: 'tile_00', type: 'allRock',    edges: [R,R,R,R,R,R], level: 1 },
  { _id: 'tile_01', type: 'allCrystal', edges: [C,C,C,C,C,C], level: 1 },
  { _id: 'tile_02', type: 'allBio',     edges: [B,B,B,B,B,B], level: 1 },
  { _id: 'tile_03', type: 'allTerra',   edges: [T,T,T,T,T,T], level: 1 },

  // Category 2 — 4+2 Contiguous AAAABB (W=2, level 2): 12 tiles
  { _id: 'tile_04', type: 'moreRockCrystal',  edges: [R,R,R,R,C,C], level: 2 },
  { _id: 'tile_05', type: 'moreRockBio',      edges: [R,R,R,R,B,B], level: 2 },
  { _id: 'tile_06', type: 'moreRockTerra',    edges: [R,R,R,R,T,T], level: 2 },
  { _id: 'tile_07', type: 'moreCrystalRock',  edges: [C,C,C,C,R,R], level: 2 },
  { _id: 'tile_08', type: 'moreCrystalBio',   edges: [C,C,C,C,B,B], level: 2 },
  { _id: 'tile_09', type: 'moreCrystalTerra', edges: [C,C,C,C,T,T], level: 2 },
  { _id: 'tile_10', type: 'moreBioRock',      edges: [B,B,B,B,R,R], level: 2 },
  { _id: 'tile_11', type: 'moreBioCrystal',   edges: [B,B,B,B,C,C], level: 2 },
  { _id: 'tile_12', type: 'moreBioTerra',     edges: [B,B,B,B,T,T], level: 2 },
  { _id: 'tile_13', type: 'moreTerraRock',    edges: [T,T,T,T,R,R], level: 2 },
  { _id: 'tile_14', type: 'moreTerraCrystal', edges: [T,T,T,T,C,C], level: 2 },
  { _id: 'tile_15', type: 'moreTerraBio',     edges: [T,T,T,T,B,B], level: 2 },

  // Category 3 — 4+2 Non-Contiguous A AAABAB (W=3, level 3): 12 tiles
  { _id: 'tile_16', type: 'altA_moreRockCrystal',  edges: [R,R,R,C,R,C], level: 3 },
  { _id: 'tile_17', type: 'altA_moreRockBio',      edges: [R,R,R,B,R,B], level: 3 },
  { _id: 'tile_18', type: 'altA_moreRockTerra',    edges: [R,R,R,T,R,T], level: 3 },
  { _id: 'tile_19', type: 'altA_moreCrystalRock',  edges: [C,C,C,R,C,R], level: 3 },
  { _id: 'tile_20', type: 'altA_moreCrystalBio',   edges: [C,C,C,B,C,B], level: 3 },
  { _id: 'tile_21', type: 'altA_moreCrystalTerra', edges: [C,C,C,T,C,T], level: 3 },
  { _id: 'tile_22', type: 'altA_moreBioRock',      edges: [B,B,B,R,B,R], level: 3 },
  { _id: 'tile_23', type: 'altA_moreBioCrystal',   edges: [B,B,B,C,B,C], level: 3 },
  { _id: 'tile_24', type: 'altA_moreBioTerra',     edges: [B,B,B,T,B,T], level: 3 },
  { _id: 'tile_25', type: 'altA_moreTerraRock',    edges: [T,T,T,R,T,R], level: 3 },
  { _id: 'tile_26', type: 'altA_moreTerraCrystal', edges: [T,T,T,C,T,C], level: 3 },
  { _id: 'tile_27', type: 'altA_moreTerraBio',     edges: [T,T,T,B,T,B], level: 3 },

  // Category 4 — 4+2 Non-Contiguous B AABAAB (W=3, level 3): 12 tiles
  { _id: 'tile_28', type: 'altB_moreRockCrystal',  edges: [R,R,C,R,R,C], level: 3 },
  { _id: 'tile_29', type: 'altB_moreRockBio',      edges: [R,R,B,R,R,B], level: 3 },
  { _id: 'tile_30', type: 'altB_moreRockTerra',    edges: [R,R,T,R,R,T], level: 3 },
  { _id: 'tile_31', type: 'altB_moreCrystalRock',  edges: [C,C,R,C,C,R], level: 3 },
  { _id: 'tile_32', type: 'altB_moreCrystalBio',   edges: [C,C,B,C,C,B], level: 3 },
  { _id: 'tile_33', type: 'altB_moreCrystalTerra', edges: [C,C,T,C,C,T], level: 3 },
  { _id: 'tile_34', type: 'altB_moreBioRock',      edges: [B,B,R,B,B,R], level: 3 },
  { _id: 'tile_35', type: 'altB_moreBioCrystal',   edges: [B,B,C,B,B,C], level: 3 },
  { _id: 'tile_36', type: 'altB_moreBioTerra',     edges: [B,B,T,B,B,T], level: 3 },
  { _id: 'tile_37', type: 'altB_moreTerraRock',    edges: [T,T,R,T,T,R], level: 3 },
  { _id: 'tile_38', type: 'altB_moreTerraCrystal', edges: [T,T,C,T,T,C], level: 3 },
  { _id: 'tile_39', type: 'altB_moreTerraBio',     edges: [T,T,B,T,T,B], level: 3 },

  // Category 5 — 3+3 Contiguous AAABBB (W=2, level 2): 6 tiles
  { _id: 'tile_40', type: 'halfRockCrystal',  edges: [R,R,R,C,C,C], level: 2 },
  { _id: 'tile_41', type: 'halfRockBio',      edges: [R,R,R,B,B,B], level: 2 },
  { _id: 'tile_42', type: 'halfRockTerra',    edges: [R,R,R,T,T,T], level: 2 },
  { _id: 'tile_43', type: 'halfCrystalBio',   edges: [C,C,C,B,B,B], level: 2 },
  { _id: 'tile_44', type: 'halfCrystalTerra', edges: [C,C,C,T,T,T], level: 2 },
  { _id: 'tile_45', type: 'halfBioTerra',     edges: [B,B,B,T,T,T], level: 2 },

  // Category 6 — 3+3 Non-Contiguous A AABABB (W=3, level 3): 6 tiles
  { _id: 'tile_46', type: 'altA_halfRockCrystal',  edges: [R,R,C,R,C,C], level: 3 },
  { _id: 'tile_47', type: 'altA_halfRockBio',      edges: [R,R,B,R,B,B], level: 3 },
  { _id: 'tile_48', type: 'altA_halfRockTerra',    edges: [R,R,T,R,T,T], level: 3 },
  { _id: 'tile_49', type: 'altA_halfCrystalBio',   edges: [C,C,B,C,B,B], level: 3 },
  { _id: 'tile_50', type: 'altA_halfCrystalTerra', edges: [C,C,T,C,T,T], level: 3 },
  { _id: 'tile_51', type: 'altA_halfBioTerra',     edges: [B,B,T,B,T,T], level: 3 },

  // Category 7 — 3+3 Non-Contiguous B AABBAB (W=3, level 3): 6 tiles
  { _id: 'tile_52', type: 'altB_halfRockCrystal',  edges: [R,R,C,C,R,C], level: 3 },
  { _id: 'tile_53', type: 'altB_halfRockBio',      edges: [R,R,B,B,R,B], level: 3 },
  { _id: 'tile_54', type: 'altB_halfRockTerra',    edges: [R,R,T,T,R,T], level: 3 },
  { _id: 'tile_55', type: 'altB_halfCrystalBio',   edges: [C,C,B,B,C,B], level: 3 },
  { _id: 'tile_56', type: 'altB_halfCrystalTerra', edges: [C,C,T,T,C,T], level: 3 },
  { _id: 'tile_57', type: 'altB_halfBioTerra',     edges: [B,B,T,T,B,T], level: 3 },

  // Category 8 — 3+3 Non-Contiguous C ABABAB (W=3, level 3): 6 tiles
  { _id: 'tile_58', type: 'altC_halfRockCrystal',  edges: [R,C,R,C,R,C], level: 3 },
  { _id: 'tile_59', type: 'altC_halfRockBio',      edges: [R,B,R,B,R,B], level: 3 },
  { _id: 'tile_60', type: 'altC_halfRockTerra',    edges: [R,T,R,T,R,T], level: 3 },
  { _id: 'tile_61', type: 'altC_halfCrystalBio',   edges: [C,B,C,B,C,B], level: 3 },
  { _id: 'tile_62', type: 'altC_halfCrystalTerra', edges: [C,T,C,T,C,T], level: 3 },
  { _id: 'tile_63', type: 'altC_halfBioTerra',     edges: [B,T,B,T,B,T], level: 3 },
];

const TILE_BY_ID = new Map(CATALOG.map(t => [t._id, t]));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SEP = '─'.repeat(52);

function shuffled(arr) {
  const d = arr.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = d[i]; d[i] = d[j]; d[j] = tmp;
  }
  return d;
}

function quickSR(deck, targetScore, n = 500) {
  const deckTiles = deck.map(t => ({ edges: t.edges }));
  let wins = 0;
  for (let i = 0; i < n; i++) {
    if (simulateGame(shuffled(deckTiles), targetScore).success) wins++;
  }
  return Math.round((wins / n) * 100);
}

function dominantResource(tile) {
  const counts = {};
  for (const e of tile.edges) counts[e] = (counts[e] || 0) + 1;
  return Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
}

const RES_LETTER = { rock: 'R', crystal: 'C', bio: 'B', terra: 'T' };

function renderBoard(board) {
  if (board.size === 0) return '(empty)';
  const cellMap = new Map();
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;

  for (const [key, { tile }] of board) {
    const comma = key.indexOf(',');
    const q = parseInt(key, 10);
    const r = parseInt(key.slice(comma + 1), 10);
    const aCol = q * 2 + r, aRow = r;
    minCol = Math.min(minCol, aCol); maxCol = Math.max(maxCol, aCol);
    minRow = Math.min(minRow, aRow); maxRow = Math.max(maxRow, aRow);
    cellMap.set(`${aCol},${aRow}`, RES_LETTER[dominantResource(tile)] ?? '?');
  }

  minCol -= 1; maxCol += 1; minRow -= 1; maxRow += 1;
  const lines = [];
  for (let aRow = minRow; aRow <= maxRow; aRow++) {
    let line = '';
    for (let aCol = minCol; aCol <= maxCol; aCol++) {
      if ((aCol - aRow) % 2 !== 0) { line += '  '; continue; }
      line += (cellMap.get(`${aCol},${aRow}`) ?? '.') + ' ';
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
  console.log(`LEVEL ${level}  |  Target: ${targetScore}  |  SR window: ${lo}–${hi}%`);
  console.log(SEP);

  const { tileIds, mutations, finalSR: genSR } = await generateStageDeck({
    level,
    targetScore,
    stageTheme: {},
    tiles: CATALOG,
    deckSize: 30,
  });

  const deck = tileIds.map(id => {
    const t = TILE_BY_ID.get(id);
    if (!t) throw new Error(`Unknown tile id: ${id}`);
    return t;
  });

  // ── Weight / level breakdown ──────────────────────────────────────────────
  const wCounts = { 1: 0, 2: 0, 3: 0 };
  for (const t of deck) wCounts[getTileWeight(t)]++;
  const breakdown = [1, 2, 3]
    .filter(w => wCounts[w] > 0)
    .map(w => `W${w}×${wCounts[w]}`)
    .join('  ');
  console.log(`Tile breakdown:  ${breakdown}`);

  // ── Tile-level sequence grouped by section ────────────────────────────────
  const levels = deck.map(t => t.level);
  console.log('Level sequence (by section):');
  console.log(`  Slots  1-10: ${levels.slice( 0, 10).join(',')}`);
  console.log(`  Slots 11-20: ${levels.slice(10, 20).join(',')}`);
  console.log(`  Slots 21-30: ${levels.slice(20, 30).join(',')}`);

  // ── Hill-climbing stats ───────────────────────────────────────────────────
  console.log(`Mutations:       ${mutations}  |  Generator SR: ${genSR}%`);

  // ── Independent SR verification (500 shuffled sims) ──────────────────────
  const sr = quickSR(deck, targetScore, 500);
  const pass = sr >= lo && sr <= hi;
  console.log(`Verified SR:     ${sr}%  →  ${pass ? '✓ PASS' : `✗ FAIL (expected ${lo}–${hi}%)`}`);
  console.log();

  return { pass, deck };
}

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Level-3 trace
// ─────────────────────────────────────────────────────────────────────────────

function runDetailedTrace(deck, targetScore) {
  const shuffledDeck = shuffled(deck.slice());
  const deckTiles    = shuffledDeck.map(t => ({ edges: t.edges, type: t.type }));
  const { moves, board, success, finalScore } = simulateGameVerbose(deckTiles, targetScore);

  console.log(SEP);
  console.log(`DETAILED SIMULATION — LEVEL 3  (target: ${targetScore})`);
  console.log(SEP);

  const HDR = 'Move  Type                          W   (q, r)  rot  conn  total';
  console.log(HDR);
  console.log('─'.repeat(HDR.length));

  for (const mv of moves) {
    const tile     = shuffledDeck[mv.tileIdx];
    const tileType = (tile?.type ?? 'unknown').padEnd(28);
    const w        = `W${getTileWeight(tile)}`;
    const coord    = `(${String(mv.q).padStart(2)},${String(mv.r).padStart(2)})`;
    console.log(
      String(mv.tileIdx).padStart(4) + '  ' +
      tileType + ' ' + w.padEnd(3) + '  ' +
      coord + '    ' +
      String(mv.rotation) + '    ' +
      String(mv.connections).padStart(2) + '    ' +
      String(mv.runningTotal).padStart(3)
    );
  }

  console.log('─'.repeat(HDR.length));
  console.log(`Final score: ${finalScore} / ${targetScore}  →  ${success ? '✓ WIN' : '✗ LOSE'}`);
  console.log();
  console.log('Board  (R=rock  C=crystal  B=bio  T=terra  .=empty):');
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
  console.log('═'.repeat(52));
  console.log('  Planet Crafters — Deck Generator Test Suite');
  console.log('═'.repeat(52));
  console.log();

  let passed = 0;
  let level3Deck = null;

  for (let level = 1; level <= 5; level++) {
    const { pass, deck } = await runLevelTest(level);
    if (pass) passed++;
    if (level === 3) level3Deck = deck;
  }

  if (level3Deck) {
    runDetailedTrace(level3Deck, TARGET_BY_LEVEL[3]);
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(SEP);
  console.log(`SUMMARY: ${passed === 5 ? '✓' : '✗'} ${passed}/5 PASSED`);
  console.log(`Total time: ${elapsed}s`);
  console.log(SEP);
  console.log();

  process.exit(passed === 5 ? 0 : 1);
}

main().catch(err => {
  console.error('\n✗ Unexpected error:', err.message ?? err);
  process.exit(1);
});
