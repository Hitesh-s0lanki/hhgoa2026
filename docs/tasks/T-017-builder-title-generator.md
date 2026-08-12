# T-017 — Builder title generator

|                |                                       |
| -------------- | ------------------------------------- |
| **Phase**      | 3 — Render engine                     |
| **Status**     | ☐ Not started                         |
| **Estimate**   | 2 h                                   |
| **Depends on** | [T-001](T-001-scaffold-nextjs-app.md) |
| **Blocks**     | T-018                                 |
| **Satisfies**  | FR-3.5                                |

## Why this exists

The brief mentions "a generated builder title". This delivers it in ~2 ms with no API key, no network, and no chance of producing something embarrassing next to someone's real name and face.

ADR-007 covers the reasoning: an LLM call here costs 300 ms–several seconds, needs a key, can fail, can be rate-limited, and buys nothing the user can perceive over a well-curated table. The tradeoff would be different if titles needed to be genuinely novel; they need to be _flattering and instant_.

## Scope

**In:** the rules table, the derivation function, determinism, the reroll cycle, manual override, length guarantees.

**Out:** the form UI ([T-018](T-018-builder-form.md)), rendering ([T-016](T-016-format-b-builder-card.md)).

## Implementation notes

### Match on keywords, not exact strings

Real input is messy: "SWE", "Software Engineer II", "full stack dev", "fullstack", "Founder & CEO". Match on normalized substrings, most specific first.

```ts
// lib/brand/titles.ts
type Rule = { match: RegExp; titles: readonly string[] };

// Order matters: the first match wins, so specific rules precede general ones.
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
    match: /\b(design|designer|ux|ui|product design)\b/,
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

  { match: /\b(security|infosec|appsec|pentest)\b/, titles: ["THREAT HUNTER", "PERIMETER KEEPER"] },

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
```

### Deterministic selection

Same role always yields the same title, so the preview does not flicker as a user types and a screenshot test is stable.

```ts
/** Stable string hash (FNV-1a). Not for security — just for repeatable picks. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function deriveTitle(role: string, rerollIndex = 0): string {
  const norm = role.toLowerCase().trim();
  if (!norm) return FALLBACK[rerollIndex % FALLBACK.length]!;

  const pool = RULES.find((r) => r.match.test(norm))?.titles ?? FALLBACK;
  return pool[(hash(norm) + rerollIndex) % pool.length]!;
}
```

`Math.imul` is not decoration — plain `*` overflows to a float in JS and the hash stops being stable across engines.

### Reroll

`rerollIndex` cycles through the matched pool. Users get variety without randomness, so hitting reroll twice returns them to where they started rather than to a third arbitrary option — which is what people expect from a cycle control.

```ts
// in the store
rerollTitle: () => set(s => ({ rerollIndex: s.rerollIndex + 1 })),
// derived: deriveTitle(fields.role, rerollIndex)
```

### Manual override

Users must be able to type their own. The field is editable, and once edited the derivation stops:

```ts
type Fields = { /* … */ builderTitle?: string; titleIsManual?: boolean };
```

Some people will want "PROFESSIONAL YAK SHAVER" and that is a better outcome than any table.

### Length guarantee

```ts
const MAX_TITLE_LEN = 24; // fits at minSize on the card without wrapping
```

Every entry in every pool must be ≤ 24 characters, and a unit test enforces it. Manual input is capped at the same length in [T-018](T-018-builder-form.md). Longer titles are handled by [T-014](T-014-text-layout-engine.md) anyway, but a title that has to shrink loses the visual punch it exists for.

### Tone

The titles are meant to be a small piece of delight, so they should be:

- **Flattering, never diminishing.** "BUILDER IN TRAINING" is warm; "JUNIOR DEV" is not.
- **Short and punchy.** Two or three words; they are set in a display face, tracked, in caps.
- **Free of in-jokes that could read as an insult.** This text sits beside a real person's name and face on a public post.

Get the final list signed off with the brand caption ([Q-5](../11-open-questions.md)). It is the kind of copy an event team will have opinions about, and it is a one-file change.

## Acceptance criteria

- [ ] `deriveTitle('Software Engineer')` returns a sensible title
- [ ] Same input always returns the same output (deterministic)
- [ ] A 40-entry corpus of realistic role strings all map to a non-fallback title, except where fallback is genuinely right
- [ ] Case and whitespace variations map identically (`'SWE'`, `' swe '`, `'Swe'`)
- [ ] An unknown role (`'Yak Shaver'`) returns a fallback, not an empty string
- [ ] An empty role returns a fallback
- [ ] Every title in every pool is ≤ 24 characters — enforced by a test
- [ ] Reroll cycles through the pool and returns to the start
- [ ] Manual override suppresses derivation
- [ ] No network calls, no async, no environment variables
- [ ] Executes in under 1 ms
- [ ] More specific rules match before general ones (`'AI Engineer'` → an AI title, not a generic engineer title)

## Files touched

```
lib/brand/titles.ts
tests/unit/titles.test.ts
lib/store.ts        (rerollIndex, titleIsManual)
```

## How to test

```ts
// tests/unit/titles.test.ts
const CORPUS = [
  "Software Engineer",
  "SWE",
  "swe",
  "Senior Software Engineer",
  "Full Stack Developer",
  "fullstack dev",
  "Frontend Engineer",
  "React Developer",
  "Backend Engineer",
  "Go Developer",
  "DevOps Engineer",
  "SRE",
  "Platform Engineer",
  "Cloud Architect",
  "Data Scientist",
  "Data Analyst",
  "ML Engineer",
  "AI Engineer",
  "LLM Engineer",
  "Product Manager",
  "PM",
  "Product Designer",
  "UX Designer",
  "UI Engineer",
  "Founder",
  "Co-Founder",
  "CEO",
  "Student",
  "Intern",
  "Security Engineer",
  "iOS Developer",
  "Android Engineer",
  "Flutter Dev",
  "Mobile Engineer",
  "Engineering Manager",
  "CTO",
  "Tech Lead",
  "Freelancer",
  "Consultant",
  "Yak Shaver",
];

it("maps every realistic role to a usable title", () => {
  for (const role of CORPUS) {
    const t = deriveTitle(role);
    expect(t).toMatch(/^[A-Z0-9 .·&/-]+$/);
    expect(t.length).toBeLessThanOrEqual(24);
  }
});

it("is deterministic", () => {
  for (const role of CORPUS) expect(deriveTitle(role)).toBe(deriveTitle(role));
});

it("prefers specific rules", () => {
  expect(deriveTitle("AI Engineer")).toMatch(/AI|MODEL|NEURAL/);
});
```

Also eyeball the full mapping once — print the corpus and its titles as a table and read it. A title that is technically valid but reads badly is only findable by looking.

## Gotchas

- **Rule order is the logic.** `/engineer/` will swallow "AI Engineer" if it appears before the AI rule. Specific first, always — and the `prefers specific rules` test is what keeps it that way after someone appends a rule to the end of the list.
- **`\b` boundaries matter.** Without them, `/ai/` matches "Retail", "Maintainer", and "Chair". This is a genuinely funny bug in production.
- **`Math.imul` for the hash.** Plain multiplication overflows to a float and the "deterministic" guarantee quietly stops holding across engines.
- **Do not randomize.** `Math.random()` in the derivation means the title changes on every keystroke and every re-render, the preview flickers, and visual snapshots become useless.
- **Cap the manual input.** A user pasting a paragraph into the title field should be truncated at the input, not rescued by the layout engine.
- **Tone review is not optional.** This text goes on a public post next to someone's face. Get the list read by someone other than its author.
- **If AI titles are later required** ([Q-8](../11-open-questions.md)): layer it _behind_ this function — call the API, and if it fails or is slow, keep the deterministic title. The render must never wait on the network.

## References

- [04 — Architecture, ADR-007](../04-architecture.md#adr-007--no-generative-ai-anywhere-in-the-pipeline)
- [11 — Open Questions Q-8](../11-open-questions.md)
