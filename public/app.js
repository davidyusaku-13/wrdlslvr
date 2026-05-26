/**
 * WRDL-SLVR Web Controller v1.4
 * Cyberpunk Slate Glassmorphism Theme with Sound Synthesis and Optimized Helper Engine
 */

// App State
let guesses = [];           // Array of { word, feedback }
let activeRow = 0;
let activeCol = 0;

// Virtual Keyboard Layout
const KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["enter", "z", "x", "c", "v", "b", "n", "m", "backspace"]
];

/**
 * High-Fidelity Retro Synth Sound Engine
 * Utilizes zero-latency browser Web Audio API
 */
class SynthesizerEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  // Lazy initialize AudioContext on user interaction to comply with browser policies
  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Soft high-pitched pop for keyboard entry
  playTap() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(650, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.035);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }

  // Snappy digital click for buttons
  playClick() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1050, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.055);
  }

  // Column-synchronized pentatonic flip chirps (forms E major pentatonic chords)
  playFlip(column) {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Harmonic pentatonic frequencies (E4, G#4, B4, C#5, E5)
    const notes = [329.63, 415.30, 493.88, 554.37, 659.25];
    const freq = notes[column] || 329.63;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.15, this.ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.095);
  }

  // Descending, detuned sawtooth filter growl for failure/error
  playFail() {
    this.resume();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(35, now + 0.85);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(45, now + 0.85);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.9);
  }
}

// Instantiate Sound Engine
const audioEngine = new SynthesizerEngine();

// Cache DOM Elements
const boardElement = document.getElementById("wordle-board");
const keyboardContainer = document.getElementById("keyboard-container");
const suggestionsListBox = document.getElementById("suggestions-list-box");
const badgeWordCount = document.getElementById("badge-word-count");
const statusInfoText = document.getElementById("status-info-text");
const statusInfoBox = document.getElementById("status-info-box");

const btnHelperClear = document.getElementById("btn-helper-clear");

const boardTitle = document.getElementById("board-title");
const boardInstruction = document.getElementById("board-instruction");

// Audio & Speed Control Elements
const btnAudioToggle = document.getElementById("btn-audio-toggle");
const audioIconOn = document.getElementById("audio-icon-on");
const audioIconOff = document.getElementById("audio-icon-off");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupBoard();
  setupKeyboard();
  setupEventListeners();
  triggerSolve(); // Load initial openers
  
  // Unlock audio engine on first click
  document.body.addEventListener("click", () => {
    audioEngine.resume();
  }, { once: true });
});

// Setup 6x5 Wordle Board UI
function setupBoard() {
  boardElement.innerHTML = "";
  boardElement.classList.add("helper-mode-active"); // Enable visual pointer hover style for tile toggles
  
  for (let r = 0; r < 6; r++) {
    const row = document.createElement("div");
    row.className = "wordle-row";
    row.id = `row-${r}`;
    
    for (let c = 0; c < 5; c++) {
      const tile = document.createElement("div");
      tile.className = "tile empty";
      tile.id = `tile-${r}-${c}`;
      tile.dataset.row = r;
      tile.dataset.col = c;
      row.appendChild(tile);
    }
    boardElement.appendChild(row);
  }
}

// Setup Keyboard UI
function setupKeyboard() {
  keyboardContainer.innerHTML = "";
  KEYBOARD_ROWS.forEach((rowKeys) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";
    
    rowKeys.forEach((keyVal) => {
      const button = document.createElement("button");
      button.className = "key";
      button.id = `key-${keyVal}`;
      button.textContent = keyVal === "backspace" ? "⌫" : keyVal;
      
      if (keyVal === "enter" || keyVal === "backspace") {
        button.classList.add("wide");
      }
      
      button.addEventListener("click", () => handleKeyPress(keyVal));
      row.appendChild(button);
    });
    
    keyboardContainer.appendChild(row);
  });
}

// Setup Button Listeners
function setupEventListeners() {
  // Action Buttons
  btnHelperClear.addEventListener("click", () => {
    audioEngine.playClick();
    clearAll();
  });

  // Audio Mute Toggle
  btnAudioToggle.addEventListener("click", () => {
    audioEngine.isMuted = !audioEngine.isMuted;
    if (audioEngine.isMuted) {
      audioIconOn.classList.add("hidden");
      audioIconOff.classList.remove("hidden");
    } else {
      audioIconOn.classList.remove("hidden");
      audioIconOff.classList.add("hidden");
      audioEngine.playClick();
    }
  });

  // Tile Clicks (clicking toggles letter color feedback)
  boardElement.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    
    const r = parseInt(tile.dataset.row);
    const c = parseInt(tile.dataset.col);
    
    if (r < activeRow && tile.textContent.trim() !== "") {
      audioEngine.playClick();
      cycleTileFeedback(r, c);
    }
  });

  // Physical Keyboard Input
  document.addEventListener("keydown", (e) => {
    // Ignore input if user is focusing a normal input or textarea
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === "enter") {
      handleKeyPress("enter");
    } else if (key === "backspace" || key === "delete") {
      handleKeyPress("backspace");
    } else if (/^[a-z]$/.test(key)) {
      handleKeyPress(key);
    }
  });
}

// Handle Key / Virtual Key Inputs
function handleKeyPress(key) {
  const activeRowElem = document.getElementById(`row-${activeRow}`);
  if (!activeRowElem) return; // Grid fully filled

  if (key === "backspace") {
    if (activeCol > 0) {
      activeCol--;
      const tile = document.getElementById(`tile-${activeRow}-${activeCol}`);
      tile.textContent = "";
      tile.className = "tile empty";
      audioEngine.playTap();
    }
  } else if (key === "enter") {
    if (activeCol === 5) {
      audioEngine.playClick();
      commitRow();
    } else {
      // Shake row to indicate insufficient letters
      audioEngine.playFail(); // Error rumble
      activeRowElem.classList.remove("shake");
      void activeRowElem.offsetWidth; // Force reflow
      activeRowElem.classList.add("shake");
    }
  } else {
    // Normal letter input
    if (activeCol < 5) {
      const tile = document.getElementById(`tile-${activeRow}-${activeCol}`);
      tile.textContent = key;
      tile.className = "tile active pop";
      activeCol++;
      audioEngine.playTap();
    }
  }
}

// Commits the current row as a complete guess
async function commitRow() {
  const letters = [];
  for (let c = 0; c < 5; c++) {
    const tile = document.getElementById(`tile-${activeRow}-${c}`);
    letters.push(tile.textContent.toLowerCase());
  }
  const guessedWord = letters.join("");

  // Helper Mode: row defaults to all gray (absent) initially
  const feedback = "XXXXX";
  for (let c = 0; c < 5; c++) {
    const tile = document.getElementById(`tile-${activeRow}-${c}`);
    tile.className = "tile absent";
    // Sequenced trigger sound
    setTimeout(() => {
      audioEngine.playFlip(c);
    }, c * 60);
  }
  
  guesses.push({ word: guessedWord, feedback });
  activeRow++;
  activeCol = 0;
  
  triggerSolve();
}

// Click to cycle color feedback (Gray -> Yellow -> Green)
function cycleTileFeedback(r, c) {
  const tile = document.getElementById(`tile-${r}-${c}`);
  const currentClass = tile.className;
  let newFeedbackChar = "X";
  
  if (currentClass.includes("absent")) {
    tile.className = "tile present";
    newFeedbackChar = "Y";
  } else if (currentClass.includes("present")) {
    tile.className = "tile correct";
    newFeedbackChar = "G";
  } else if (currentClass.includes("correct")) {
    tile.className = "tile absent";
    newFeedbackChar = "X";
  }

  // Update backend state
  const guessItem = guesses[r];
  if (guessItem) {
    const feedbackArr = guessItem.feedback.split("");
    feedbackArr[c] = newFeedbackChar;
    guessItem.feedback = feedbackArr.join("");
  }
  
  // Re-run solver with new feedback
  triggerSolve();
}

// Query backend Bun API with current board state
async function triggerSolve() {
  try {
    const response = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guesses })
    });
    
    if (!response.ok) throw new Error("API solve failed");
    
    const data = await response.json();
    renderSuggestions(data.suggestions, data.remainingCount);
  } catch (err) {
    console.error("Solver error:", err);
  }
}

// Render word recommendations in the sidebar
function renderSuggestions(suggestions, remainingCount) {
  badgeWordCount.textContent = `${remainingCount.toLocaleString()} Left`;
  
  if (guesses.length === 0) {
    statusInfoBox.style.border = "1px solid rgba(139, 92, 246, 0.15)";
    statusInfoBox.style.background = "rgba(139, 92, 246, 0.05)";
    statusInfoText.innerHTML = `Opening solver loaded with <strong>${remainingCount.toLocaleString()}</strong> target words. The best opening recommendation is <strong>${suggestions[0]?.word || "TARES"}</strong>.`;
  } else {
    statusInfoBox.style.border = "1px solid var(--border-neon-dim)";
    statusInfoBox.style.background = "rgba(0, 230, 118, 0.03)";
    statusInfoText.innerHTML = `Solver analyzed board. <strong>${remainingCount.toLocaleString()}</strong> valid answers remain. Best suggestion reduces expected pool to <strong>${suggestions[0]?.expectedRemaining || 1}</strong>.`;
  }

  suggestionsListBox.innerHTML = "";
  
  if (suggestions.length === 0) {
    suggestionsListBox.innerHTML = `
      <div class="suggestions-empty">
        No matching words found! Check that your color filters are consistent.
      </div>
    `;
    return;
  }

  suggestions.forEach((item) => {
    const row = document.createElement("div");
    row.className = `suggestion-item ${item.isPossibleAnswer ? "possible" : "helper"}`;
    
    // Clicking a suggestion types it into the active row
    row.addEventListener("click", () => {
      audioEngine.playClick();
      insertSuggestedWord(item.word);
    });

    row.innerHTML = `
      <div class="word-box">
        <span class="word-text">${item.word}</span>
        ${item.isPossibleAnswer ? '<span class="tag-possible">possible</span>' : '<span class="tag-helper">helper</span>'}
      </div>
      <div class="entropy-value">${item.entropy.toFixed(2)}</div>
      <div class="expected-value">${item.expectedRemaining}</div>
    `;
    
    suggestionsListBox.appendChild(row);
  });
}

// Click suggestion to type it in
function insertSuggestedWord(word) {
  if (activeCol > 0 || activeRow >= 6) return; // Only allow typing suggestion on clean row
  
  for (let c = 0; c < 5; c++) {
    handleKeyPress(word[c]);
  }
}

// Clear all board state
function clearAll() {
  guesses = [];
  activeRow = 0;
  activeCol = 0;
  
  setupBoard();
  triggerSolve();
}
