const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const PORT = process.env.PORT || 3001;

// Health endpoint
app.get('/health', (req, res) => {
  const rooms = io.sockets.adapter.rooms;
  const gameRooms = [...rooms.keys()].filter((id) => id.startsWith('game:'));
  const connections = io.engine.clientsCount;
  res.json({
    status: 'ok',
    rooms: gameRooms.length,
    connections,
  });
});

// Room = game:{gameId}
function roomForGame(gameId) {
  return `game:${gameId}`;
}

io.on('connection', (socket) => {
  socket.on('join_game', (payload) => {
    const { gameId, account, playerIndex } = payload || {};
    if (gameId == null) return;
    const room = roomForGame(String(gameId));
    socket.join(room);
    socket.currentGameId = gameId;
    socket.currentAccount = account;
    socket.currentPlayerIndex = playerIndex;
    socket.to(room).emit('player_joined', { gameId, account, playerIndex });
    const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
    io.to(room).emit('room_size', { gameId, size });
  });

  socket.on('paint', (payload) => {
    const { gameId, x, y, playerIndex, account, timestamp } = payload || {};
    if (gameId == null || x == null || y == null) return;
    const room = roomForGame(String(gameId));
    socket.to(room).emit('paint', {
      gameId,
      x: Number(x),
      y: Number(y),
      playerIndex: Number(playerIndex),
      account: account || '',
      timestamp: timestamp || Date.now(),
    });
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('disconnect', () => {
    const gameId = socket.currentGameId;
    if (gameId != null) {
      const room = roomForGame(String(gameId));
      const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
      io.to(room).emit('room_size', { gameId, size });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Pixel War relay listening on port ${PORT}`);
});
