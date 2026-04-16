import { io, Socket } from "socket.io-client";

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  hasAnswered: boolean;
  joinedAt: number;
}

export interface Room {
  id: string;
  hostId: string;
  gameStarted: boolean;
  players: Player[];
  questions?: any[];
}

// In Socket.io mode, we connect to the same origin
const socket: Socket = io();

export const multiplayerService = {
  socket,

  createRoom(nickname: string): Promise<{ room: Room; player: Player } | null> {
    return new Promise((resolve) => {
      socket.emit("room:create", { nickname });
      socket.once("room:joined", (data) => resolve(data));
      // Add timeout for safety
      setTimeout(() => resolve(null), 5000);
    });
  },

  joinRoom(roomId: string, nickname: string): Promise<Player | null> {
    return new Promise((resolve) => {
      socket.emit("room:join", { roomId: roomId.toUpperCase(), nickname });
      socket.once("room:joined", (data) => resolve(data.player));
      socket.once("error", () => resolve(null));
      setTimeout(() => resolve(null), 5000);
    });
  },

  toggleReady(roomId: string, isReady: boolean) {
    socket.emit("player:ready", { roomId, isReady });
  },

  updateScore(roomId: string, correct: boolean, score: number) {
    socket.emit("game:answer", { roomId, correct, score });
  },

  startGameWithQuestions(roomId: string, questions: any[]) {
    socket.emit("game:start", { roomId, questions });
  },

  resetRoom(roomId: string) {
    socket.emit("game:reset", { roomId });
  },

  nextRound(roomId: string) {
    socket.emit("game:next_round", { roomId });
  },

  leaveRoom() {
    socket.disconnect();
    socket.connect();
  },

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: Player[]) => void,
    onRoomUpdate: (room: Room) => void,
    onRoundEnd?: () => void,
    onNextRound?: () => void,
    onGameReset?: () => void
  ) {
    const handleUpdate = (room: Room) => {
      if (room.id === roomId) {
        onRoomUpdate(room);
        onPlayersChange(room.players);
      }
    };

    const handleError = (err: any) => {
      console.error("Socket error:", err);
    };

    socket.on("room:update", handleUpdate);
    socket.on("round:end", () => onRoundEnd?.());
    socket.on("round:next", () => onNextRound?.());
    socket.on("game:reseted", () => onGameReset?.());
    socket.on("error", handleError);

    return () => {
      socket.off("room:update", handleUpdate);
      socket.off("round:end");
      socket.off("round:next");
      socket.off("game:reseted");
      socket.off("error", handleError);
    };
  },
};
