/**
 * Room 1,3 door lock: timed bomb defusal — three wires, random safe wire, 60s countdown.
 * Wrong cut or timeout is handled by host via callbacks (game over, etc.).
 */
window.BombDefusalMinigame = (function bombDefusalIife() {
  /** 3×3 grid cell for this lock (row-major “room 3” ≈ label 1,3). */
  const ROOM = { row: 0, col: 2 };

  const WIRE_IDS = ["red", "blue", "green"];

  /**
   * Oblique associations for the *safe* wire color — different line each time the player asks.
   * Categories: chemistry, architecture, art, nature, objects, misc (no wire color names spelled out).
   */
  const HINT_BANK = {
    red: [
      "Cinnabar pigments and vermilion lacquer share this family.",
      "The oxide film everyone calls rust remembers iron breathing air.",
      "Mars in the telescope — powder and old river ghosts.",
      "The gem trade ranks ruby with corundum; think of its hue, not its name.",
      "London’s telephone castings and post boxes were painted in this tradition.",
      "Hemoglobin’s oxygenated whisper in diagrams leans this way.",
      "Terracotta rooflines above brick Gothic in the Baltic.",
      "Thermite’s shower of sparks before the slag cools.",
      "The outer ring of a target where beginners still score points.",
      "Brick of the Song-era citadel — millions of them, one temperature.",
      "The flag of Morocco fields a five-point star on this field.",
      "Capsicum annuum at full ripeness on the vine.",
      "Nitrogen dioxide in a lecture bottle — a dense, theatrical bloom.",
      "Vintage signal flares over a runway before dawn.",
      "The enamel on a classic barn in New England, faded by snow.",
    ],
    blue: [
      "Hydrated copper sulfate — the school lab grew these shards.",
      "Yves Klein patented a monochrome depth people still call by his name.",
      "Delftware underglaze before the kiln seals the story.",
      "The center panel of the United Nations flag — water and distance.",
      "Indigo vats in Edo-era yards; repetitive dipping, same deep tone.",
      "Lapis pigment ground for ultramarine — pricey as gold once.",
      "Santorini shutters against the Aegean glare.",
      "The argon discharge tube, cool and electric, trends this way.",
      "A clear summer shadow line on concrete at noon — not black, not gray.",
      "The inkwell Jean Cocteau liked beside vellum and smoke.",
      "Cerulean on the painter’s metal tube — skies, not foliage.",
      "The hole in the ozone scare posters of the eighties — stylized, graphic.",
      "Deep-ocean bioluminescence against the black — faint, this cast.",
      "Woad fermentation in Northern Europe — cloth emerges altered.",
      "The default \"hyperlink\" memory of early browsers — nostalgia, not poison.",
    ],
    green: [
      "Chlorophyll’s absorption dumps unused photons; your eye catches the leftovers.",
      "Fresh copper roofs in the rain, before they bronze with age.",
      "The benches in the House of Commons — felt, leather, institution.",
      "British racing livery on a wet track at Goodwood.",
      "Absinthe louched with water — clouded spirit, clear origin.",
      "Jade burial suits dreamed permanence in Han tombs.",
      "The Emerald City in Oz — the film lied with technicolor, the book less so.",
      "Olive drab canvas on surplus packs in an army-navy store.",
      "Malachite pigment ground with oil — copper carbonate, loud luxury.",
      "Mint cordial diluting in soda — herbal, sharp, unmistakable.",
      "The oxidized layer of Lady Liberty when copper salts still ruled the alloy.",
      "A slalom gate flag on a mogul course — caution and permission.",
      "Dicamba marker dye in ag chem — tell farmers where spray went.",
      "Forest canopy from a plane — not pine shadow, sunlit leaf.",
      "Irish hills after rain when the grass remembers neon.",
    ],
  };

  const TIMER_MS = 60_000;
  const SUCCESS_HOLD_MS = 2_000;
  const MSG_DEFUSAL_SUCCESS =
    "Correct wire — charge neutralized. Well done; the lock is disengaging.";

  let timerId = null;
  let successExitTimeoutId = null;
  /** @type {string | null} */
  let correctWire = null;
  let sessionActive = false;
  /** @type {{ onSolved: function, onWrongWire: function, onTimerExpired: function } | null} */
  let callbacks = null;

  /** @type {AudioContext | null} */
  let tickAudioCtx = null;

  function playSecondTick(remainingSec) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        return;
      }
      if (!tickAudioCtx) {
        tickAudioCtx = new AC();
      }
      const ctx = tickAudioCtx;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      let freq = 720;
      if (remainingSec <= 5 && remainingSec > 0) {
        freq = 1080;
      } else if (remainingSec <= 15) {
        freq = 880;
      }
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.1, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.065);
    } catch {
      /* ignore */
    }
  }

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

  function pickRandomWire() {
    return WIRE_IDS[randomIntBelow(WIRE_IDS.length)];
  }

  function stopTimer() {
    if (timerId != null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function clearSuccessExitTimer() {
    if (successExitTimeoutId != null) {
      clearTimeout(successExitTimeoutId);
      successExitTimeoutId = null;
    }
  }

  function setWireButtonsDisabled(disabled) {
    const wrap = document.getElementById("bomb-wire-buttons");
    if (wrap) {
      wrap.querySelectorAll(".bomb-wire").forEach((btn) => {
        btn.disabled = disabled;
      });
    }
    const hintBtn = document.getElementById("bomb-hint-btn");
    if (hintBtn) {
      hintBtn.disabled = disabled;
    }
  }

  function resetBombHintPanel() {
    const hintPanel = document.getElementById("bomb-hint-panel");
    const hintBtn = document.getElementById("bomb-hint-btn");
    if (hintPanel) {
      hintPanel.textContent = "";
      hintPanel.hidden = true;
    }
    if (hintBtn) {
      hintBtn.disabled = false;
    }
  }

  function bindHintButton() {
    const hintBtn = document.getElementById("bomb-hint-btn");
    const hintPanel = document.getElementById("bomb-hint-panel");
    if (!hintBtn || !hintPanel) {
      return;
    }
    hintPanel.hidden = true;
    hintPanel.textContent = "";
    hintBtn.disabled = false;
    hintBtn.onclick = () => {
      if (!sessionActive || !correctWire) {
        return;
      }
      const list = HINT_BANK[correctWire];
      if (!list || list.length === 0) {
        return;
      }
      hintPanel.textContent = list[randomIntBelow(list.length)];
      hintPanel.hidden = false;
    };
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

  function handleTimeout() {
    if (!sessionActive || !callbacks) {
      return;
    }
    const modal = document.getElementById("puzzle-modal");
    if (!modal || modal.hidden) {
      return;
    }
    sessionActive = false;
    stopTimer();
    const cb = callbacks.onTimerExpired;
    callbacks = null;
    correctWire = null;
    if (typeof cb === "function") {
      cb();
    }
  }

  function startTimer() {
    stopTimer();
    const deadline = Date.now() + TIMER_MS;
    const label = document.getElementById("bomb-time-left");
    let prevSecForTick = -1;
    function tick() {
      if (!sessionActive) {
        stopTimer();
        return;
      }
      if (!label) {
        stopTimer();
        return;
      }
      const ms = Math.max(0, deadline - Date.now());
      const totalSec = Math.ceil(ms / 1000);
      if (prevSecForTick >= 0 && totalSec < prevSecForTick) {
        playSecondTick(totalSec);
      }
      prevSecForTick = totalSec;
      const m = Math.floor(totalSec / 60);
      const r = totalSec % 60;
      label.textContent = `${m}:${String(r).padStart(2, "0")}`;
      label.classList.toggle("puzzle-bomb__timer--warn", totalSec <= 15 && totalSec > 0);
      label.classList.toggle("puzzle-bomb__timer--critical", totalSec <= 5 && totalSec > 0);
      if (ms <= 0) {
        stopTimer();
        handleTimeout();
      }
    }
    tick();
    timerId = setInterval(tick, 250);
  }

  function handleWireCut(wireId) {
    if (!sessionActive || !callbacks) {
      return;
    }
    if (wireId === correctWire) {
      stopTimer();
      sessionActive = false;
      const cbSolved = callbacks.onSolved;
      callbacks = null;
      correctWire = null;

      setWireButtonsDisabled(true);

      const feedbackEl = document.getElementById("puzzle-feedback");
      if (feedbackEl) {
        feedbackEl.textContent = MSG_DEFUSAL_SUCCESS;
        feedbackEl.classList.add("puzzle-modal__feedback--success");
      }

      clearSuccessExitTimer();
      successExitTimeoutId = setTimeout(() => {
        successExitTimeoutId = null;
        if (feedbackEl) {
          feedbackEl.classList.remove("puzzle-modal__feedback--success");
        }
        if (typeof cbSolved === "function") {
          cbSolved();
        }
      }, SUCCESS_HOLD_MS);
      return;
    }
    sessionActive = false;
    stopTimer();
    const cbWrong = callbacks.onWrongWire;
    callbacks = null;
    correctWire = null;
    if (typeof cbWrong === "function") {
      cbWrong();
    }
  }

  return {
    ROOM,
    WIRE_IDS,

    isSessionActive() {
      return sessionActive;
    },

    stop() {
      clearSuccessExitTimer();
      stopTimer();
      sessionActive = false;
      callbacks = null;
      correctWire = null;
      setWireButtonsDisabled(false);
      const feedbackEl = document.getElementById("puzzle-feedback");
      if (feedbackEl) {
        feedbackEl.classList.remove("puzzle-modal__feedback--success");
      }
      setBombWrapVisible(false);
      setPuzzleModalBombMode(false);
    },

    /**
     * @param {boolean | undefined} clearFeedback
     * @param {{ onSolved: function, onWrongWire: function, onTimerExpired: function }} cb
     */
    render(clearFeedback, cb) {
      if (window.ArcheryMinigame) {
        ArcheryMinigame.stop();
      }
      clearSuccessExitTimer();
      stopTimer();
      setWireButtonsDisabled(false);
      const prevFeedback = document.getElementById("puzzle-feedback");
      if (prevFeedback) {
        prevFeedback.classList.remove("puzzle-modal__feedback--success");
      }
      sessionActive = true;
      callbacks = cb;
      correctWire = pickRandomWire();

      setArcheryWrapVisible(false);
      setPuzzleModalArcheryMode(false);
      setBombWrapVisible(true);
      setPuzzleModalBombMode(true);

      const titleEl = document.getElementById("puzzle-modal-title");
      if (titleEl) {
        titleEl.textContent = "Door lock — bomb defusal";
      }
      const questionEl = document.getElementById("puzzle-question");
      if (questionEl) {
        questionEl.style.whiteSpace = "pre-line";
        questionEl.textContent =
          "Wires: Red · Blue · Green\n\nClue: Cut the wire that is not primary.\n\nYou have 60 seconds.";
      }
      const optionsEl = document.getElementById("puzzle-options");
      if (optionsEl) {
        optionsEl.innerHTML = "";
        optionsEl.hidden = true;
      }
      const feedbackEl = document.getElementById("puzzle-feedback");
      if (clearFeedback !== false && feedbackEl) {
        feedbackEl.textContent = "";
      }

      resetBombHintPanel();
      bindHintButton();

      const wiresEl = document.getElementById("bomb-wire-buttons");
      if (wiresEl) {
        wiresEl.innerHTML = "";
        WIRE_IDS.forEach((id) => {
          const label = id.charAt(0).toUpperCase() + id.slice(1);
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `bomb-wire bomb-wire--${id}`;
          btn.setAttribute("aria-label", `Cut ${label} wire`);
          btn.dataset.wire = id;
          btn.innerHTML = `
        <span class="bomb-wire__nub" aria-hidden="true"></span>
        <span class="bomb-wire__coil" aria-hidden="true"></span>
        <span class="bomb-wire__copper" aria-hidden="true">
          <span class="bomb-wire__strand"></span>
          <span class="bomb-wire__strand"></span>
          <span class="bomb-wire__strand"></span>
        </span>
        <span class="bomb-wire__label">${label}</span>
        <span class="bomb-wire__action">Cut wire</span>
      `;
          btn.addEventListener("click", () => handleWireCut(id));
          wiresEl.appendChild(btn);
        });
      }

      const timeLabel = document.getElementById("bomb-time-left");
      if (timeLabel) {
        timeLabel.classList.remove("puzzle-bomb__timer--warn", "puzzle-bomb__timer--critical");
        timeLabel.textContent = "1:00";
      }

      startTimer();
    },
  };
})();
