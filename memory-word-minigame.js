/**
 * Mnemonic lock: memorize 7 words in order (10 seconds to view), then pick them from a cloud of ≥15 words.
 * Each recall (matching) attempt must finish within 15 seconds; wrong tap or timeout burns an attempt.
 * Three failed rounds → host handles collapse (game over).
 */
window.MemoryWordMinigame = (function memoryWordIife() {
  const ROOM = { row: 0, col: 1 };

  const SEQUENCE_LEN = 7;
  /** Time to study the sequence (phase 1). */
  const MEMORIZE_MS = 10000;
  const MEMORIZE_SEC = MEMORIZE_MS / 1000;
  /** Time to tap the word cloud in order (phase 2). */
  const RECALL_MS = 15000;
  const RECALL_SEC = RECALL_MS / 1000;
  const MIN_CLOUD = 15;
  const MAX_ATTEMPTS = 3;

  const WORD_BANK = [
    "apple", "bread", "chair", "table", "river", "window", "garden", "summer", "coffee",
    "pencil", "basket", "silver", "market", "shadow", "ladder", "cookie", "blanket",
    "thunder", "bottle", "pocket", "sunset", "morning", "picture", "mirror", "candle",
    "jacket", "ribbon", "pillow", "kitten", "bridge", "forest", "feather", "planet",
    "lemon", "meadow", "pumpkin", "kettle", "sweater", "mailbox", "diamond", "journey",
    "ocean", "yellow", "purple", "orange", "happy", "gentle", "bright", "narrow",
    "shallow", "peaceful", "wooden", "golden", "frozen", "clever", "heavy", "hollow",
    "rusty", "grassy", "windy", "rainy", "snowy", "cloudy", "sleepy", "hungry",
    "thirsty", "lonely", "friendly", "lazy", "silly", "curly", "squirrel", "cupboard",
    "necklace", "whistle", "sandwich", "hallway", "curtain", "puzzle", "notebook",
    "toothbrush", "backpack", "birthday", "fireplace", "sidewalk", "teaspoon",
  ];

  /** Deduped bank — needs length ≥ 15 for cloud; ≥ 7 + 8 distractors */
  const UNIQUE_WORDS = (function buildBank() {
    const s = new Set();
    WORD_BANK.forEach((w) => {
      if (w && !s.has(w)) {
        s.add(w);
      }
    });
    return Array.from(s);
  })();

  let memorizeIntervalId = null;
  let memorizeEndTimeoutId = null;
  let recallIntervalId = null;
  let recallEndTimeoutId = null;
  let sessionActive = false;
  /** @type {{ onSolved: function, onGameOver: function } | null} */
  let callbacks = null;
  /** @type {string[]} */
  let sequence = [];
  let recallIndex = 0;
  let attemptsLeft = MAX_ATTEMPTS;

  function randomIntBelow(n) {
    if (n <= 0) {
      return 0;
    }
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const max = 256;
      const buf = new Uint8Array(1);
      let x;
      do {
        crypto.getRandomValues(buf);
        x = buf[0];
      } while (x >= Math.floor(max / n) * n);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = randomIntBelow(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickSequence() {
    const pool = shuffleInPlace([...UNIQUE_WORDS]);
    return pool.slice(0, SEQUENCE_LEN);
  }

  function buildCloud(seq) {
    const used = new Set(seq);
    const rest = UNIQUE_WORDS.filter((w) => !used.has(w));
    shuffleInPlace(rest);
    const need = Math.max(MIN_CLOUD - seq.length, 8);
    const extra = rest.slice(0, need);
    const all = shuffleInPlace([...seq, ...extra]);
    return all;
  }

  function clearMemorizeTimers() {
    if (memorizeIntervalId != null) {
      clearInterval(memorizeIntervalId);
      memorizeIntervalId = null;
    }
    if (memorizeEndTimeoutId != null) {
      clearTimeout(memorizeEndTimeoutId);
      memorizeEndTimeoutId = null;
    }
  }

  function clearRecallTimers() {
    if (recallIntervalId != null) {
      clearInterval(recallIntervalId);
      recallIntervalId = null;
    }
    if (recallEndTimeoutId != null) {
      clearTimeout(recallEndTimeoutId);
      recallEndTimeoutId = null;
    }
  }

  /** Wrong tap or recall timeout — lose one attempt or game over. */
  function failCurrentRecallAttempt(reason) {
    clearRecallTimers();
    attemptsLeft -= 1;
    updateAttemptsHud();
    const feedbackEl = document.getElementById("puzzle-feedback");
    if (attemptsLeft <= 0) {
      sessionActive = false;
      const cb = callbacks.onGameOver;
      callbacks = null;
      if (typeof cb === "function") {
        cb();
      }
      return;
    }
    if (feedbackEl) {
      const prefix = reason === "timeout" ? "Time ran out." : "Wrong order.";
      feedbackEl.textContent = `${prefix} ${attemptsLeft} attempt(s) left — memorizing a new sequence.`;
      feedbackEl.classList.remove("puzzle-modal__feedback--success");
    }
    cloudClearDisabled();
    startMemorizePhase();
  }

  function setMemoryWrapVisible(visible) {
    const wrap = document.getElementById("puzzle-memory-wrap");
    if (wrap) {
      wrap.hidden = !visible;
    }
  }

  function setPuzzleModalMemoryMode(enabled) {
    const modal = document.getElementById("puzzle-modal");
    if (modal) {
      modal.classList.toggle("puzzle-modal--memory", Boolean(enabled));
    }
  }

  function setArcheryWrapVisible(visible) {
    const wrap = document.getElementById("puzzle-archery-wrap");
    if (wrap) {
      wrap.hidden = !visible;
    }
  }

  function setPuzzleModalArcheryMode(enabled) {
    const modal = document.getElementById("puzzle-modal");
    if (modal) {
      modal.classList.toggle("puzzle-modal--archery", Boolean(enabled));
    }
  }

  function setBombWrapVisible(visible) {
    const wrap = document.getElementById("puzzle-bomb-wrap");
    if (wrap) {
      wrap.hidden = !visible;
    }
  }

  function setPuzzleModalBombMode(enabled) {
    const modal = document.getElementById("puzzle-modal");
    if (modal) {
      modal.classList.toggle("puzzle-modal--bomb", Boolean(enabled));
    }
  }

  function updateAttemptsHud() {
    const el = document.getElementById("memory-attempts-left");
    if (el) {
      el.textContent = String(attemptsLeft);
    }
  }

  function updateStepHud() {
    const el = document.getElementById("memory-step-num");
    if (el) {
      el.textContent = String(recallIndex + 1);
    }
    const dots = document.getElementById("memory-progress-dots");
    if (dots) {
      dots.innerHTML = "";
      for (let i = 0; i < SEQUENCE_LEN; i += 1) {
        const d = document.createElement("span");
        d.className = "memory-progress-dot";
        if (i < recallIndex) {
          d.classList.add("memory-progress-dot--done");
        } else if (i === recallIndex) {
          d.classList.add("memory-progress-dot--active");
        }
        dots.appendChild(d);
      }
    }
  }

  function startRecallPhase() {
    clearRecallTimers();

    const mem = document.getElementById("memory-phase-memorize");
    const rec = document.getElementById("memory-phase-recall");
    if (mem) {
      mem.hidden = true;
    }
    if (rec) {
      rec.hidden = false;
    }

    recallIndex = 0;
    updateAttemptsHud();
    updateStepHud();

    const cloud = document.getElementById("memory-word-cloud");
    if (!cloud) {
      return;
    }

    const recallCd = document.getElementById("memory-recall-countdown");
    const recallDeadline = Date.now() + RECALL_MS;
    function tickRecallCd() {
      const ms = Math.max(0, recallDeadline - Date.now());
      const sec = Math.ceil(ms / 1000);
      const shown = Math.min(RECALL_SEC, Math.max(0, sec));
      if (recallCd) {
        recallCd.textContent = String(shown);
      }
      if (rec) {
        rec.classList.toggle("memory-phase--recall-urgent", shown <= 3 && shown > 0);
      }
    }
    tickRecallCd();
    recallIntervalId = setInterval(tickRecallCd, 120);

    recallEndTimeoutId = setTimeout(() => {
      if (!sessionActive || !callbacks) {
        return;
      }
      failCurrentRecallAttempt("timeout");
    }, RECALL_MS);

    cloud.innerHTML = "";
    const words = buildCloud(sequence);
    words.forEach((word, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "memory-word-chip";
      btn.textContent = word;
      btn.dataset.word = word;
      btn.dataset.idx = String(idx);
      btn.addEventListener("click", () => handleRecallClick(word, btn));
      cloud.appendChild(btn);
    });
  }

  function handleRecallClick(word, btn) {
    if (!sessionActive || !callbacks) {
      return;
    }
    if (btn.disabled) {
      return;
    }
    if (word !== sequence[recallIndex]) {
      failCurrentRecallAttempt("wrong");
      return;
    }

    btn.disabled = true;
    btn.classList.add("memory-word-chip--picked");
    recallIndex += 1;
    updateStepHud();

    if (recallIndex >= SEQUENCE_LEN) {
      sessionActive = false;
      clearRecallTimers();
      const recPhase = document.getElementById("memory-phase-recall");
      if (recPhase) {
        recPhase.classList.remove("memory-phase--recall-urgent");
      }
      const cb = callbacks.onSolved;
      callbacks = null;
      if (typeof cb === "function") {
        cb();
      }
      return;
    }
  }

  function cloudClearDisabled() {
    document.querySelectorAll(".memory-word-chip").forEach((b) => {
      b.disabled = false;
      b.classList.remove("memory-word-chip--picked");
    });
  }

  function startMemorizePhase() {
    clearMemorizeTimers();
    clearRecallTimers();
    const recPhase = document.getElementById("memory-phase-recall");
    if (recPhase) {
      recPhase.classList.remove("memory-phase--recall-urgent");
    }
    sequence = pickSequence();

    const mem = document.getElementById("memory-phase-memorize");
    const rec = document.getElementById("memory-phase-recall");
    if (mem) {
      mem.hidden = false;
    }
    if (rec) {
      rec.hidden = true;
    }

    const seqEl = document.getElementById("memory-sequence-display");
    if (seqEl) {
      seqEl.innerHTML = "";
      sequence.forEach((word, i) => {
        const slot = document.createElement("div");
        slot.className = "memory-seq-slot";
        slot.style.setProperty("--i", String(i));
        const num = document.createElement("span");
        num.className = "memory-seq-slot__idx";
        num.textContent = String(i + 1);
        const w = document.createElement("span");
        w.className = "memory-seq-slot__word";
        w.textContent = word;
        slot.appendChild(num);
        slot.appendChild(w);
        seqEl.appendChild(slot);
      });
    }

    const cdEl = document.getElementById("memory-countdown");
    const deadline = Date.now() + MEMORIZE_MS;
    function tickCd() {
      const ms = Math.max(0, deadline - Date.now());
      const sec = Math.ceil(ms / 1000);
      if (cdEl) {
        cdEl.textContent = String(Math.min(MEMORIZE_SEC, Math.max(0, sec)));
      }
    }
    tickCd();
    memorizeIntervalId = setInterval(tickCd, 120);

    memorizeEndTimeoutId = setTimeout(() => {
      clearMemorizeTimers();
      if (!sessionActive) {
        return;
      }
      startRecallPhase();
    }, MEMORIZE_MS);
  }

  function stopOtherMinigames() {
    if (window.ArcheryMinigame) {
      ArcheryMinigame.stop();
    }
    if (window.BombDefusalMinigame) {
      BombDefusalMinigame.stop();
    }
  }

  return {
    ROOM,
    SEQUENCE_LEN,
    MEMORIZE_SEC,
    RECALL_SEC,

    stop() {
      clearMemorizeTimers();
      clearRecallTimers();
      sessionActive = false;
      callbacks = null;
      sequence = [];
      recallIndex = 0;
      attemptsLeft = MAX_ATTEMPTS;
      setMemoryWrapVisible(false);
      setPuzzleModalMemoryMode(false);
      const mem = document.getElementById("memory-phase-memorize");
      const rec = document.getElementById("memory-phase-recall");
      if (mem) {
        mem.hidden = false;
      }
      if (rec) {
        rec.hidden = true;
        rec.classList.remove("memory-phase--recall-urgent");
      }
      const recallCd = document.getElementById("memory-recall-countdown");
      if (recallCd) {
        recallCd.textContent = String(RECALL_SEC);
      }
      const cloud = document.getElementById("memory-word-cloud");
      if (cloud) {
        cloud.innerHTML = "";
      }
      const seqEl = document.getElementById("memory-sequence-display");
      if (seqEl) {
        seqEl.innerHTML = "";
      }
      const dots = document.getElementById("memory-progress-dots");
      if (dots) {
        dots.innerHTML = "";
      }
    },

    /**
     * @param {boolean | undefined} clearFeedback
     * @param {{ onSolved: function, onGameOver: function }} cb
     */
    render(clearFeedback, cb) {
      stopOtherMinigames();
      clearMemorizeTimers();
      clearRecallTimers();

      sessionActive = true;
      callbacks = cb;
      attemptsLeft = MAX_ATTEMPTS;
      recallIndex = 0;

      setArcheryWrapVisible(false);
      setPuzzleModalArcheryMode(false);
      setBombWrapVisible(false);
      setPuzzleModalBombMode(false);
      setMemoryWrapVisible(true);
      setPuzzleModalMemoryMode(true);

      const titleEl = document.getElementById("puzzle-modal-title");
      if (titleEl) {
        titleEl.textContent = "Door lock — mnemonic sequence";
      }
      const questionEl = document.getElementById("puzzle-question");
      if (questionEl) {
        questionEl.style.whiteSpace = "pre-line";
        questionEl.textContent =
          "Memorize seven words in order (10 seconds to view).\nThen tap them in the same order in the word cloud — 15 seconds per matching attempt. Three attempts total (wrong tap or timeout each costs one).";
      }
      const optionsEl = document.getElementById("puzzle-options");
      if (optionsEl) {
        optionsEl.innerHTML = "";
        optionsEl.hidden = true;
      }
      const feedbackEl = document.getElementById("puzzle-feedback");
      if (clearFeedback !== false && feedbackEl) {
        feedbackEl.textContent = "";
        feedbackEl.classList.remove("puzzle-modal__feedback--success");
      }

      const cdEl = document.getElementById("memory-countdown");
      if (cdEl) {
        cdEl.textContent = String(MEMORIZE_SEC);
      }
      const recallCdReset = document.getElementById("memory-recall-countdown");
      if (recallCdReset) {
        recallCdReset.textContent = String(RECALL_SEC);
      }

      startMemorizePhase();
    },
  };
})();
