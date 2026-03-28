const ROOM_TYPES = {
  SAFE: "SAFE",
  CLUE: "CLUE",
  DANGER: "DANGER",
  STAIRS: "STAIRS",
};

const HINT_NEAR_DANGER = "You feel a strange heat nearby...";
const MSG_SAFE_QUIET = "The room is quiet.";
const MSG_STAIRS =
  "You found a way down... but the tower still feels unstable.";
const MSG_DANGER_DEATH =
  "A sudden explosion engulfs the room. You didn't survive.";
const MSG_TUTORIAL =
  "Stand in a room and open a door — each lock is a random quiz or archery (hit ring 9–10). Cleared locks stay open for that passage.";

const EXPLOSION_SOUND_SRC = "assets/sounds/explosion-fx.mp3";

const DIRECTIONS = {
  up: { row: -1, col: 0, opposite: "down" },
  down: { row: 1, col: 0, opposite: "up" },
  left: { row: 0, col: -1, opposite: "right" },
  right: { row: 0, col: 1, opposite: "left" },
};

const gameState = {
  currentFloor: 5,
  gridSize: { rows: 3, cols: 3 },
  playerPosition: { row: 0, col: 0 },
  floorData: [],
  gameOver: false,
  pendingInitialEntry: true,
  /** Normalized edge keys "r,c|r,c" — puzzle solved for that doorway forever this floor */
  doorPuzzleSolved: new Set(),
};

const puzzleModalState = {
  onSolved: null,
  /** Immutable copy of one bank entry (question + original options + correctIndex) */
  puzzleRaw: null,
  /** Fresh shuffle on each render — options order + correctIndex for current buttons */
  currentDisplay: null,
  /** "mcq" | "archery" */
  challengeType: null,
};

const ARCHERY_LOCK_CHANCE = 0.38;

function randomInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

/** Unbiased integer in [0, n) — prefers crypto for shuffles */
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

function pickRandomCell(candidates) {
  if (candidates.length === 0) {
    return null;
  }
  return candidates[randomInt(candidates.length)];
}

function getAllCellsExcept(excludeKeys) {
  const { rows, cols } = gameState.gridSize;
  const exclude = new Set(excludeKeys);
  const out = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${row},${col}`;
      if (!exclude.has(key)) {
        out.push({ row, col });
      }
    }
  }
  return out;
}

function placeDanger() {
  const candidates = getAllCellsExcept(["0,0"]);
  const picked = pickRandomCell(candidates);
  if (!picked) {
    return;
  }
  getRoom(picked.row, picked.col).type = ROOM_TYPES.DANGER;
}

function placeStairs() {
  const danger = findRoomByType(ROOM_TYPES.DANGER);
  const exclude = new Set(["0,0"]);
  if (danger) {
    exclude.add(`${danger.row},${danger.col}`);
  }
  const candidates = [];
  const { rows, cols } = gameState.gridSize;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${row},${col}`;
      if (!exclude.has(key)) {
        candidates.push({ row, col });
      }
    }
  }
  const picked = pickRandomCell(candidates);
  if (!picked) {
    return;
  }
  getRoom(picked.row, picked.col).type = ROOM_TYPES.STAIRS;
}

function generateFloor5() {
  const { rows, cols } = gameState.gridSize;
  gameState.floorData = [];
  gameState.doorPuzzleSolved.clear();

  for (let row = 0; row < rows; row += 1) {
    const rowData = [];
    for (let col = 0; col < cols; col += 1) {
      rowData.push({
        row,
        col,
        type: ROOM_TYPES.SAFE,
        visited: false,
        hint: null,
        doors: createRoomDoors(row, col, rows, cols),
      });
    }
    gameState.floorData.push(rowData);
  }

  placeDanger();
  placeStairs();
  assignHints();
}

function assignHints() {
  const dangerRoom = findRoomByType(ROOM_TYPES.DANGER);
  if (!dangerRoom) {
    return;
  }

  Object.values(DIRECTIONS).forEach((dir) => {
    const r = dangerRoom.row + dir.row;
    const c = dangerRoom.col + dir.col;
    if (!isInsideGrid(r, c)) {
      return;
    }
    if (r === 0 && c === 0) {
      return;
    }
    const room = getRoom(r, c);
    if (room.type === ROOM_TYPES.STAIRS) {
      return;
    }
    room.hint = HINT_NEAR_DANGER;
  });
}

function findRoomByType(type) {
  const { rows, cols } = gameState.gridSize;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const room = gameState.floorData[row][col];
      if (room.type === type) {
        return room;
      }
    }
  }
  return null;
}

let explosionAudio = null;

function playExplosionSound() {
  try {
    if (!explosionAudio) {
      explosionAudio = new Audio(EXPLOSION_SOUND_SRC);
      explosionAudio.preload = "auto";
    }
    explosionAudio.volume = 0.88;
    explosionAudio.currentTime = 0;
    explosionAudio.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function triggerExplosionFx() {
  const flash = document.getElementById("explosion-flash");
  const container = document.querySelector(".game-container");
  if (container) {
    container.classList.remove("game-container--shake");
    void container.offsetWidth;
    container.classList.add("game-container--shake");
  }

  if (!flash) {
    return;
  }

  flash.hidden = false;
  flash.setAttribute("aria-hidden", "false");
  flash.classList.remove("explosion-flash--active");
  void flash.offsetWidth;
  flash.classList.add("explosion-flash--active");
  playExplosionSound();

  const cleanup = () => {
    flash.classList.remove("explosion-flash--active");
    flash.hidden = true;
    flash.setAttribute("aria-hidden", "true");
    flash.removeEventListener("animationend", cleanup);
  };
  flash.addEventListener("animationend", cleanup, { once: true });
}

function handleRoomEntry(row, col) {
  const room = getRoom(row, col);
  if (!room) {
    return;
  }

  const isFirstBoot = gameState.pendingInitialEntry;

  room.visited = true;

  switch (room.type) {
    case ROOM_TYPES.SAFE:
      if (room.hint) {
        showMessage(HINT_NEAR_DANGER);
      } else if (!isFirstBoot) {
        showMessage(MSG_SAFE_QUIET);
      }
      break;
    case ROOM_TYPES.CLUE:
      showMessage(room.hint || HINT_NEAR_DANGER);
      break;
    case ROOM_TYPES.DANGER: {
      const infoLine = document.getElementById("info-message");
      if (infoLine) {
        infoLine.textContent = "";
        infoLine.classList.remove("info-message--in");
      }
      const deathLine = document.getElementById("game-over-death-msg");
      if (deathLine) {
        deathLine.textContent = MSG_DANGER_DEATH;
      }
      triggerExplosionFx();
      endGame();
      return;
    }
    case ROOM_TYPES.STAIRS:
      showMessage(MSG_STAIRS);
      break;
    default:
      break;
  }

  if (gameState.pendingInitialEntry) {
    gameState.pendingInitialEntry = false;
  }
}

function showMessage(text) {
  const infoMessage = document.getElementById("info-message");
  infoMessage.classList.remove("info-message--in");
  void infoMessage.offsetWidth;
  infoMessage.textContent = text;
  requestAnimationFrame(() => {
    infoMessage.classList.add("info-message--in");
  });
}

function setGameOverOverlayVisible(visible) {
  const overlay = document.getElementById("game-over-overlay");
  if (!overlay) {
    return;
  }
  overlay.hidden = !visible;
  overlay.setAttribute("aria-hidden", visible ? "false" : "true");
}

function endGame() {
  gameState.gameOver = true;
  const container = document.querySelector(".game-container");
  container.classList.add("game-container--game-over");
  setGameOverOverlayVisible(true);
  renderGrid();
}

function resetGame() {
  closePuzzleModal();
  gameState.gameOver = false;
  gameState.playerPosition = { row: 0, col: 0 };
  gameState.pendingInitialEntry = true;

  const flash = document.getElementById("explosion-flash");
  if (flash) {
    flash.classList.remove("explosion-flash--active");
    flash.hidden = true;
    flash.setAttribute("aria-hidden", "true");
  }

  const container = document.querySelector(".game-container");
  container.classList.remove("game-container--game-over", "game-container--shake");
  setGameOverOverlayVisible(false);

  const deathLine = document.getElementById("game-over-death-msg");
  if (deathLine) {
    deathLine.textContent = "";
  }

  const floorIndicator = document.getElementById("floor-indicator");
  floorIndicator.textContent = `Floor ${gameState.currentFloor}`;

  generateFloor5();
  markCurrentRoomVisited();
  renderGrid();
  showMessage(MSG_TUTORIAL);
  handleRoomEntry(0, 0);
}

function bindRestartControls() {
  const onRestart = () => {
    resetGame();
  };

  document.getElementById("restart-button")?.addEventListener("click", onRestart);
  document.getElementById("overlay-restart-button")?.addEventListener("click", onRestart);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !gameState.gameOver) {
      return;
    }
    event.preventDefault();
    resetGame();
  });
}

function renderGrid() {
  const gridElement = document.getElementById("room-grid");
  const { rows, cols } = gameState.gridSize;
  gridElement.innerHTML = "";
  gridElement.style.gridTemplateColumns = `repeat(${cols}, minmax(74px, 1fr))`;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const roomButton = document.createElement("div");
      roomButton.classList.add("room");
      roomButton.setAttribute("role", "gridcell");
      roomButton.setAttribute("aria-label", `Room ${row + 1}, ${col + 1}`);
      roomButton.dataset.row = String(row);
      roomButton.dataset.col = String(col);

      const roomData = getRoom(row, col);

      if (roomData.visited) {
        roomButton.classList.add("visited");
      }

      if (isPlayerAt(row, col)) {
        roomButton.classList.add("player");
      }

      if (roomData.hint) {
        roomButton.classList.add("clue");
      }

      if (roomData.type === ROOM_TYPES.STAIRS) {
        roomButton.classList.add("stairs");
      }

      const centerButton = document.createElement("button");
      centerButton.type = "button";
      centerButton.classList.add("room-center");
      centerButton.disabled = gameState.gameOver;
      centerButton.textContent = `${row + 1},${col + 1}`;
      centerButton.addEventListener("click", () => {
        movePlayer(row, col);
      });
      roomButton.appendChild(centerButton);

      createDoorElements(roomButton, roomData);

      if (isPlayerAt(row, col)) {
        const marker = document.createElement("span");
        marker.classList.add("player-marker");
        roomButton.appendChild(marker);
      }

      gridElement.appendChild(roomButton);
    }
  }
}

function movePlayer(targetRow, targetCol) {
  if (gameState.gameOver) {
    return;
  }

  const { row: currentRow, col: currentCol } = gameState.playerPosition;

  if (targetRow === currentRow && targetCol === currentCol) {
    showMessage("You are already in this room.");
    return;
  }

  if (!isInsideGrid(targetRow, targetCol)) {
    showMessage("That room is outside the floor layout.");
    return;
  }

  const rowDistance = Math.abs(targetRow - currentRow);
  const colDistance = Math.abs(targetCol - currentCol);
  const isAdjacent = rowDistance + colDistance === 1;

  if (!isAdjacent) {
    showMessage("Move only one room up, down, left, or right.");
    return;
  }

  const direction = getDirectionBetween(currentRow, currentCol, targetRow, targetCol);
  if (!isDoorOpen(currentRow, currentCol, direction)) {
    showMessage("The connecting door is closed. Open it first.");
    return;
  }

  gameState.playerPosition = { row: targetRow, col: targetCol };
  markCurrentRoomVisited();
  renderGrid();
  handleRoomEntry(targetRow, targetCol);
}

function createRoomDoors(row, col, rows, cols) {
  return {
    up: { exists: row > 0, open: false },
    down: { exists: row < rows - 1, open: false },
    left: { exists: col > 0, open: false },
    right: { exists: col < cols - 1, open: false },
  };
}

function createDoorElements(roomElement, roomData) {
  Object.keys(roomData.doors).forEach((direction) => {
    const door = roomData.doors[direction];
    if (!door.exists) {
      return;
    }

    const doorButton = document.createElement("button");
    doorButton.type = "button";
    doorButton.classList.add("door", `door-${direction}`);
    doorButton.disabled = gameState.gameOver;
    if (door.open) {
      doorButton.classList.add("open");
    }
    doorButton.setAttribute("aria-label", `${direction} door`);
    doorButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDoor(roomData.row, roomData.col, direction);
    });
    roomElement.appendChild(doorButton);
  });
}

function getDoorEdgeKey(row, col, direction) {
  const { row: dr, col: dc } = DIRECTIONS[direction];
  const r2 = row + dr;
  const c2 = col + dc;
  const a = `${row},${col}`;
  const b = `${r2},${c2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function clonePuzzleEntry(entry) {
  return {
    question: entry.question,
    options: [...entry.options],
    correctIndex: entry.correctIndex,
  };
}

/** New random order every call — use when rendering, not stored on the bank */
function shufflePuzzleOptions(puzzle) {
  const n = puzzle.options.length;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = randomIntBelow(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = order.map((idx) => puzzle.options[idx]);
  const correctIndex = order.indexOf(puzzle.correctIndex);
  return { question: puzzle.question, options, correctIndex };
}

function pickRandomPuzzleRaw() {
  const bank = window.DOOR_PUZZLE_BANK;
  if (!bank || bank.length === 0) {
    return null;
  }
  return clonePuzzleEntry(bank[randomInt(bank.length)]);
}

function pickRandomChallenge() {
  const bank = window.DOOR_PUZZLE_BANK;
  if (Math.random() < ARCHERY_LOCK_CHANCE) {
    return { type: "archery" };
  }
  if (!bank || bank.length === 0) {
    return { type: "archery" };
  }
  return { type: "mcq", data: clonePuzzleEntry(bank[randomInt(bank.length)]) };
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

function setPuzzleModalVisible(visible) {
  const modal = document.getElementById("puzzle-modal");
  if (!modal) {
    return;
  }
  modal.hidden = !visible;
  modal.setAttribute("aria-hidden", visible ? "false" : "true");
}

function renderMcqChallenge(clearFeedback) {
  if (window.ArcheryMinigame) {
    ArcheryMinigame.stop();
  }
  puzzleModalState.challengeType = "mcq";
  setArcheryWrapVisible(false);
  setPuzzleModalArcheryMode(false);
  const titleEl = document.getElementById("puzzle-modal-title");
  if (titleEl) {
    titleEl.textContent = "Door lock — clearance test";
  }
  const questionEl = document.getElementById("puzzle-question");
  const optionsEl = document.getElementById("puzzle-options");
  const feedbackEl = document.getElementById("puzzle-feedback");
  if (!questionEl || !optionsEl) {
    return;
  }
  optionsEl.hidden = false;
  if (clearFeedback !== false && feedbackEl) {
    feedbackEl.textContent = "";
  }
  const raw = puzzleModalState.puzzleRaw;
  if (!raw) {
    puzzleModalState.currentDisplay = null;
    questionEl.textContent = "No puzzle available.";
    optionsEl.innerHTML = "";
    return;
  }
  const display = shufflePuzzleOptions(raw);
  puzzleModalState.currentDisplay = display;
  questionEl.textContent = display.question;
  optionsEl.innerHTML = "";
  display.options.forEach((label, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "puzzle-option";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      handlePuzzleChoice(index);
    });
    optionsEl.appendChild(btn);
  });
}

function renderArcheryChallenge(clearFeedback) {
  if (!window.ArcheryMinigame) {
    const cb = puzzleModalState.onSolved;
    closePuzzleModal();
    if (typeof cb === "function") {
      cb();
    }
    return;
  }
  ArcheryMinigame.stop();
  puzzleModalState.challengeType = "archery";
  setPuzzleModalArcheryMode(true);
  const titleEl = document.getElementById("puzzle-modal-title");
  if (titleEl) {
    titleEl.textContent = "Door lock — archery trial";
  }
  const questionEl = document.getElementById("puzzle-question");
  if (questionEl) {
    questionEl.textContent =
      "Outdoor range — only a 9 or 10 in the gold clears this lock. Details are on the sides.";
  }
  const optionsEl = document.getElementById("puzzle-options");
  if (optionsEl) {
    optionsEl.innerHTML = "";
    optionsEl.hidden = true;
  }
  if (clearFeedback !== false) {
    const feedbackEl = document.getElementById("puzzle-feedback");
    if (feedbackEl) {
      feedbackEl.textContent = "";
    }
    const archeryFb = document.getElementById("archery-feedback");
    if (archeryFb) {
      archeryFb.textContent = "";
    }
    const lastEl = document.getElementById("archery-last-score");
    if (lastEl) {
      lastEl.textContent = "";
    }
  }
  setArcheryWrapVisible(true);
  const canvas = document.getElementById("archery-canvas");
  if (!canvas) {
    return;
  }
  ArcheryMinigame.start(canvas, {
    onShot(score) {
      if (score >= 9) {
        const cb = puzzleModalState.onSolved;
        ArcheryMinigame.stop();
        closePuzzleModal();
        if (typeof cb === "function") {
          cb();
        }
        return;
      }
      const lastEl = document.getElementById("archery-last-score");
      if (lastEl) {
        lastEl.textContent =
          score <= 0
            ? "Miss — adjust aim, draw length, and arc."
            : `Ring ${score} — need 9 or 10 (gold center).`;
      }
      const archeryFb = document.getElementById("archery-feedback");
      if (archeryFb) {
        archeryFb.textContent =
          "Try again — same lock until you score 9 or 10.";
      }
    },
  });
}

function openPuzzleModal(onSolved) {
  puzzleModalState.onSolved = onSolved;
  puzzleModalState.puzzleRaw = null;
  puzzleModalState.currentDisplay = null;
  puzzleModalState.challengeType = null;
  const challenge = pickRandomChallenge();
  if (challenge.type === "archery") {
    renderArcheryChallenge(true);
    setPuzzleModalVisible(true);
    return;
  }
  puzzleModalState.puzzleRaw = challenge.data;
  if (!puzzleModalState.puzzleRaw) {
    if (typeof onSolved === "function") {
      onSolved();
    }
    return;
  }
  renderMcqChallenge(true);
  setPuzzleModalVisible(true);
}

function closePuzzleModal() {
  if (window.ArcheryMinigame) {
    ArcheryMinigame.stop();
  }
  puzzleModalState.onSolved = null;
  puzzleModalState.puzzleRaw = null;
  puzzleModalState.currentDisplay = null;
  puzzleModalState.challengeType = null;
  const feedbackEl = document.getElementById("puzzle-feedback");
  if (feedbackEl) {
    feedbackEl.textContent = "";
  }
  const archeryFb = document.getElementById("archery-feedback");
  if (archeryFb) {
    archeryFb.textContent = "";
  }
  const optionsEl = document.getElementById("puzzle-options");
  if (optionsEl) {
    optionsEl.hidden = false;
  }
  setArcheryWrapVisible(false);
  setPuzzleModalArcheryMode(false);
  setPuzzleModalVisible(false);
}

function handlePuzzleChoice(chosenIndex) {
  const display = puzzleModalState.currentDisplay;
  if (!display) {
    return;
  }
  if (chosenIndex === display.correctIndex) {
    const cb = puzzleModalState.onSolved;
    closePuzzleModal();
    if (typeof cb === "function") {
      cb();
    }
    return;
  }
  const feedbackEl = document.getElementById("puzzle-feedback");
  if (feedbackEl) {
    feedbackEl.textContent = "Incorrect — new challenge.";
  }
  const next = pickRandomChallenge();
  if (next.type === "archery") {
    renderArcheryChallenge(false);
  } else {
    puzzleModalState.puzzleRaw = next.data;
    if (!puzzleModalState.puzzleRaw) {
      renderArcheryChallenge(false);
      return;
    }
    renderMcqChallenge(false);
  }
}

function bindPuzzleControls() {
  document.getElementById("puzzle-cancel")?.addEventListener("click", () => {
    closePuzzleModal();
    showMessage("Lock challenge cancelled. Door stays shut.");
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("puzzle-modal");
    if (!modal || modal.hidden) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closePuzzleModal();
      showMessage("Lock challenge cancelled. Door stays shut.");
    }
  });
}

function applyDoorOpenState(row, col, direction) {
  const room = getRoom(row, col);
  room.doors[direction].open = true;
  const { row: rowStep, col: colStep, opposite } = DIRECTIONS[direction];
  const neighbor = getRoom(row + rowStep, col + colStep);
  if (neighbor) {
    neighbor.doors[opposite].open = true;
  }
}

function applyDoorCloseState(row, col, direction) {
  const room = getRoom(row, col);
  room.doors[direction].open = false;
  const { row: rowStep, col: colStep, opposite } = DIRECTIONS[direction];
  const neighbor = getRoom(row + rowStep, col + colStep);
  if (neighbor) {
    neighbor.doors[opposite].open = false;
  }
}

function toggleDoor(row, col, direction) {
  if (gameState.gameOver) {
    return;
  }

  if (!isPlayerAt(row, col)) {
    showMessage("You can only operate doors in your current room.");
    return;
  }

  const room = getRoom(row, col);
  const door = room.doors[direction];

  if (!door || !door.exists) {
    return;
  }

  const nextState = !door.open;

  if (!nextState) {
    applyDoorCloseState(row, col, direction);
    renderGrid();
    showMessage(`${capitalize(direction)} door closed at room ${row + 1},${col + 1}.`);
    return;
  }

  const edgeKey = getDoorEdgeKey(row, col, direction);
  if (gameState.doorPuzzleSolved.has(edgeKey)) {
    applyDoorOpenState(row, col, direction);
    renderGrid();
    showMessage(`${capitalize(direction)} door opened at room ${row + 1},${col + 1}.`);
    return;
  }

  openPuzzleModal(() => {
    gameState.doorPuzzleSolved.add(edgeKey);
    applyDoorOpenState(row, col, direction);
    renderGrid();
    showMessage(
      `${capitalize(direction)} door unlocked and opened at room ${row + 1},${col + 1}.`
    );
  });
}

function markCurrentRoomVisited() {
  const { row, col } = gameState.playerPosition;
  const room = getRoom(row, col);
  if (room) {
    room.visited = true;
  }
}

function isPlayerAt(row, col) {
  return gameState.playerPosition.row === row && gameState.playerPosition.col === col;
}

function isInsideGrid(row, col) {
  const { rows, cols } = gameState.gridSize;
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function getRoom(row, col) {
  if (!isInsideGrid(row, col)) {
    return null;
  }

  return gameState.floorData[row][col];
}

function getDirectionBetween(fromRow, fromCol, toRow, toCol) {
  if (toRow === fromRow - 1 && toCol === fromCol) {
    return "up";
  }
  if (toRow === fromRow + 1 && toCol === fromCol) {
    return "down";
  }
  if (toRow === fromRow && toCol === fromCol - 1) {
    return "left";
  }
  return "right";
}

function isDoorOpen(row, col, direction) {
  const room = getRoom(row, col);
  if (!room) {
    return false;
  }

  const door = room.doors[direction];
  return Boolean(door && door.exists && door.open);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initGame() {
  bindPuzzleControls();
  bindRestartControls();
  resetGame();
}

initGame();
