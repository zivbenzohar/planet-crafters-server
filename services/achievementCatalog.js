const METRIC_BY_ID = {
  single_001: "single.levels_completed",
  single_002: "single.tiles_placed_in_level",
  single_003: "single.level_completed_seconds",
  single_004: "single.level_completed_stars",
  single_005: "single.levels_completed",
  single_006: "single.hex_matches_total",
  single_007: "single.boost_types_used",
  single_008: "single.tile_types_used",
  single_009: "single.hex_matches_total",
  single_010: "single.hex_matches_total",
  single_011: "single.hex_matches_total",
  single_012: "single.hex_matches_total",
  single_013: "single.hex_matches_total",
  single_014: "single.hex_matches_total",
  single_015: "single.hex_matches_total",
  single_016: "single.hex_matches_total",
  single_017: "single.hex_matches_total",
  single_018: "single.levels_completed",
  single_019: "single.levels_completed",
  single_020: "single.levels_completed",
  single_021: "single.levels_completed",
  single_022: "single.levels_completed",
  single_023: "single.levels_completed",
  single_024: "single.levels_completed",
  single_025: "single.levels_completed",
  single_026: "single.levels_completed",
  single_027: "single.planets_completed",
  single_028: "single.score_in_level",
  single_029: "single.no_boost_level_completions",
  single_030: "single.three_star_levels",

  multi_001: "multi.unlocked",
  multi_002: "multi.matches_played",
  multi_003: "multi.matches_won",
  multi_004: "multi.matches_played",
  multi_035: "multi.matches_played",
  multi_006: "multi.matches_played",
  multi_007: "multi.matches_played",
  multi_008: "multi.win_streak",
  multi_009: "multi.win_streak",
  multi_010: "multi.win_streak",
  multi_011: "multi.matches_won",
  multi_012: "multi.matches_won",
  multi_013: "multi.matches_won",
  multi_014: "multi.matches_won",
  multi_015: "multi.tiles_placed_total",
  multi_016: "multi.tiles_placed_total",
  multi_017: "multi.tiles_placed_total",
  multi_018: "multi.tiles_placed_total",
  multi_019: "multi.tiles_placed_total",
  multi_020: "multi.matches_played_streak",
  multi_021: "multi.matches_played_in_session",
  multi_022: "multi.comeback_wins",
  multi_023: "multi.matches_played",
  multi_024: "multi.matches_played",
  multi_025: "multi.matches_played",
  multi_026: "multi.matches_won",
  multi_027: "multi.matches_won",
  multi_028: "multi.matches_played_today",
  multi_029: "multi.matches_played_today",
  multi_030: "multi.tiles_placed_total",
};

const PROGRESS_MODE_BY_METRIC = {
  "single.tiles_placed_in_level": "max",
  "single.level_completed_seconds": "max",
  "single.level_completed_stars": "max",
  "single.tile_types_used": "unique",
  "single.score_in_level": "max",
  "multi.win_streak": "max",
  "multi.matches_played_streak": "max",
  "multi.matches_played_in_session": "max",
  "multi.matches_played_today": "max",
};

const TRIGGER_BY_METRIC = {
  "single.tiles_placed_total": "planet-state.place-tile",
  "single.tiles_placed_in_level": "planet-state.place-tile",
  "single.hex_matches_total": "planet-state.place-tile",
  "single.tile_types_used": "planet-state.place-tile",
  "single.levels_completed": "planet-state.stage-completed",
  "single.level_completed_stars": "planet-state.stage-completed",
  "single.score_in_level": "planet-state.stage-completed",
  "single.three_star_levels": "planet-state.stage-completed",
  "single.planets_completed": "planet-state.stage-completed",
  "multi.tiles_placed_total": "planet-state.place-tile",
  "multi.matches_played": "match.finished",
  "multi.matches_won": "match.finished",
};

function inferMetricKey(achievement) {
  if (!achievement) return "manual";

  if (METRIC_BY_ID[achievement.id]) {
    return METRIC_BY_ID[achievement.id];
  }

  const text = `${achievement.title || ""} ${achievement.description || ""}`.toLowerCase();
  const category = String(achievement.category || "").toLowerCase() === "multi" ? "multi" : "single";

  if (text.includes("first hex") || text.includes("first hexagon")) return "single.tiles_placed_total";
  if (text.includes("place") && (text.includes("tile") || text.includes("hex"))) {
    return category === "multi" ? "multi.tiles_placed_total" : "single.tiles_placed_in_level";
  }
  if (text.includes("complete") && text.includes("planet")) return "single.planets_completed";
  if (text.includes("complete") && text.includes("level")) return "single.levels_completed";
  if (text.includes("score") && text.includes("points")) return "single.score_in_level";
  if (text.includes("match") && text.includes("hex")) return "single.hex_matches_total";
  if (text.includes("win") && text.includes("match")) return "multi.matches_won";
  if (text.includes("play") && text.includes("match")) return "multi.matches_played";

  return "manual";
}

function getProgressMode(metricKey) {
  return PROGRESS_MODE_BY_METRIC[metricKey] || "inc";
}

function getTrigger(metricKey) {
  return TRIGGER_BY_METRIC[metricKey] || "manual";
}

module.exports = {
  inferMetricKey,
  getProgressMode,
  getTrigger,
};
