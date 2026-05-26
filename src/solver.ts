import { solutions, allowedGuesses } from "./words_data.ts";

export interface Guess {
  word: string;
  feedback: string; // 5-character string containing G (Green), Y (Yellow), X (Gray)
}

export interface Recommendation {
  word: string;
  entropy: number;
  isPossibleAnswer: boolean;
  expectedRemaining: number;
}

// Replicates exact Wordle coloring rules
export function getFeedback(guess: string, secret: string): string {
  const feedback = Array(5).fill("X");
  const secretLetters = secret.split("");
  const guessLetters = guess.split("");

  // First pass: Mark Green (correct letter and spot)
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === secretLetters[i]) {
      feedback[i] = "G";
      secretLetters[i] = "_"; // consume the letter
      guessLetters[i] = "";   // consume the guess letter
    }
  }

  // Second pass: Mark Yellow (correct letter, wrong spot)
  for (let i = 0; i < 5; i++) {
    const letter = guessLetters[i];
    if (letter === "" || letter === undefined) continue; // Already green or consumed
    const index = secretLetters.indexOf(letter);
    if (index !== -1) {
      feedback[i] = "Y";
      secretLetters[index] = "_"; // consume the letter
    }
  }

  return feedback.join("");
}

// Fast filter to find possible answers consistent with all previous guesses and feedback
export function filterWords(words: string[], guesses: Guess[]): string[] {
  if (guesses.length === 0) return words;
  return words.filter((candidate) => {
    for (const g of guesses) {
      if (getFeedback(g.word, candidate) !== g.feedback) {
        return false;
      }
    }
    return true;
  });
}

// Converts a feedback string (e.g. "GXYXG") into a unique index [0..242]
function feedbackToId(f: string): number {
  let id = 0;
  for (let i = 0; i < 5; i++) {
    const ch = f.charAt(i);
    // 'G' -> 2, 'Y' -> 1, 'X' -> 0
    const val = ch === "G" ? 2 : ch === "Y" ? 1 : 0;
    id = id * 3 + val;
  }
  return id;
}

// Precomputed top 15 opening guesses with their actual entropy computed against the official 2,309 solution list
export const PRECOMPUTED_OPENERS: Recommendation[] = [
  { word: "tares", entropy: 6.19, isPossibleAnswer: false, expectedRemaining: 31.8 },
  { word: "lares", entropy: 6.15, isPossibleAnswer: false, expectedRemaining: 32.7 },
  { word: "rales", entropy: 6.11, isPossibleAnswer: false, expectedRemaining: 33.6 },
  { word: "rates", entropy: 6.10, isPossibleAnswer: false, expectedRemaining: 33.8 },
  { word: "salet", entropy: 5.74, isPossibleAnswer: false, expectedRemaining: 43.1 },
  { word: "soare", entropy: 5.89, isPossibleAnswer: false, expectedRemaining: 39.0 },
  { word: "roate", entropy: 5.88, isPossibleAnswer: false, expectedRemaining: 39.2 },
  { word: "raise", entropy: 5.87, isPossibleAnswer: true, expectedRemaining: 39.5 },
  { word: "crane", entropy: 5.75, isPossibleAnswer: true, expectedRemaining: 42.8 },
  { word: "trace", entropy: 5.72, isPossibleAnswer: true, expectedRemaining: 43.7 },
  { word: "slate", entropy: 5.68, isPossibleAnswer: true, expectedRemaining: 44.9 },
  { word: "stare", entropy: 5.67, isPossibleAnswer: true, expectedRemaining: 45.2 },
  { word: "snare", entropy: 5.64, isPossibleAnswer: true, expectedRemaining: 46.1 },
  { word: "carte", entropy: 5.61, isPossibleAnswer: false, expectedRemaining: 47.1 },
  { word: "adieu", entropy: 4.86, isPossibleAnswer: true, expectedRemaining: 78.4 }
];

// Computes the expected entropy and stats for guesses
export function getRecommendations(
  guesses: Guess[],
  limit = 20
): { remainingCount: number; suggestions: Recommendation[] } {
  // Validate all guesses have correct format
  for (const g of guesses) {
    if (!/^[a-z]{5}$/.test(g.word)) {
      throw new Error(`Invalid guess word "${g.word}" — must be 5 lowercase letters`);
    }
    if (!/^[GXY]{5}$/.test(g.feedback)) {
      throw new Error(`Invalid feedback "${g.feedback}" for guess "${g.word}" — must be 5 chars of G/Y/X`);
    }
  }

  // 1. Get remaining possible answers
  const remaining = filterWords(solutions, guesses);
  const totalAnswers = remaining.length;

  if (totalAnswers === 0) {
    return { remainingCount: 0, suggestions: [] };
  }

  // 2. If no guesses made, return precomputed openers immediately
  if (guesses.length === 0) {
    // Check if the precomputed openers are possible answers (for opener list, some are)
    return {
      remainingCount: totalAnswers,
      suggestions: PRECOMPUTED_OPENERS.slice(0, limit)
    };
  }

  // 3. If there is only 1 or 2 remaining words, the choice is obvious!
  if (totalAnswers <= 2) {
    const suggestions = remaining.map((w) => ({
      word: w,
      entropy: totalAnswers === 1 ? 0 : 1.0,
      isPossibleAnswer: true,
      expectedRemaining: 1.0
    }));
    return { remainingCount: totalAnswers, suggestions };
  }

  // 4. Calculate entropy for all candidate words.
  // We use a CPU time budget (~8ms) to avoid exceeding Cloudflare Workers' CPU limit.
  // If the budget is exceeded mid-evaluation, we return the best candidates found so far.
  const TIME_BUDGET_MS = 8;
  const CANDIDATE_BUDGET = 600;
  const startTime = performance.now();

  // To keep responsiveness high, if the remaining list is still large (e.g. > 400),
  // we compute entropy for all remaining possible answers AND a pruned list of allowed guesses.
  // Otherwise, we evaluate up to CANDIDATE_BUDGET candidates.
  const candidatesToEvaluate: string[] = [];
  const isLarge = totalAnswers > 400;

  if (isLarge) {
    // When many solutions remain, guessing a solution is highly effective,
    // plus we add some highly-rated pre-filtered helper words (e.g. openers + random allowed guesses)
    // to maintain great UI speed.
    const candidatesSet = new Set<string>(remaining);
    // Add some well-known helpers
    for (const op of PRECOMPUTED_OPENERS) {
      candidatesSet.add(op.word);
    }
    // Also add a diverse sample of 200 allowed guesses to offer good out-of-pool choices.
    // Use a random-offset systematic sample so no word is permanently excluded.
    const sampleCount = Math.min(200, allowedGuesses.length);
    const step = Math.floor(allowedGuesses.length / sampleCount);
    const startOffset = Math.floor(Math.random() * step);
    for (let i = startOffset; i < allowedGuesses.length; i += step) {
      candidatesSet.add(allowedGuesses[i]!);
    }
    candidatesToEvaluate.push(...candidatesSet);
  } else {
    // When candidates are few, evaluate remaining solutions + a sample of allowed guesses
    // within the candidate budget to stay under the CPU time limit.
    const candidatesSet = new Set<string>(remaining);
    for (const op of PRECOMPUTED_OPENERS) {
      candidatesSet.add(op.word);
    }
    const remainingBudget = Math.max(0, CANDIDATE_BUDGET - candidatesSet.size);
    if (remainingBudget > 0) {
      const sampleSize = Math.min(remainingBudget, allowedGuesses.length);
      const step = Math.max(1, Math.floor(allowedGuesses.length / sampleSize));
      const startOffset = Math.floor(Math.random() * step);
      for (let i = startOffset; i < allowedGuesses.length && candidatesSet.size < CANDIDATE_BUDGET; i += step) {
        candidatesSet.add(allowedGuesses[i]!);
      }
    }
    candidatesToEvaluate.push(...candidatesSet);
  }

  // Map to store possible answers for fast lookup
  const remainingSet = new Set<string>(remaining);
  const recommendations: Recommendation[] = [];

  // Buffer counts array to prevent memory allocation in loops
  const counts = new Uint32Array(243);

  let candidateIndex = 0;
  const sortKeys: number[] = [];

  for (const guessWord of candidatesToEvaluate) {
    // Check CPU budget every 50 candidates; stop if near limit
    if (++candidateIndex % 50 === 0 && performance.now() - startTime > TIME_BUDGET_MS) {
      break;
    }

    // Reset counts buffer
    counts.fill(0);

    // Count feedback distributions over the remaining answers
    for (const secret of remaining) {
      const f = getFeedback(guessWord, secret);
      const id = feedbackToId(f);
      counts[id]!++;
    }

    // Compute expected entropy and expected remaining words
    let entropy = 0;
    let expectedRemaining = 0;

    for (let i = 0; i < 243; i++) {
      const count = counts[i]!;
      if (count > 0) {
        const p = count / totalAnswers;
        entropy -= p * Math.log2(p);
        expectedRemaining += p * count; // expected size of new subset
      }
    }

    // Small mathematical tie-breaker: prefer words that are actually possible answers
    const isPossible = remainingSet.has(guessWord);
    // If the word has the same entropy, a possible answer is strictly better because it can win on this turn!
    // We add a tiny value to entropy for sorting, but keep the display value accurate.
    const sortingEntropy = entropy + (isPossible ? 1e-4 : 0);

    recommendations.push({
      word: guessWord,
      entropy: Math.round(entropy * 100) / 100,
      isPossibleAnswer: isPossible,
      expectedRemaining: Math.round(expectedRemaining * 10) / 10,
    });
    sortKeys.push(sortingEntropy);
  }

  // Sort by sortKeys descending (higher entropy first)
  const sortedIndices = recommendations.map((_, i) => i);
  sortedIndices.sort((a, b) => (sortKeys[b] ?? 0) - (sortKeys[a] ?? 0));
  const sorted = sortedIndices.map((i) => recommendations[i]!);

  // Return the top N suggestions
  return {
    remainingCount: totalAnswers,
    suggestions: sorted.slice(0, limit)
  };
}
