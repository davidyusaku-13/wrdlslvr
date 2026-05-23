import fs from "fs";
import path from "path";

const POSSIBLE_URL = "https://raw.githubusercontent.com/3b1b/videos/master/_2022/wordle/data/possible_words.txt";
const ALLOWED_URL = "https://raw.githubusercontent.com/3b1b/videos/master/_2022/wordle/data/allowed_words.txt";

async function downloadWords() {
  console.log("Downloading possible words (solutions)...");
  const possibleRes = await fetch(POSSIBLE_URL);
  if (!possibleRes.ok) {
    throw new Error(`Failed to fetch possible words: ${possibleRes.statusText}`);
  }
  const possibleText = await possibleRes.text();
  const possibleWords = possibleText
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length === 5);

  console.log(`Downloaded ${possibleWords.length} solutions.`);

  console.log("Downloading allowed words (guesses)...");
  const allowedRes = await fetch(ALLOWED_URL);
  if (!allowedRes.ok) {
    throw new Error(`Failed to fetch allowed words: ${allowedRes.statusText}`);
  }
  const allowedText = await allowedRes.text();
  const allowedWords = allowedText
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length === 5);

  console.log(`Downloaded ${allowedWords.length} allowed guesses.`);

  // Write to src/words_data.ts as exported arrays
  const outputDir = path.join(__dirname, "../src");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputContent = `// Auto-generated Wordle word lists
export const solutions: string[] = ${JSON.stringify(possibleWords, null, 2)};

export const allowedGuesses: string[] = ${JSON.stringify(allowedWords, null, 2)};
`;

  const outputPath = path.join(outputDir, "words_data.ts");
  fs.writeFileSync(outputPath, outputContent, "utf8");
  console.log(`Successfully generated word lists at ${outputPath}`);
}

downloadWords().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
