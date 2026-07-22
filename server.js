const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static('public'));

const SHAPES = ["Circle", "Square", "Triangle", "Cross", "Star"];
const NUMBERS = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];

let rooms = {};

function createDeck() {
  let deck = [];
  SHAPES.forEach(s => {
    NUMBERS.forEach(n => {
      if (s === "Star" && n > 8) return;
      deck.push({ shape: s, number: n });
    });
  });
  for (let i = 0; i < 5; i++) {
    deck.push({ shape: "Whot", number: 20 });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        deck: [],
        discardPile: [],
        currentTurn: 0,
        currentDemand: null,
        gameState: 'waiting'
      };
    }

    const room = rooms[roomId];

    if (room.players.length >= 2) {
      socket.emit('errorMsg', 'Room is full! Maximum 2 players.');
      return;
    }

    const playerIndex = room.players.length;
    room.players.push({
      id: socket.id,
      name: playerName || `Player ${playerIndex + 1}`,
      hand: []
    });

    socket.emit('playerAssigned', { playerIndex });

    if (room.players.length === 2) {
      // Start Game
      room.deck = createDeck();
      room.players[0].hand = room.deck.splice(0, 5);
      room.players[1].hand = room.deck.splice(0, 5);

      // Top card seed
      while (true) {
        let card = room.deck.pop();
        if (card.shape !== "Whot" && ![1, 2, 14].includes(card.number)) {
          room.discardPile.push(card);
          break;
        } else {
          room.deck.unshift(card);
        }
      }

      room.gameState = 'playing';
      updateRoomState(roomId);
    } else {
      io.to(roomId).emit('waitingForOpponent');
    }
  });

  socket.on('playCard', ({ roomId, cardIndex, requestedShape }) => {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'playing') return;

    const pIdx = room.players.findIndex(p => p.id === socket.id);
    if (pIdx !== room.currentTurn) return;

    const player = room.players[pIdx];
    const card = player.hand[cardIndex];

    player.hand.splice(cardIndex, 1);
    room.discardPile.push(card);
    room.currentDemand = requestedShape || null;

    if (player.hand.length === 0) {
      room.gameState = 'ended';
      io.to(roomId).emit('gameOver', { winner: player.name });
      return;
    }

    // Special card actions
    if (card.number === 1) {
      // Hold On (Same player turns again)
    } else if (card.number === 2) {
      // Pick Two
      const opponent = room.players[1 - pIdx];
      drawFromDeck(room, opponent.hand, 2);
      room.currentTurn = 1 - pIdx;
    } else if (card.number === 14) {
      // General Market
      const opponent = room.players[1 - pIdx];
      drawFromDeck(room, opponent.hand, 1);
      room.currentTurn = 1 - pIdx;
    } else {
      room.currentTurn = 1 - pIdx;
    }

    updateRoomState(roomId);
  });

  socket.on('drawCard', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.gameState !== 'playing') return;

    const pIdx = room.players.findIndex(p => p.id === socket.id);
    if (pIdx !== room.currentTurn) return;

    drawFromDeck(room, room.players[pIdx].hand, 1);
    room.currentTurn = 1 - pIdx;
    updateRoomState(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    for (const rId in rooms) {
      const room = rooms[rId];
      if (room.players.some(p => p.id === socket.id)) {
        io.to(rId).emit('playerDisconnected');
        delete rooms[rId];
      }
    }
  });
});

function drawFromDeck(room, hand, count) {
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length <= 1) break;
      const top = room.discardPile.pop();
      room.deck = room.discardPile;
      room.discardPile = [top];
      // Shuffle deck
      for (let k = room.deck.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [room.deck[k], room.deck[j]] = [room.deck[j], room.deck[k]];
      }
    }
    if (room.deck.length > 0) hand.push(room.deck.pop());
  }
}

function updateRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach((player, idx) => {
    const opponent = room.players[1 - idx];
    io.to(player.id).emit('gameState', {
      myHand: player.hand,
      opponentCardCount: opponent ? opponent.hand.length : 0,
      opponentName: opponent ? opponent.name : 'Waiting...',
      topCard: room.discardPile[room.discardPile.length - 1],
      currentDemand: room.currentDemand,
      isMyTurn: room.currentTurn === idx,
      gameState: room.gameState
    });
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});