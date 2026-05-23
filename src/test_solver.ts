import { getRecommendations, getFeedback } from "./solver.ts";
import { solutions } from "./words_data.ts";

function runSimulation(secret: string, verbose = false): number {
  if (verbose) console.log(`\n--- Simulating Wordle for secret word: "${secret.toUpperCase()}" ---`);

  const guesses: Array<{ word: string; feedback: string }> = [];
  const maxAttempts = 6;

  for (let turn = 1; turn <= maxAttempts; turn++) {
    // 1. Get solver recommendations
    const { remainingCount, suggestions } = getRecommendations(guesses, 5);

    if (suggestions.length === 0) {
      if (verbose) console.log("No possible words left! Solver failed.");
      return -1;
    }

    // 2. Select the top recommendation
    const nextGuess = suggestions[0]!.word;
    const isPossible = suggestions[0]!.isPossibleAnswer;
    const entropy = suggestions[0]!.entropy;

    // 3. Compute feedback
    const feedback = getFeedback(nextGuess, secret);
    guesses.push({ word: nextGuess, feedback });

    if (verbose) {
      console.log(
        `Turn ${turn}: Guess = "${nextGuess.toUpperCase()}" (${isPossible ? "possible" : "helper"}, entropy = ${entropy} bits), remaining possibilities = ${remainingCount}`
      );
      console.log(`        Feedback = "${feedback}"`);
    }

    // 4. Check if solved
    if (nextGuess === secret) {
      if (verbose) console.log(`🎉 Solved in ${turn} turns!`);
      return turn;
    }
  }

  if (verbose) console.log(`❌ Failed to solve in ${maxAttempts} turns.`);
  return -1;
}

function runTests() {
  console.log("Starting Solver Simulation Tests...");

  // Select 20 random words from solutions list
  const sampleSize = 20;
  const testSecrets: string[] = [];
  for (let i = 0; i < sampleSize; i++) {
    const randIndex = Math.floor(Math.random() * solutions.length);
    testSecrets.push(solutions[randIndex]!);
  }

  // Also include a few known challenging words
  const manualTests = ["aback", "mummy", "fuzzy", "vivid", "watch"];
  for (const w of manualTests) {
    if (solutions.includes(w) && !testSecrets.includes(w)) {
      testSecrets.push(w);
    }
  }

  let totalTurns = 0;
  let solvedCount = 0;
  let failedCount = 0;

  for (const secret of testSecrets) {
    // Run with verbose logging for the first 3 words
    const verbose = solvedCount < 3;
    const turns = runSimulation(secret, verbose);

    if (turns > 0) {
      solvedCount++;
      totalTurns += turns;
    } else {
      failedCount++;
    }
  }

  const averageTurns = solvedCount > 0 ? (totalTurns / solvedCount).toFixed(2) : "N/A";
  console.log("\n====================================");
  console.log("SIMULATION RESULTS SUMMARY:");
  console.log(`Total games simulated: ${testSecrets.length}`);
  console.log(`Successfully solved:  ${solvedCount} (${((solvedCount / testSecrets.length) * 100).toFixed(0)}%)`);
  console.log(`Failed to solve:      ${failedCount}`);
  console.log(`Average turns to win:  ${averageTurns}`);
  console.log("====================================");

  if (failedCount > 0) {
    console.warn("⚠️ Warning: Some games failed to solve in 6 turns. This can happen for tricky word clusters (e.g. -IGHT or -OUND), but should be rare.");
  } else {
    console.log("✨ Perfect run! All words solved in 6 turns or less.");
  }
}

runTests();
