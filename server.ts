import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
import { createServer } from "http";
import { Server } from "socket.io";
import ImageKit from "imagekit";

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

  // ImageKit init
  const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || process.env.VITE_IMAGEKIT_PUBLIC_KEY || "public_M4XXMyNcuHsTA/Iv32edvWiub8Q=",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_lBY7O2SbPjBfkdu9LoVsiqTDTfk=",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || process.env.VITE_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/isa2koeb2",
  });

  // Middleware JSON (precisa pra upload base64)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ===== ImageKit rotas =====
  app.get("/api/imagekit-auth", (req, res) => {
    try {
      const auth = imagekit.getAuthenticationParameters();
      res.json(auth);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/imagekit-test", async (req, res) => {
    try {
      // testa listando 1 arquivo (ou só valida keys)
      const result = await imagekit.listFiles({ limit: 1, skip: 0 } as any);
      res.json({ success: true, message: "Conectado ao ImageKit!", endpoint: process.env.IMAGEKIT_URL_ENDPOINT || process.env.VITE_IMAGEKIT_URL_ENDPOINT, filesCount: Array.isArray(result) ? result.length : 0 });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || String(e) });
    }
  });

  app.post("/api/upload-avatar", async (req, res) => {
    try {
      const { dataUrl, fileName } = req.body;
      if (!dataUrl) return res.status(400).json({ error: "dataUrl obrigatório" });
      const result = await imagekit.upload({
        file: dataUrl,
        fileName: fileName || `avatar_${Date.now()}.jpg`,
        folder: "/ccb-avatars",
        useUniqueFileName: true,
      });
      res.json({ url: result.url, fileId: result.fileId, thumbnail: result.thumbnailUrl });
    } catch (e: any) {
      console.error("ImageKit upload erro:", e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // Deleta avatar antigo do ImageKit pra não lotar (chamado quando troca foto)
  app.post("/api/delete-avatar", async (req, res) => {
    try {
      const { fileId, url } = req.body;
      let idToDelete = fileId;
      // Se só veio URL, tenta extrair fileId via listagem por nome
      if (!idToDelete && url && url.includes("ik.imagekit.io")) {
        try {
          const fileName = url.split("/").pop()?.split("?")[0];
          if (fileName) {
            const files: any = await imagekit.listFiles({ searchQuery: `name="${fileName}"` } as any);
            if (Array.isArray(files) && files.length > 0) idToDelete = files[0].fileId;
          }
        } catch {}
      }
      if (!idToDelete) return res.json({ success: false, message: "fileId não encontrado, ignorado" });
      await imagekit.deleteFile(idToDelete);
      console.log(`[ImageKit] Avatar deletado: ${idToDelete}`);
      res.json({ success: true, fileId: idToDelete });
    } catch (e: any) {
      console.error("ImageKit delete erro:", e);
      // Não falha o fluxo principal se delete falhar (arquivo pode já ter sido deletado)
      res.json({ success: false, error: e.message || String(e) });
    }
  });

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
