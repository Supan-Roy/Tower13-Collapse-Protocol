const ROOM_TYPES = {
  SAFE: "SAFE",
};

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
  visitedRooms: new Set(),
};

function initGame() {
  const floorIndicator = document.getElementById("floor-indicator");
  floorIndicator.textContent = `Floor ${gameState.currentFloor}`;

  generateFloor();
  markCurrentRoomVisited();
  renderGrid();
  updateInfoMessage("Open a nearby door, then click an adjacent room to move.");
}

function generateFloor() {
  const { rows, cols } = gameState.gridSize;
  gameState.floorData = [];

  for (let row = 0; row < rows; row += 1) {
    const rowData = [];
    for (let col = 0; col < cols; col += 1) {
      rowData.push({
        row,
        col,
        type: ROOM_TYPES.SAFE,
        doors: createRoomDoors(row, col, rows, cols),
      });
    }
    gameState.floorData.push(rowData);
  }
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

      if (isVisitedRoom(row, col)) {
        roomButton.classList.add("visited");
      }

      if (isPlayerAt(row, col)) {
        roomButton.classList.add("player");
      }

      const centerButton = document.createElement("button");
      centerButton.type = "button";
      centerButton.classList.add("room-center");
      centerButton.textContent = `${row + 1},${col + 1}`;
      centerButton.addEventListener("click", () => {
        movePlayer(row, col);
      });
      roomButton.appendChild(centerButton);

      const roomData = getRoom(row, col);
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
  const { row: currentRow, col: currentCol } = gameState.playerPosition;

  if (targetRow === currentRow && targetCol === currentCol) {
    updateInfoMessage("You are already in this room.");
    return;
  }

  if (!isInsideGrid(targetRow, targetCol)) {
    updateInfoMessage("That room is outside the floor layout.");
    return;
  }

  const rowDistance = Math.abs(targetRow - currentRow);
  const colDistance = Math.abs(targetCol - currentCol);
  const isAdjacent = rowDistance + colDistance === 1;

  if (!isAdjacent) {
    updateInfoMessage("Move only one room up, down, left, or right.");
    return;
  }

  const direction = getDirectionBetween(currentRow, currentCol, targetRow, targetCol);
  if (!isDoorOpen(currentRow, currentCol, direction)) {
    updateInfoMessage("The connecting door is closed. Open it first.");
    return;
  }

  gameState.playerPosition = { row: targetRow, col: targetCol };
  markCurrentRoomVisited();
  renderGrid();
  updateInfoMessage(`Moved to room ${targetRow + 1},${targetCol + 1}.`);
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

function toggleDoor(row, col, direction) {
  const room = getRoom(row, col);
  const door = room.doors[direction];

  if (!door || !door.exists) {
    return;
  }

  const nextState = !door.open;
  room.doors[direction].open = nextState;

  const { row: rowStep, col: colStep, opposite } = DIRECTIONS[direction];
  const neighborRow = row + rowStep;
  const neighborCol = col + colStep;
  const neighbor = getRoom(neighborRow, neighborCol);

  if (neighbor) {
    neighbor.doors[opposite].open = nextState;
  }

  renderGrid();
  updateInfoMessage(
    `${capitalize(direction)} door ${nextState ? "opened" : "closed"} at room ${row + 1},${col + 1}.`
  );
}

function markCurrentRoomVisited() {
  const { row, col } = gameState.playerPosition;
  gameState.visitedRooms.add(getRoomKey(row, col));
}

function isVisitedRoom(row, col) {
  return gameState.visitedRooms.has(getRoomKey(row, col));
}

function isPlayerAt(row, col) {
  return gameState.playerPosition.row === row && gameState.playerPosition.col === col;
}

function isInsideGrid(row, col) {
  const { rows, cols } = gameState.gridSize;
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function getRoomKey(row, col) {
  return `${row}-${col}`;
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

function updateInfoMessage(message) {
  const infoMessage = document.getElementById("info-message");
  infoMessage.textContent = message;
}

initGame();
