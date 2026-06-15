const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const PROMPTS = {
  bigMove: (delta) =>
    `You are a witty game commentator for a hex tile building game. A player just scored ${delta} points in a single tile placement. Write one short, punchy taunt (max 12 words) directed at their opponent. Be playful, not mean. Reply with plain text only, no markdown.`,
  underdog: (gap) =>
    `You are an enthusiastic game commentator for a hex tile building game. A player is behind by ${gap} points. Write one short, energetic encouragement (max 12 words) to keep them motivated. Reply with plain text only, no markdown.`,
  overtake: () =>
    `You are an excited game commentator for a hex tile building game. A player just overtook their opponent to take the lead. Write one short, thrilling announcement (max 12 words). Reply with plain text only, no markdown.`,
};

// Simple in-memory cooldown: matchId → last reaction timestamp
const _cooldowns = {};
const COOLDOWN_MS = 8000;

async function generateReaction(eventType, matchId, context = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const now = Date.now();
  const key = `${matchId}_${eventType}`;
  if (_cooldowns[key] && now - _cooldowns[key] < COOLDOWN_MS) return null;
  _cooldowns[key] = now;

  const promptFn = PROMPTS[eventType];
  if (!promptFn) return null;

  const prompt = eventType === 'bigMove'
    ? promptFn(context.delta)
    : eventType === 'underdog'
    ? promptFn(context.gap)
    : promptFn();

  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text?.trim() ?? null;
}

module.exports = { generateReaction };
