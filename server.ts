import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";

interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  hasAnswered: boolean;
  joinedAt: number;
}

interface Room {
  id: string;
  hostId: string;
  gameStarted: boolean;
  players: Player[];
  questions?: any[];
  roundCount: number;
}

const rooms = new Map<string, Room>();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("room:create", ({ nickname }) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const player: Player = {
        id: socket.id,
        nickname,
        isHost: true,
        isReady: false,
        score: 0,
        hasAnswered: false,
        joinedAt: Date.now(),
      };

      const room: Room = {
        id: roomId,
        hostId: socket.id,
        gameStarted: false,
        players: [player],
        roundCount: 5, // Default
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit("room:joined", { room, player });
      console.log(`Room created: ${roomId} by ${nickname}`);
    });

    socket.on("room:join", ({ roomId, nickname }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit("error", { message: "Sala não encontrada." });
        return;
      }

      if (room.gameStarted) {
        socket.emit("error", { message: "O jogo já começou nesta sala." });
        return;
      }

      const player: Player = {
        id: socket.id,
        nickname,
        isHost: false,
        isReady: false,
        score: 0,
        hasAnswered: false,
        joinedAt: Date.now(),
      };

      room.players.push(player);
      socket.join(roomId);
      socket.emit("room:joined", { room, player });
      io.to(roomId).emit("room:update", room);
      console.log(`${nickname} joined room: ${roomId}`);
    });

    socket.on("player:ready", ({ roomId, isReady }) => {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find((p) => p.id === socket.id);
        if (player) {
          player.isReady = isReady;
          io.to(roomId).emit("room:update", room);
        }
      }
    });

    socket.on("game:start", ({ roomId, questions, roundCount }) => {
      const room = rooms.get(roomId);
      if (room && room.hostId === socket.id) {
        room.gameStarted = true;
        room.questions = questions;
        if (roundCount) room.roundCount = roundCount;
        room.players.forEach(p => {
          p.hasAnswered = false;
        });
        io.to(roomId).emit("game:started", { questions, roundCount: room.roundCount });
        io.to(roomId).emit("room:update", room);
      }
    });

    socket.on("game:answer", ({ roomId, correct, score }) => {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find((p) => p.id === socket.id);
        if (player) {
          player.hasAnswered = true;
          player.score += score;
          io.to(roomId).emit("room:update", room);

          const allAnswered = room.players.every(p => p.hasAnswered);
          if (allAnswered) {
             io.to(roomId).emit("round:end");
          }
        }
      }
    });

    socket.on("game:next_round", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.hostId === socket.id) {
        room.players.forEach(p => p.hasAnswered = false);
        io.to(roomId).emit("round:next");
        io.to(roomId).emit("room:update", room);
      }
    });

    socket.on("game:reset", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.hostId === socket.id) {
        room.gameStarted = false;
        room.players.forEach(p => {
          p.score = 0;
          p.isReady = false;
          p.hasAnswered = false;
        });
        io.to(roomId).emit("game:reseted");
        io.to(roomId).emit("room:update", room);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);
          
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            if (player.isHost) {
              const nextHost = room.players[0];
              nextHost.isHost = true;
              room.hostId = nextHost.id;
            }
            io.to(roomId).emit("room:update", room);
          }
        }
      });
    });
  });

  // Proxy route to fetch hymns and bypass CORS
  app.get("/api/hymn/:id", async (req, res) => {
    const { id } = req.params;
    const paddedId = id.padStart(3, '0');
    const url = `https://cifrasccb.com.br/cifra?h=${paddedId}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      res.send(response.data);
    } catch (error) {
      console.error(`Error fetching hymn ${id}:`, error);
      res.status(500).send("Error fetching hymn");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
