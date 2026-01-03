const redis = require('../config/redisClient');

function getTodayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureDailyTTL(key) {
  const ttl = await redis.ttl(key);
  if (ttl === -1) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const seconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    if (seconds > 0) {
      await redis.expire(key, seconds);
    }
  }
}

async function updateScore({ playerId, username, region, mode, delta }) {
  if (!playerId || !region || !mode || !Number.isFinite(delta)) {
    throw new Error('Invalid score update payload');
  }

  const today = getTodayKey();
  const globalKey = `lb:${today}:mode:${mode}`;
  const regionKey = `lb:${today}:region:${region}:mode:${mode}`;

  const pipeline = redis.pipeline();

  pipeline.hset(`player:${playerId}`, {
    username: username || '',
    region,
    mode
  });

  pipeline.zincrby(globalKey, delta, playerId);
  pipeline.zincrby(regionKey, delta, playerId);

  const results = await pipeline.exec();

  const newGlobalScore = parseFloat(results[1][1]);
  const newRegionScore = parseFloat(results[2][1]);

  await Promise.all([
    ensureDailyTTL(globalKey),
    ensureDailyTTL(regionKey)
  ]);

  return {
    playerId,
    region,
    mode,
    globalScore: newGlobalScore,
    regionScore: newRegionScore
  };
}

async function getTop({ region, mode, limit = 10 }) {
  if (!mode) {
    throw new Error('Mode is required');
  }

  const today = getTodayKey();
  const key = region
    ? `lb:${today}:region:${region}:mode:${mode}`
    : `lb:${today}:mode:${mode}`;

  const raw = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

  const players = [];
  for (let i = 0; i < raw.length; i += 2) {
    const playerId = raw[i];
    const score = parseFloat(raw[i + 1]);
    players.push({ playerId, score });
  }

  if (players.length === 0) {
    return [];
  }

  const pipeline = redis.pipeline();
  players.forEach((p) => {
    pipeline.hgetall(`player:${p.playerId}`);
  });

  const metaResults = await pipeline.exec();

  return players.map((p, idx) => {
    const meta = metaResults[idx][1] || {};
    return {
      rank: idx + 1,
      playerId: p.playerId,
      username: meta.username || null,
      region: meta.region || null,
      mode: meta.mode || mode,
      score: p.score
    };
  });
}

module.exports = {
  updateScore,
  getTop
};
