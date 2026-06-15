const Planet = require("../model/Planet_model");
const User   = require("../model/User_model");
const HexTile = require("../model/HexTile_model");
const { DIRS } = require("./planet.service");
const { getTargetScore, getLevelFromStageId } = require("../config/stageConfig");
const { evaluateAchievementEvents } = require("./achievement.service");
const { consumeBooster } = require("./booster.service");
const { AVATAR_CATALOG } = require("../config/avatarCatalog");

function stageLevel(stage, stageId) {
  return stage.meta?.level ?? getLevelFromStageId(stageId);
}

// In-memory cache for HexTile templates (static data, never changes at runtime)
const _tileTemplateCache = new Map();

async function getTileTemplates(tileIds) {
  const missing = tileIds.filter(id => !_tileTemplateCache.has(id));
  if (missing.length > 0) {
    const fetched = await HexTile.find({ _id: { $in: missing } }, { edges: 1, type: 1 }).lean();
    for (const t of fetched) _tileTemplateCache.set(String(t._id), t);
  }
  return new Map(tileIds.map(id => [id, _tileTemplateCache.get(id)]));
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

  const { tileIds } = await generateStageDeck({
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

  const hasHand =
    state.hand &&
    Array.isArray(state.hand.tilesInHand) &&
    state.hand.tilesInHand.length > 0;

  const isAlreadyStarted = stage.meta?.isStarted === true;
  const isCompleted = state.progress?.isCompleted === true;

  if ((!hasDeck && !hasHand && !isAlreadyStarted) || isCompleted) {
    const { hand, deck } = await createDeckAndHand(deckSize, 3, { level, targetScore });

    state = { ...emptyStageState(), hand, deck };

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

async function placeTile({ userId, planetId, stageId, tileId, coord, rotation, activeBooster }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) throw new Error("Stage not found");

  const stage = planet.stages[0];
  const isMatchStage = !!stage.meta?.isMatchStage;
  const stageWasCompleted = !!stage.meta?.isCompleted;
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
  let drawnTileId = null;
  if (newDeck.length > 0) {
    drawnTileId = newDeck.shift();
    newHand.push(drawnTileId);
  }

  // Add tile to map
  const newPlacedTiles = [...placedTiles, { tileId, coord: { q, r }, rotation: rot }];

  // Count new correct connections via edge matching.
  // Direction order matches Unity's HexMapManager.axialDirs:
  //   dir 0: (1,0), dir 1: (1,-1), dir 2: (0,-1), dir 3: (-1,0), dir 4: (-1,1), dir 5: (0,1)
  // Prefab Face[0] points West (dir=3) at rot=0 → edge formula uses +9 offset instead of +6.
  const EDGE_DIRS = [
    { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
    { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 },
  ];

  // Fetch ALL placed tile templates (needed for cluster analysis)
  const allTileIds = [tileId, ...placedTiles.map(t => t.tileId)];
  const templateMap = await getTileTemplates(allTileIds);

  // Build coord→index map for fast lookup
  const coordMap = new Map();
  newPlacedTiles.forEach((tile, idx) => {
    coordMap.set(`${tile.coord.q},${tile.coord.r}`, idx);
  });

  const newTemplate = templateMap.get(tileId);

  let newConnections = 0;
  const scoredConnections = [];

  if (newTemplate) {
    for (let dir = 0; dir < 6; dir++) {
      const { dq, dr } = EDGE_DIRS[dir];
      const neighbor = placedTiles.find(t => t.coord.q === q + dq && t.coord.r === r + dr);
      if (!neighbor) continue;
      const neighborTemplate = templateMap.get(neighbor.tileId);
      if (!neighborTemplate) continue;

      // Standard opposing-face: new tile's face toward neighbor vs neighbor's face back.
      const oppDir = (dir + 3) % 6;
      const newEdge = newTemplate.edges[(dir - rot + 9) % 6];
      const nbEdge  = neighborTemplate.edges[(oppDir - neighbor.rotation + 9) % 6];
      const matchResource = newEdge === nbEdge ? newEdge : null;

      if (matchResource) {
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
      const oppDir2 = (dir + 3) % 6;
      const newEdge2 = newTemplate.edges[(dir - rot + 9) % 6];
      const nbEdge2  = neighborTemplate.edges[(oppDir2 - neighbor.rotation + 9) % 6];
      if (newEdge2 === nbEdge2 && newEdge2 === stageResourceType)
        baseConnectionsGained++;
    }
  }

  const totalBaseConnections = prevBaseConnections + baseConnectionsGained;
  const bonusPoints = stage.meta?.isMatchStage
    ? 0
    : Math.floor(totalBaseConnections / 5) - Math.floor(prevBaseConnections / 5);


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

        // Standard opposing-face for cluster: tile's face at dir vs neighbor's face at oppDir.
        const clusterOppDir = (dir + 3) % 6;
        const fA = tmpl.edges[(dir - tile.rotation + 9) % 6];
        const fB = nbTmpl.edges[(clusterOppDir - nb.rotation + 9) % 6];
        if (fA === resource && fA === fB) {
          adj[i].push(j);
          adj[j].push(i);
          edges.push([i, j, 1]);
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

    // Sum match counts for all edges within the cluster
    return edges.reduce((sum, [a, b, count]) =>
      visited.has(a) && visited.has(b) ? sum + count : sum, 0);
  }

  const levelFor = resource =>
    Math.min(3, 1 + Math.floor(countClusterConnections(resource) / 5));

  // Find connected components of tiles sharing a resource edge (for roaming animations)
  function findResourceClusters(tiles, resource, minSize) {
    const n = tiles.length;
    const cMap = new Map(tiles.map((t, i) => [`${t.coord.q},${t.coord.r}`, i]));
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      const tile = tiles[i];
      const tmpl = templateMap.get(tile.tileId);
      if (!tmpl) continue;
      for (let dir = 0; dir < 6; dir++) {
        const { dq, dr } = EDGE_DIRS[dir];
        const j = cMap.get(`${tile.coord.q + dq},${tile.coord.r + dr}`);
        if (j === undefined || j <= i) continue;
        const nb = tiles[j];
        const nbTmpl = templateMap.get(nb.tileId);
        if (!nbTmpl) continue;
        const fA = tmpl.edges[(dir - tile.rotation + 9) % 6];
        const oppDir = (dir + 3) % 6;
        const fB = nbTmpl.edges[(oppDir - nb.rotation + 9) % 6];
        if (fA === resource && fA === fB) { adj[i].push(j); adj[j].push(i); }
      }
    }
    const visited = new Set();
    const clusters = [];
    for (let start = 0; start < n; start++) {
      if (visited.has(start)) continue;
      const stack = [start];
      const component = [];
      while (stack.length > 0) {
        const curr = stack.pop();
        if (visited.has(curr)) continue;
        visited.add(curr);
        component.push(curr);
        for (const next of adj[curr]) stack.push(next);
      }
      if (component.length >= minSize)
        clusters.push(component.map(i => tiles[i].coord));
    }
    return clusters;
  }

  const allResourceTypes = new Set();
  for (const tile of newPlacedTiles) {
    const tmpl = templateMap.get(tile.tileId);
    if (tmpl) tmpl.edges.forEach(e => e && allResourceTypes.add(e));
  }
  const claimedCoords = new Set();
  const roamingClusters = [];
  for (const resource of allResourceTypes) {
    for (const coords of findResourceClusters(newPlacedTiles, resource, 10)) {
      const key = c => `${c.q},${c.r}`;
      const unique = coords.filter(c => !claimedCoords.has(key(c)));
      if (unique.length < 10) continue;
      unique.forEach(c => claimedCoords.add(key(c)));
      roamingClusters.push({ coords: unique, size: unique.length, resourceType: resource });
    }
  }

  // faces[i] = the resource at model Face0i. The material on face i is always edges[i]
  // regardless of rotation (the whole tile rotates, face materials stay attached).
  const tileFaces = newTemplate
    ? newTemplate.edges.map((resource, i) => ({
        resource,
        variant: Math.random() < 0.5 ? 1 : 2,
        level: levelFor(resource),
      }))
    : [];

  // Store face data on the placed tile record
  newPlacedTiles[newPlacedTiles.length - 1] = {
    tileId, coord: { q, r }, rotation: rot,
    faces: tileFaces,
  };

  // Apply doubleScore booster
  const useDoubleScore = activeBooster === "doubleScore";
  if (useDoubleScore) {
    await consumeBooster(userId, "doubleScore");
    evaluateAchievementEvents({ userId, events: [{ metricKey: "single.boost_types_used", mode: "unique", uniqueValue: "doubleScore" }] }).catch(() => {});
  }
  const scoreMultiplier = useDoubleScore ? 2 : 1;
  const scoreGained = (newConnections + bonusPoints) * scoreMultiplier;

  // Calculate progress
  const score = (state.progress?.score ?? 0) + scoreGained;
  const targetScore = getTargetScore(stageLevel(stage, stageId));
  const isCompleted = !isMatchStage && score >= targetScore;
  const justCompleted = isCompleted && !stageWasCompleted;
  const developedPercent = Math.min(100, Math.round((score / targetScore) * 100));

  const lastPlacement = {
    tileId,
    coord: { q, r },
    rotation: rot,
    scoreGained,
    bonusGained: bonusPoints * scoreMultiplier,
    baseConnectionsGained,
    drawnTileId,
  };

  const newState = {
    map: { placedTiles: newPlacedTiles },
    hand: { maxHandSize: state.hand?.maxHandSize ?? 3, tilesInHand: newHand },
    deck: { remainingTiles: newDeck },
    progress: { developedPercent, score, isCompleted, baseResourceConnections: totalBaseConnections },
    lastPlacement: isCompleted ? null : lastPlacement,
  };

  // Calculate coins awarded on completion
  const tilesRemaining = newHand.length + newDeck.length;
  const newlyAwardedStageCoins = justCompleted
    ? tilesRemaining >= 6 ? 3 : tilesRemaining >= 3 ? 2 : 1
    : 0;
  const coinsAwarded = isCompleted
    ? (justCompleted ? newlyAwardedStageCoins : (stage.meta?.coinsAwarded ?? 0))
    : 0;

  const updateFields = {
    "stages.$.state": newState,
    "stages.$.meta.lastPlayedAt": new Date(),
  };
  if (justCompleted) {
    updateFields["stages.$.meta.isCompleted"] = true;
    updateFields["stages.$.meta.coinsAwarded"] = newlyAwardedStageCoins;
  }

  // ── Normal tile: parallel save + achievement evaluation ──────────────────
  // For non-completion placements these two are completely independent.
  // For completion we need the coins/unlock results before we can return,
  // so we do a tailored parallel strategy below.

  let userCoins = null;
  let achievementResult;

  if (!justCompleted) {
    // Build events synchronously (no awaits needed when not completing)
    const achievementEvents = buildAchievementEvents({
      isMatchStage,
      justCompleted: false,
      newPlacedTiles,
      newConnections,
      newTemplate,
      score,
      coinsAwarded,
      planetCompleted: false,
    });

    // Save state and evaluate achievements in parallel
    [, achievementResult] = await Promise.all([
      Planet.updateOne(
        { userId, planetId, "stages.stageId": stageId },
        { $set: updateFields }
      ),
      evaluateAchievementEvents({ userId, planetId, events: achievementEvents }),
    ]);
  } else {
    // ── Completion path ───────────────────────────────────────────────────
    const stageCoord = stage.meta?.coord;
    const neighborCoordKeys = stageCoord
      ? DIRS.map(d => `${stageCoord.q + d.q}_${stageCoord.r + d.r}`)
      : [];

    // Batch 1: save state + add coins + fetch planet for neighbor/avatar data
    // (all independent of each other)
    const [, updatedUser, fullPlanet] = await Promise.all([
      Planet.updateOne(
        { userId, planetId, "stages.stageId": stageId },
        { $set: updateFields }
      ),
      User.findOneAndUpdate(
        { _id: userId },
        { $inc: { coins: newlyAwardedStageCoins } },
        { new: true, projection: { coins: 1 } }
      ).lean(),
      Planet.findOne(
        { userId, planetId },
        {
          "stages.stageId": 1,
          "stages.meta.coord": 1,
          "stages.meta.isUnlocked": 1,
          "stages.meta.isCompleted": 1,
          "stages.meta.isMatchStage": 1,
        }
      ).lean(),
    ]);

    userCoins = updatedUser?.coins ?? null;

    // Derive neighbor unlock list and avatar grant from the single planet fetch
    const stagesToUnlock = stageCoord
      ? (fullPlanet?.stages ?? [])
          .filter(s =>
            s.meta?.coord &&
            neighborCoordKeys.includes(`${s.meta.coord.q}_${s.meta.coord.r}`) &&
            !s.meta.isUnlocked
          )
          .map(s => s.stageId)
      : [];

    const normalStages = (fullPlanet?.stages ?? []).filter(s => !s.meta?.isMatchStage);
    const completedCount = normalStages.filter(s => !!s.meta?.isCompleted).length;
    // The current stage is now completed too (not yet reflected in fullPlanet)
    const playerLevel = completedCount + 1;
    const toGrant = AVATAR_CATALOG
      .filter(a => a.unlockType === "stage" && a.stageRequired === playerLevel)
      .map(a => a.id);

    const planetCompleted =
      normalStages.length > 0 &&
      normalStages.every(s => !!s.meta?.isCompleted || s.stageId === stageId);

    // Batch 2: unlock neighbors + grant avatars + evaluate achievements (all independent)
    const achievementEvents = buildAchievementEvents({
      isMatchStage,
      justCompleted: true,
      newPlacedTiles,
      newConnections,
      newTemplate,
      score,
      coinsAwarded,
      planetCompleted,
    });

    const unlockPromise = stagesToUnlock.length > 0
      ? Planet.updateOne(
          { userId, planetId },
          { $set: { "stages.$[elem].meta.isUnlocked": true } },
          { arrayFilters: [{ "elem.stageId": { $in: stagesToUnlock } }] }
        )
      : Promise.resolve();

    const avatarPromise = toGrant.length > 0
      ? User.updateOne({ _id: userId }, { $addToSet: { ownedAvatars: { $each: toGrant } } })
      : Promise.resolve();

    [,, achievementResult] = await Promise.all([
      unlockPromise,
      avatarPromise,
      evaluateAchievementEvents({ userId, planetId, events: achievementEvents }),
    ]);
  }

  if (achievementResult.userCoins !== null && achievementResult.userCoins !== undefined) {
    userCoins = achievementResult.userCoins;
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
    userCoins,
    achievementRewards: achievementResult.unlocked,
    achievementCoinsAwarded: achievementResult.coinsAwarded,
    scoredConnections,
    bonusPoints: bonusPoints * scoreMultiplier,
    roamingClusters,
    doubleScoreUsed: useDoubleScore,
  };
}

async function cancelLastTile({ userId, planetId, stageId }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) throw new Error("Stage not found");

  const stage = planet.stages[0];
  const state = stage.state;
  if (!state) throw new Error("Stage state not initialized");

  const last = state.lastPlacement;
  if (!last || !last.tileId) throw new Error("No placement to cancel");
  if (state.progress?.isCompleted) throw new Error("Cannot undo a completed stage");

  await consumeBooster(userId, "cancelPlacement");
  const cancelAchResult = await evaluateAchievementEvents({ userId, events: [{ metricKey: "single.boost_types_used", mode: "unique", uniqueValue: "cancelPlacement" }] }).catch(() => ({ unlocked: [], coinsAwarded: 0 }));

  const placedTiles = state.map?.placedTiles ?? [];
  const restoredTiles = placedTiles.filter(
    t => !(t.coord.q === last.coord.q && t.coord.r === last.coord.r)
  );

  // Restore drawn tile to front of deck, restore placed tile to front of hand
  const restoredDeck = last.drawnTileId
    ? [last.drawnTileId, ...(state.deck?.remainingTiles ?? [])]
    : [...(state.deck?.remainingTiles ?? [])];

  const currentHand = state.hand?.tilesInHand ?? [];
  const handWithoutDrawn = last.drawnTileId
    ? currentHand.filter(id => id !== last.drawnTileId)
    : [...currentHand];
  const restoredHand = [last.tileId, ...handWithoutDrawn];

  const prevScore = state.progress?.score ?? 0;
  const newScore = Math.max(0, prevScore - last.scoreGained);
  const prevBase = state.progress?.baseResourceConnections ?? 0;
  const newBase = Math.max(0, prevBase - last.baseConnectionsGained);
  const targetScore = getTargetScore(stageLevel(stage, stageId));
  const developedPercent = Math.min(100, Math.round((newScore / targetScore) * 100));

  const newState = {
    map: { placedTiles: restoredTiles },
    hand: { maxHandSize: state.hand?.maxHandSize ?? 3, tilesInHand: restoredHand },
    deck: { remainingTiles: restoredDeck },
    progress: { developedPercent, score: newScore, isCompleted: false, baseResourceConnections: newBase },
    lastPlacement: null,
  };

  await Planet.updateOne(
    { userId, planetId, "stages.stageId": stageId },
    { $set: { "stages.$.state": newState, "stages.$.meta.lastPlayedAt": new Date() } }
  );

  return {
    planetId,
    stageId,
    map: newState.map,
    hand: newState.hand,
    deck: newState.deck,
    progress: newState.progress,
    targetScore,
    achievementRewards: cancelAchResult.unlocked,
  };
}

async function addHexToHand({ userId, planetId, stageId }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) throw new Error("Stage not found");

  const stage = planet.stages[0];
  const state = stage.state;
  if (!state) throw new Error("Stage state not initialized");

  await consumeBooster(userId, "addHex");
  const addHexAchResult = await evaluateAchievementEvents({ userId, events: [{ metricKey: "single.boost_types_used", mode: "unique", uniqueValue: "addHex" }] }).catch(() => ({ unlocked: [], coinsAwarded: 0 }));

  // Pick a random tile from the full catalog (new tile, not from existing deck)
  const allTiles = await HexTile.find({}, { _id: 1 }).lean();
  if (!allTiles.length) throw new Error("No HexTile templates found");
  const randomTile = allTiles[Math.floor(Math.random() * allTiles.length)];
  const newTileId = String(randomTile._id);

  const newHand = [newTileId, ...(state.hand?.tilesInHand ?? [])];
  const newDeck = state.deck?.remainingTiles ?? [];

  const newState = {
    ...state,
    hand: { maxHandSize: state.hand?.maxHandSize ?? 3, tilesInHand: newHand },
    deck: { remainingTiles: newDeck },
  };

  await Planet.updateOne(
    { userId, planetId, "stages.stageId": stageId },
    { $set: { "stages.$.state": newState, "stages.$.meta.lastPlayedAt": new Date() } }
  );

  const targetScore = getTargetScore(stageLevel(stage, stageId));

  return {
    planetId,
    stageId,
    map: newState.map,
    hand: newState.hand,
    deck: newState.deck,
    progress: newState.progress,
    targetScore,
    achievementRewards: addHexAchResult.unlocked,
  };
}

function buildAchievementEvents({
  isMatchStage,
  justCompleted,
  newPlacedTiles,
  newConnections,
  newTemplate,
  score,
  coinsAwarded,
  planetCompleted,
}) {
  const events = [];

  if (isMatchStage) {
    events.push({ metricKey: "multi.tiles_placed_total", mode: "inc", value: 1 });
    return events;
  }

  events.push({ metricKey: "single.tiles_placed_total", mode: "inc", value: 1 });
  events.push({
    metricKey: "single.tiles_placed_in_level",
    mode: "max",
    value: newPlacedTiles.length,
  });

  if (newTemplate?.type) {
    events.push({
      metricKey: "single.tile_types_used",
      mode: "unique",
      uniqueValue: newTemplate.type,
    });
  }

  if (newConnections > 0) {
    events.push({
      metricKey: "single.hex_matches_total",
      mode: "inc",
      value: newConnections,
    });
  }

  if (justCompleted) {
    events.push({ metricKey: "single.levels_completed", mode: "inc", value: 1 });
    events.push({ metricKey: "single.score_in_level", mode: "max", value: score });

    if (coinsAwarded >= 3) {
      events.push({
        metricKey: "single.level_completed_stars",
        mode: "max",
        value: coinsAwarded,
      });
      events.push({ metricKey: "single.three_star_levels", mode: "inc", value: 1 });
    }

    if (planetCompleted) {
      events.push({ metricKey: "single.planets_completed", mode: "inc", value: 1 });
    }
  }

  return events;
}

async function isPlanetCompleted({ userId, planetId }) {
  const fullPlanet = await Planet.findOne(
    { userId, planetId },
    { "stages.stageId": 1, "stages.meta.isCompleted": 1, "stages.meta.isMatchStage": 1 }
  ).lean();

  const normalStages = (fullPlanet?.stages ?? []).filter(stage => !stage.meta?.isMatchStage);
  return normalStages.length > 0 && normalStages.every(stage => !!stage.meta?.isCompleted);
}

module.exports = {
  getStageState,
  saveStageState,
  resetStageState,
  placeTile,
  createDeckAndHand,
  cancelLastTile,
  addHexToHand,
};
