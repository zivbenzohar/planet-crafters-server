function createDebugRates(options = {}) {
  const windowMs = Number.isFinite(options.windowMs) ? options.windowMs : 60000;
  const maxRoutes = Number.isFinite(options.maxRoutes) ? options.maxRoutes : 20;
  const ignorePaths = new Set(options.ignorePaths || []);

  const hits = [];
  const counts = new Map();
  let total = 0;

  function cleanup(now) {
    while (hits.length > 0 && now - hits[0].ts > windowMs) {
      const old = hits.shift();
      const next = (counts.get(old.key) || 1) - 1;
      if (next <= 0) {
        counts.delete(old.key);
      } else {
        counts.set(old.key, next);
      }
    }
  }

  function middleware(req, _res, next) {
    if (ignorePaths.has(req.path)) return next();
    const now = Date.now();
    const key = `${req.method} ${req.path}`;
    hits.push({ ts: now, key });
    counts.set(key, (counts.get(key) || 0) + 1);
    total += 1;
    cleanup(now);
    return next();
  }

  function handler(req, res) {
    const now = Date.now();
    cleanup(now);
    const windowSec = windowMs / 1000;
    const routes = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxRoutes)
      .map(([route, count]) => ({
        route,
        count,
        rps: Number((count / windowSec).toFixed(2)),
      }));

    return res.json({
      windowSec,
      count: hits.length,
      rps: Number((hits.length / windowSec).toFixed(2)),
      total,
      routes,
    });
  }

  return { middleware, handler };
}

module.exports = createDebugRates;
