# wrdlslvr

An information-theoretic Wordle solver and interactive helper. Computes optimal guesses by maximizing expected information gain (entropy) across the remaining solution space.

Live at [wrdlslvr.davidyusaku13.workers.dev](https://wrdlslvr.davidyusaku13.workers.dev)

## Stack

- **Runtime:** [Bun](https://bun.sh) for local dev; [Cloudflare Workers](https://workers.cloudflare.com) for production
- **Language:** TypeScript (strict mode, `noUncheckedIndexedAccess`)
- **Frontend:** Vanilla JS with glassmorphism cyberpunk theme
- **Word lists:** 2,309 solutions + 12,953 allowed guesses from 3Blue1Brown's Wordle data

## How the solver works

1. **Feedback:** `getFeedback(guess, secret)` replicates Wordle's exact coloring rules — two-pass algorithm (green first, then yellow) with letter consumption to handle duplicates correctly.
2. **Filter:** `filterWords(words, guesses)` narrows the solution space to words consistent with all observed feedback patterns.
3. **Entropy:** `getRecommendations(guesses)` evaluates candidate guesses against the remaining solution set, computing expected information gain `H = -Σ p log₂(p)` for each. The top suggestions maximize entropy.

## Setup

```bash
bun install
```

Download word lists (from 3Blue1Brown's repository):

```bash
bun run setup
```

## Development

Start the local Bun dev server (hot reload):

```bash
bun run dev
```

The server runs at `http://localhost:3000` by default (set `PORT` env to change).

## Test

```bash
bun test
```

Runs a suite of 19+ tests covering:
- `getFeedback` correctness (duplicate letters, green priority, edge cases)
- `filterWords` consistency (round-trips with real feedback)
- `getRecommendations` (input validation, precomputed openers, narrowing)
- Full solver simulation (seeded PRNG for deterministic results, 26 sampled words, 100% solve rate, avg ~3.8 turns)

## Deploy

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

Local Cloudflare Workers preview:

```bash
bun run wrangler-dev
```

## Performance notes

- Entropy computation is bounded by a CPU time budget (~8ms) to stay within Cloudflare Workers' free-tier CPU limits.
- Results are cached in-memory (5s TTL) to avoid recomputation during rapid tile toggling.
- The worst case (two low-information guesses) previously timed out with HTTP 503; the budget system now returns results within the time limit.

## Credits

Inspired by [3Blue1Brown's Wordle video](https://www.youtube.com/watch?v=v68zYyaEmEA). Word lists sourced from the same repository.
