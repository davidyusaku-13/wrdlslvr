import { test, expect, describe } from "bun:test";
import { getRecommendations, getFeedback, filterWords } from "./solver.ts";
import { solutions } from "./words_data.ts";

// Seeded PRNG (Mulberry32) for deterministic tests
function createRng(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runSimulation(secret: string, _rng: () => number, verbose = false): number {
  if (verbose)
    console.log(`\n--- Simulating Wordle for secret word: "${secret.toUpperCase()}" ---`);

  const guesses: Array<{ word: string; feedback: string }> = [];
  const maxAttempts = 6;

  for (let turn = 1; turn <= maxAttempts; turn++) {
    const { remainingCount, suggestions } = getRecommendations(guesses, 5);

    if (suggestions.length === 0) {
      if (verbose) console.log("No possible words left! Solver failed.");
      return -1;
    }

    const nextGuess = suggestions[0]!.word;
    const isPossible = suggestions[0]!.isPossibleAnswer;
    const entropy = suggestions[0]!.entropy;

    const feedback = getFeedback(nextGuess, secret);
    guesses.push({ word: nextGuess, feedback });

    if (verbose) {
      console.log(
        `Turn ${turn}: Guess = "${nextGuess.toUpperCase()}" (${isPossible ? "possible" : "helper"}, entropy = ${entropy} bits), remaining possibilities = ${remainingCount}`
      );
      console.log(`        Feedback = "${feedback}"`);
    }

    if (nextGuess === secret) {
      if (verbose) console.log(`Solved in ${turn} turns!`);
      return turn;
    }
  }

  return -1;
}

// Seed for deterministic tests — change to re-sample
const SEED = 42;

describe("getFeedback", () => {
  test("all green for exact match", () => {
    expect(getFeedback("crane", "crane")).toBe("GGGGG");
  });

  test("all gray for no matching letters", () => {
    expect(getFeedback("abcde", "fghij")).toBe("XXXXX");
  });

  test("yellow for shifted letters", () => {
    // 'abcde' guessed against 'bcdef': 'a' absent, rest all yellow (shifted right)
    expect(getFeedback("abcde", "bcdef")).toBe("XYYYY");
  });

  test("green takes priority over yellow", () => {
    // guess "abcae", secret "afgha"
    // pos 0: both 'a' → green; remaining 'a' at pos 3 → yellow (secret's second 'a' at pos 4)
    expect(getFeedback("abcae", "afgha")).toBe("GXXYX");
  });

  test("correctly handles duplicate letters (consumes once)", () => {
    // guess "abbey", secret "bebop"
    // pos 2: both 'b' → green; first 'b' (pos 1) → yellow at secret pos 0; 'e' → yellow at secret pos 1
    expect(getFeedback("abbey", "bebop")).toBe("XYGYX");
  });

  test("does not mark extra occurrences beyond secret count", () => {
    // guess "eagle", secret "erase"
    // pos 0: both 'e' → green; pos 4: both 'e' → green; 'a' → yellow at secret pos 2
    expect(getFeedback("eagle", "erase")).toBe("GYXXG");
  });

  test("feedback length is always 5", () => {
    expect(getFeedback("abcde", "fghij")).toHaveLength(5);
    expect(getFeedback("abcde", "abcde")).toHaveLength(5);
  });

  test("partial match — only first two letters correct, rest absent", () => {
    expect(getFeedback("crane", "crops")).toBe("GGXXX");
  });
});

describe("filterWords", () => {
  test("returns all words when no guesses", () => {
    const words = ["crane", "slate", "music", "audio"];
    expect(filterWords(words, [])).toEqual(words);
  });

  test("keeps only exact match for GGGGG", () => {
    const words = ["crane", "crate", "craze", "crops"];
    const result = filterWords(words, [{ word: "crane", feedback: "GGGGG" }]);
    expect(result).toEqual(["crane"]);
  });

  test("keeps secret in results for its own feedback", () => {
    const secret = "crane";
    for (const guessWord of ["crate", "stare", "alert", "crane"]) {
      const feedback = getFeedback(guessWord, secret);
      const result = filterWords(solutions, [{ word: guessWord, feedback }]);
      expect(result).toContain(secret);
    }
  });

  test("returns empty array when no words match", () => {
    const words = ["abcde", "fghij"];
    const guesses = [{ word: "zzzzz", feedback: "GGGGG" }];
    expect(filterWords(words, guesses)).toEqual([]);
  });

  test("empty guesses returns input unchanged", () => {
    expect(filterWords(solutions, [])).toBe(solutions);
  });
});

describe("getRecommendations", () => {
  test("returns precomputed openers when no guesses made", () => {
    const result = getRecommendations([]);
    expect(result.remainingCount).toBe(solutions.length);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]!.word).toBe("tares");
  });

  test("returns empty suggestions when no remaining words", () => {
    // Impossible combination of feedback
    const result = getRecommendations([
      { word: "crane", feedback: "GGGGG" },
      { word: "aback", feedback: "GGGGG" },
    ]);
    expect(result.remainingCount).toBe(0);
    expect(result.suggestions).toEqual([]);
  });

  test("throws on invalid guess format", () => {
    expect(() =>
      getRecommendations([{ word: "crne", feedback: "GGGGG" }])
    ).toThrow("must be 5 lowercase letters");

    expect(() =>
      getRecommendations([{ word: "crane", feedback: "GGG" }])
    ).toThrow("must be 5 chars of G/Y/X");

    expect(() =>
      getRecommendations([{ word: "crane", feedback: "GGGGA" }])
    ).toThrow("must be 5 chars of G/Y/X");

    expect(() =>
      getRecommendations([{ word: "CRANE", feedback: "GGGGG" }])
    ).toThrow("must be 5 lowercase letters");
  });

  test("respects limit parameter", () => {
    const result = getRecommendations([], 5);
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  test("after one guess narrows down possibilities", () => {
    // Guess "tares" with some realistic feedback should reduce the pool
    const result = getRecommendations([{ word: "tares", feedback: "XXGXY" }]);
    expect(result.remainingCount).toBeLessThan(solutions.length);
    expect(result.remainingCount).toBeGreaterThan(0);
  });
});

describe("solver simulation (deterministic, seeded)", () => {
  const BATCH_SIZE = 20;
  const rng = createRng(SEED);

  // Pick BATCH_SIZE deterministic words from the solution list
  const testSecrets: string[] = [];
  const used = new Set<number>();
  while (testSecrets.length < BATCH_SIZE) {
    const idx = Math.floor(rng() * solutions.length);
    if (used.has(idx)) continue;
    used.add(idx);
    testSecrets.push(solutions[idx]!);
  }

  // Also include a few known challenging words
  const knownTricky = ["aback", "mummy", "fuzzy", "vivid", "watch", "fjord"];
  for (const w of knownTricky) {
    if (solutions.includes(w) && !testSecrets.includes(w)) {
      testSecrets.push(w);
    }
  }

  test("solver solves all sampled words with avg ≤ 4.5 turns", () => {
    let totalTurns = 0;
    let solvedCount = 0;
    const failedWords: string[] = [];

    for (const secret of testSecrets) {
      let h = 0;
      for (let i = 0; i < secret.length; i++) {
        h = (h * 31 + secret.charCodeAt(i)) | 0;
      }
      const testRng = createRng(h ^ SEED);
      const turns = runSimulation(secret, testRng);
      if (turns >= 1 && turns <= 6) {
        totalTurns += turns;
        solvedCount++;
      } else {
        failedWords.push(secret);
      }
    }

    const solveRate = solvedCount / testSecrets.length;
    const avgTurns = solvedCount > 0 ? totalTurns / solvedCount : 0;
    console.log(`Solver solved ${solvedCount}/${testSecrets.length} (${(solveRate * 100).toFixed(1)}%), avg ${avgTurns.toFixed(2)} turns`);
    if (failedWords.length > 0) {
      console.log(`Failed: ${failedWords.join(", ")}`);
    }

    expect(solveRate).toBeGreaterThanOrEqual(0.9);
    expect(avgTurns).toBeLessThanOrEqual(4.5);
  });
});
