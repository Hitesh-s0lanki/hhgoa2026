/**
 * Builder-title derivation — the brief's "generated builder title", produced in
 * about two milliseconds with no API key, no network, and no chance of putting
 * something embarrassing next to someone's real name and face.
 *
 * ADR-007 (docs/tasks/T-017) has the reasoning: an LLM call here costs
 * 300 ms–several seconds, can fail, can be rate-limited, and buys nothing the
 * user can perceive over a curated table. Titles need to be flattering and
 * instant, not novel.
 */

type Rule = { match: RegExp; titles: readonly string[] };

/** Order matters — the first match wins, so specific rules precede general ones. */
const RULES: readonly Rule[] = [
  {
    match: /\b(ml|ai|machine learning|deep learning|llm|nlp)\b/,
    titles: ["AI PRODUCT BUILDER", "MODEL WRANGLER", "NEURAL ARCHITECT"],
  },
  {
    match: /\b(founder|ceo|co-?founder|entrepreneur)\b/,
    titles: ["STARTUP BUILDER", "ZERO-TO-ONE OPERATOR", "CHIEF SHIPPER"],
  },
  {
    match: /\b(design|designer|ux|ui)\b/,
    titles: ["PIXEL ARCHITECT", "INTERFACE CRAFTSMAN", "EXPERIENCE BUILDER"],
  },
  {
    match: /\b(devops|sre|platform|infra|infrastructure|cloud)\b/,
    titles: ["SYSTEMS TAMER", "UPTIME GUARDIAN", "PLATFORM BUILDER"],
  },
  {
    match: /\b(data|analytics|scientist|bi)\b/,
    titles: ["SIGNAL HUNTER", "DATA ALCHEMIST", "INSIGHT BUILDER"],
  },
  {
    match: /\b(security|infosec|appsec|pentest)\b/,
    titles: ["THREAT HUNTER", "PERIMETER KEEPER"],
  },
  {
    match: /\b(mobile|ios|android|flutter|react native)\b/,
    titles: ["POCKET-SIZED SHIPPER", "MOBILE BUILDER"],
  },
  {
    match: /\b(front-?end|react|next\.?js|vue|angular)\b/,
    titles: ["INTERFACE BUILDER", "PIXEL PUSHER"],
  },
  {
    match: /\b(back-?end|api|server|golang|rust|java|python)\b/,
    titles: ["SYSTEMS BUILDER", "API ARCHITECT"],
  },
  {
    match: /\b(full-?stack|fullstack|swe|software engineer|developer|dev|engineer)\b/,
    titles: ["FULL-STACK ARCHITECT", "CODE ALCHEMIST", "PRODUCT HACKER"],
  },
  { match: /\b(pm|product manager|product)\b/, titles: ["PRODUCT BUILDER", "ROADMAP WRANGLER"] },
  {
    match: /\b(student|intern|learning|bootcamp)\b/,
    titles: ["BUILDER IN TRAINING", "FUTURE SHIPPER"],
  },
];

const FALLBACK = ["BUILDER", "MAKER", "SHIPPER", "GOA BUILDER"] as const;

/**
 * Stable string hash (FNV-1a). Not for security — just for repeatable picks.
 * `Math.imul` is not decoration: a plain `*` overflows to a float and the hash
 * stops being stable across engines.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The same role always yields the same title, so the preview does not flicker
 * as someone types. `reroll` cycles the matched pool — press it enough times
 * and you land back where you started, which is what a cycle control should do.
 */
export function deriveTitle(role: string, reroll = 0): string {
  const normalized = role.toLowerCase().trim();
  if (!normalized) return FALLBACK[Math.abs(reroll) % FALLBACK.length]!;

  const pool = RULES.find((rule) => rule.match.test(normalized))?.titles ?? FALLBACK;
  return pool[(hash(normalized) + Math.abs(reroll)) % pool.length]!;
}
