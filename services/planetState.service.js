const Planet = require("../model/Planet_model");
const HexTile = require("../model/HexTile_model");
const { DIRS } = require("./planet.service");
const { getTargetScore, getLevelFromStageId } = require("../config/stageConfig");

function stageLevel(stage, stageId) {
  return stage.meta?.level ?? getLevelFromStageId(stageId);
}
const { generateStageDeck } = require("./deckGenerator");

function emptyStageState() {
  return {
    map: { placedTiles: [] },
    hand: { maxHandSize: 3, tilesInHand: [] },
    deck: { remainingTiles: [] },
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };
}

/**
 * Generate a calibrated deck via the Tile Stack Generation Algorithm and
 * split it into an initial hand + remaining deck.
 *
 * @param {number} deckSize
 * @param {number} [handSize=3]
 * @param {{ level?: number, targetScore?: number, stageTheme?: object }} [options]
 */
async function createDeckAndHand(deckSize, handSize = 3, options = {}) {
  const { level = 3, targetScore = 20, stageTheme = {} } = options;

  // Fetch the full tile catalog (edges needed for simulation).
  const tiles = await HexTile.find({}).lean();
  if (!tiles.length) throw new Error("No HexTile templates");

  const tileIds = await generateStageDeck({
    level,
    targetScore,
    stageTheme,
    tiles,
    deckSize,
  });

  return {
    hand: {
      maxHandSize: handSize,
      tilesInHand: tileIds.slice(0, handSize),
    },
    deck: {
      remainingTiles: tileIds.slice(handSize),
    },
  };
}

async function getStageState({ userId, planetId, stageId, deckSize }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) {
    throw new Error("Stage not found");
  }

  const stage = planet.stages[0];
  let state = stage.state || emptyStageState();

  const level       = stageLevel(stage, stageId);
  const targetScore = getTargetScore(level);

  const hasDeck =
    state.deck &&
    Array.isArray(state.deck.remainingTiles) &&
    state.deck.remainingTiles.length > 0;

  if (!hasDeck) {
    const { hand, deck } = await createDeckAndHand(deckSize, 3, { level, targetScore });

    state = { ...state, hand, deck };

    await Planet.updateOne(
      { userId, planetId, "stages.stageId": stageId },
      {
        $set: {
          "stages.$.state": state,
          "stages.$.meta.isStarted": true,
          "stages.$.meta.lastPlayedAt": new Date(),
        },
      }
    );
  } else {
    // Stage already has a deck — always mark as started when accessed
    await Planet.updateOne(
      { userId, planetId, "stages.stageId": stageId },
      {
        $set: {
          "stages.$.meta.isStarted": true,
          "stages.$.meta.lastPlayedAt": new Date(),
        },
      }
    );
  }

  return {
    planetId,
    stageId,
    meta: stage.meta,
    state,
    targetScore,
  };
}

async function saveStageState({ userId, planetId, stageId, state }) {
  if (!state?.hand || !state?.deck) {
    throw new Error("Invalid state: hand/deck required");
  }

  const updated = await Planet.findOneAndUpdate(
    { userId, planetId, "stages.stageId": stageId },
    {
      $set: {
        "stages.$.state": state,
        "stages.$.meta.lastPlayedAt": new Date(),
      },
    },
    { new: true, projection: { stages: { $elemMatch: { stageId } } } }
  ).lean();

  if (!updated || !updated.stages.length) {
    throw new Error("Stage not found");
  }

  return {
    planetId,
    stageId,
    meta: updated.stages[0].meta,
    state: updated.stages[0].state,
  };
}

async function resetStageState({ userId, planetId, stageId }) {
  const emptyState = {
    map: { placedTiles: [] },
    hand: { maxHandSize: 3, tilesInHand: [] },
    deck: { remainingTiles: [] },
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };

  const updated = await Planet.findOneAndUpdate(
    { userId, planetId, "stages.stageId": stageId },
    {
      $set: {
        "stages.$.state": emptyState,
        "stages.$.meta.isStarted": false,
        "stages.$.meta.lastPlayedAt": null,
      },
    },
    { new: true, projection: { stages: { $elemMatch: { stageId } } } }
  ).lean();

  if (!updated || !updated.stages?.length) {
    throw new Error("Stage not found");
  }

  return {
    planetId,
    stageId,
    ...emptyState,
  };
}

function getAxialNeighbors(q, r) {
  return [
    { q: q + 1, r },
    { q: q - 1, r },
    { q, r: r + 1 },
    { q, r: r - 1 },
    { q: q + 1, r: r - 1 },
    { q: q - 1, r: r + 1 },
  ];
}

async function placeTile({ userId, planetId, stageId, tileId, coord, rotation }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) throw new Error("Stage not found");

  const stage = planet.stages[0];
  const state = stage.state;
  if (!state) throw new Error("Stage state not initialized. Load stage first.");

  const hand = state.hand?.tilesInHand ?? [];
  const deck = state.deck?.remainingTiles ?? [];
  const placedTiles = state.map?.placedTiles ?? [];

  // Validate tile is slot 0 of the hand
  if (hand.length === 0 || hand[0] !== tileId) {
    throw new Error("Tile must be in slot 0 of the hand");
  }

  const { q, r } = coord;
  const rot = ((rotation % 6) + 6) % 6;

  // Validate cell is not already occupied
  const isOccupied = placedTiles.some(t => t.coord.q === q && t.coord.r === r);
  if (isOccupied) throw new Error("Cell already occupied");

  // Validate placement adjacency (first tile must be at origin)
  if (placedTiles.length === 0) {
    if (q !== 0 || r !== 0) throw new Error("First tile must be placed at (0,0)");
  } else {
    const neighbors = getAxialNeighbors(q, r);
    const isAdjacent = neighbors.some(n =>
      placedTiles.some(t => t.coord.q === n.q && t.coord.r === n.r)
    );
    if (!isAdjacent) throw new Error("Cell is not adjacent to any placed tile");
  }

  // Remove tile from slot 0, shift hand
  const newHand = hand.slice(1);

  // Draw from deck if available
  const newDeck = [...deck];
  if (newDeck.length > 0) {
    const drawn = newDeck.shift();
    newHand.push(drawn);
  }

  // Add tile to map
  const newPlacedTiles = [...placedTiles, { tileId, coord: { q, r }, rotation: rot }];

  // Count new correct connections via edge matching.
  // Direction order matches Unity's HexMapManager.axialDirs:
  //   dir 0: (1,0), dir 1: (1,-1), dir 2: (0,-1), dir 3: (-1,0), dir 4: (-1,1), dir 5: (0,1)
  const EDGE_DIRS = [
    { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
    { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
  ];

  // Fetch ALL placed tile templates (needed for cluster analysis)
  const allTileIds = new Set([tileId]);
  for (const tile of placedTiles) allTileIds.add(tile.tileId);

  const rawTemplates = await HexTile.find({ _id: { $in: [...allTileIds] } }, { edges: 1, center: 1 }).lean();
  const templateMap = new Map(rawTemplates.map(t => [String(t._id), t]));

  // Build coord→index map for fast lookup
  const coordMap = new Map();
  newPlacedTiles.forEach((tile, idx) => {
    coordMap.set(`${tile.coord.q},${tile.coord.r}`, idx);
  });

  const newTemplate = templateMap.get(tileId);
  const faceIdx = d => (d + 2) % 6;
  let newConnections = 0;
  const scoredConnections = [];

  if (newTemplate) {
    // Face 2 in the 3D model points East (axial dir 0), so faceIdx(d) = (d+2)%6
    for (let dir = 0; dir < 6; dir++) {
      const { dq, dr } = EDGE_DIRS[dir];
      const neighbor = placedTiles.find(t => t.coord.q === q + dq && t.coord.r === r + dr);
      if (!neighbor) continue;
      const neighborTemplate = templateMap.get(neighbor.tileId);
      if (!neighborTemplate) continue;

      const newEdge = newTemplate.edges[(faceIdx(dir) - rot + 6) % 6];
      const oppDir = (dir + 3) % 6;
      const neighborEdge = neighborTemplate.edges[(faceIdx(oppDir) - neighbor.rotation + 6) % 6];

      if (newEdge === neighborEdge) {
        newConnections++;
        scoredConnections.push({ q: neighbor.coord.q, r: neighbor.coord.r });
      }
    }
  }

  // Count how many of the scored connections matched the stage's base resource
  const stageResourceType = stage.meta?.resourceType ?? "";
  const prevBaseConnections = state.progress?.baseResourceConnections ?? 0;
  let baseConnectionsGained = 0;
  if (newTemplate && stageResourceType) {
    for (let dir = 0; dir < 6; dir++) {
      const { dq, dr } = EDGE_DIRS[dir];
      const neighbor = placedTiles.find(t => t.coord.q === q + dq && t.coord.r === r + dr);
      if (!neighbor) continue;
      const neighborTemplate = templateMap.get(neighbor.tileId);
      if (!neighborTemplate) continue;
      const newEdge = newTemplate.edges[(faceIdx(dir) - rot + 6) % 6];
      const oppDir = (dir + 3) % 6;
      const neighborEdge = neighborTemplate.edges[(faceIdx(oppDir) - neighbor.rotation + 6) % 6];
      if (newEdge === neighborEdge && newEdge === stageResourceType)
        baseConnectionsGained++;
    }
  }

  const totalBaseConnections = prevBaseConnections + baseConnectionsGained;
  const bonusPoints = Math.floor(totalBaseConnections / 5) - Math.floor(prevBaseConnections / 5);


  // Count connections within the cluster reachable from the new tile for a given resource.
  // Two tiles are cluster-neighbours if they are adjacent AND both touching faces match that resource.
  // Uses BFS from the new tile, then counts edges inside the visited set.
  const newTileIndex = newPlacedTiles.length - 1;

  function countClusterConnections(resource) {
    const n = newPlacedTiles.length;
    const adj = Array.from({ length: n }, () => []);
    const edges = [];

    for (let i = 0; i < n; i++) {
      const tile = newPlacedTiles[i];
      const tmpl = templateMap.get(tile.tileId);
      if (!tmpl) continue;

      for (let dir = 0; dir < 6; dir++) {
        const { dq, dr } = EDGE_DIRS[dir];
        const j = coordMap.get(`${tile.coord.q + dq},${tile.coord.r + dr}`);
        if (j === undefined || j <= i) continue;

        const nb = newPlacedTiles[j];
        const nbTmpl = templateMap.get(nb.tileId);
        if (!nbTmpl) continue;

        const edgeA = tmpl.edges[(faceIdx(dir) - tile.rotation + 6) % 6];
        const oppDir = (dir + 3) % 6;
        const edgeB = nbTmpl.edges[(faceIdx(oppDir) - nb.rotation + 6) % 6];

        if (edgeA === resource && edgeA === edgeB) {
          adj[i].push(j);
          adj[j].push(i);
          edges.push([i, j]);
        }
      }
    }

    // BFS from the new tile to find its cluster
    const visited = new Set();
    const stack = [newTileIndex];
    while (stack.length > 0) {
      const curr = stack.pop();
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const next of adj[curr]) stack.push(next);
    }

    // Count edges whose both endpoints are in the cluster
    return edges.filter(([a, b]) => visited.has(a) && visited.has(b)).length;
  }

  const levelFor = resource =>
    Math.min(3, 1 + Math.floor(countClusterConnections(resource) / 5));

  const tileFaces = newTemplate
    ? newTemplate.edges.map(resource => ({
        resource,
        variant: Math.random() < 0.5 ? 1 : 2,
        level: levelFor(resource),
      }))
    : [];

  const tileCenterResource = newTemplate?.center ?? "";
  const tileCenter = {
    resource: tileCenterResource,
    level: levelFor(tileCenterResource),
  };

  // Store face/center data on the placed tile record
  newPlacedTiles[newPlacedTiles.length - 1] = {
    tileId, coord: { q, r }, rotation: rot,
    faces: tileFaces,
    center: tileCenter,
  };

  // Calculate progress
  const score = (state.progress?.score ?? 0) + newConnections + bonusPoints;
  const targetScore = getTargetScore(stageLevel(stage, stageId));
  const isCompleted = score >= targetScore;
  const developedPercent = Math.min(100, Math.round((score / targetScore) * 100));

  const newState = {
    map: { placedTiles: newPlacedTiles },
    hand: { maxHandSize: state.hand?.maxHandSize ?? 3, tilesInHand: newHand },
    deck: { remainingTiles: newDeck },
    progress: { developedPercent, score, isCompleted, baseResourceConnections: totalBaseConnections },
  };

  // Calculate coins awarded on completion
  const tilesRemaining = newHand.length + newDeck.length;
  const coinsAwarded = isCompleted
    ? tilesRemaining >= 6 ? 3 : tilesRemaining >= 3 ? 2 : 1
    : 0;

  const updateFields = {
    "stages.$.state": newState,
    "stages.$.meta.lastPlayedAt": new Date(),
  };
  if (isCompleted) {
    updateFields["stages.$.meta.isCompleted"] = true;
    updateFields["stages.$.meta.coinsAwarded"] = coinsAwarded;
  }

  await Planet.updateOne(
    { userId, planetId, "stages.stageId": stageId },
    { $set: updateFields }
  );

  // On completion: add coins to planet total and unlock neighboring stages
  if (isCompleted) {
    await Planet.updateOne(
      { userId, planetId },
      { $inc: { totalCoins: coinsAwarded } }
    );
  }

  // On completion: unlock neighboring stages in the stage map
  if (isCompleted) {
    const stageCoord = stage.meta?.coord;
    if (stageCoord) {
      const neighborCoordKeys = DIRS.map(d =>
        `${stageCoord.q + d.q}_${stageCoord.r + d.r}`
      );

      const fullPlanet = await Planet.findOne(
        { userId, planetId },
        { "stages.stageId": 1, "stages.meta.coord": 1, "stages.meta.isUnlocked": 1 }
      ).lean();

      const stagesToUnlock = (fullPlanet?.stages ?? [])
        .filter(s =>
          s.meta?.coord &&
          neighborCoordKeys.includes(`${s.meta.coord.q}_${s.meta.coord.r}`) &&
          !s.meta.isUnlocked
        )
        .map(s => s.stageId);

      if (stagesToUnlock.length > 0) {
        await Planet.updateOne(
          { userId, planetId },
          { $set: { "stages.$[elem].meta.isUnlocked": true } },
          { arrayFilters: [{ "elem.stageId": { $in: stagesToUnlock } }] }
        );
      }
    }
  }

  return {
    planetId,
    stageId,
    map: newState.map,
    hand: newState.hand,
    deck: newState.deck,
    progress: newState.progress,
    targetScore,
    coinsAwarded,
    scoredConnections,
    bonusPoints,
  };
}

module.exports = {
  getStageState,
  saveStageState,
  resetStageState,
  placeTile,
};
