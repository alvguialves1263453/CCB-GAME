import { supabase } from "../lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

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
  roundCount: number;
}

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let localPlayer: Player | null = null;

// Global callbacks to be assigned when React component mounts
let _onPlayersChange: ((players: Player[]) => void) | null = null;
let _onRoomUpdate: ((room: Room) => void) | null = null;
let _onRoundEnd: (() => void) | null = null;
let _onNextRound: (() => void) | null = null;
let _onGameReset: (() => void) | null = null;
let _onGameStarted: ((data: { questions: any[]; roundCount: number }) => void) | null = null;

export const multiplayerService = {
  async createRoom(nickname: string): Promise<{ room: Room; player: Player } | null> {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const player: Player = {
      id: Math.random().toString(36).substring(2, 10),
      nickname,
      isHost: true,
      isReady: false,
      score: 0,
      hasAnswered: false,
      joinedAt: Date.now(),
    };

    const room: Room = {
      id: roomId,
      hostId: player.id,
      gameStarted: false,
      players: [player],
      roundCount: 5,
    };

    try {
      await this.initChannel(roomId, player);
      return { room, player };
    } catch (error) {
      console.error("Error creating room:", error);
      return null;
    }
  },

  async joinRoom(roomId: string, nickname: string): Promise<Player | null> {
    const player: Player = {
      id: Math.random().toString(36).substring(2, 10),
      nickname,
      isHost: false,
      isReady: false,
      score: 0,
      hasAnswered: false,
      joinedAt: Date.now(),
    };

    try {
      await this.initChannel(roomId.toUpperCase(), player);
      return player;
    } catch (error) {
      console.error("Error joining room:", error);
      return null;
    }
  },

  async initChannel(roomId: string, player: Player) {
    if (channel) {
      await supabase.removeChannel(channel);
    }

    currentRoomId = roomId;
    localPlayer = player;
    
    channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: player.id,
        },
      },
    });

    const handleSync = () => {
      if (!channel) return;
      const state = channel.presenceState();
      const playersList: Player[] = [];
      
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: Player) => {
          playersList.push(p);
        });
      });

      const sortedPlayers = playersList.sort((a, b) => a.joinedAt - b.joinedAt);
      const host = sortedPlayers.find(p => p.isHost) || sortedPlayers[0];
      
      _onPlayersChange?.(sortedPlayers);
      
      const room: Room = {
        id: roomId,
        hostId: host?.id || '',
        gameStarted: false, 
        players: sortedPlayers,
        roundCount: 5
      };
      
      _onRoomUpdate?.(room);

      const allAnswered = sortedPlayers.length > 0 && sortedPlayers.every(p => p.hasAnswered);
      if (allAnswered) {
        _onRoundEnd?.();
      }
    };

    // ATTACH LISTENERS BEFORE SUBSCRIBING
    channel
      .on('presence', { event: 'sync' }, handleSync)
      .on('presence', { event: 'join' }, handleSync)
      .on('presence', { event: 'leave' }, handleSync)
      .on('broadcast', { event: 'game:start' }, ({ payload }) => {
        _onGameStarted?.(payload);
      })
      .on('broadcast', { event: 'game:next_round' }, () => {
        _onNextRound?.();
      })
      .on('broadcast', { event: 'game:reset' }, () => {
        _onGameReset?.();
      });

    return new Promise((resolve, reject) => {
      channel!
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel!.track(player);
            resolve(true);
          }
          if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            reject(new Error("Supabase signal timeout"));
          }
        });
    });
  },

  toggleReady(roomId: string, isReady: boolean) {
    if (channel && localPlayer) {
      localPlayer.isReady = isReady;
      channel.track(localPlayer);
    }
  },

  updateScore(roomId: string, correct: boolean, score: number) {
    if (channel && localPlayer) {
      localPlayer.score += score;
      localPlayer.hasAnswered = true;
      channel.track(localPlayer);
      
      // If correct, broadcast answer event if needed (optional)
      channel.send({
        type: 'broadcast',
        event: 'player:answered',
        payload: { playerId: localPlayer.id, correct }
      });
    }
  },

  startGameWithQuestions(roomId: string, questions: any[], roundCount: number) {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game:start',
        payload: { questions, roundCount }
      });
    }
  },

  resetRoom(roomId: string) {
    if (channel && localPlayer) {
      // Reset local player first
      localPlayer.score = 0;
      localPlayer.hasAnswered = false;
      localPlayer.isReady = false;
      channel.track(localPlayer);
      
      channel.send({
        type: 'broadcast',
        event: 'game:reset',
        payload: {}
      });
    }
  },

  nextRound(roomId: string) {
    if (channel && localPlayer) {
      localPlayer.hasAnswered = false;
      channel.track(localPlayer);

      channel.send({
        type: 'broadcast',
        event: 'game:next_round',
        payload: {}
      });
    }
  },

  leaveRoom() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  },

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: Player[]) => void,
    onRoomUpdate: (room: Room) => void,
    onRoundEnd?: () => void,
    onNextRound?: () => void,
    onGameReset?: () => void,
    onGameStarted?: (data: { questions: any[]; roundCount: number }) => void
  ) {
    if (!channel) return () => {};

    // Assign the callbacks provided by the React hook to our global variables
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;
    _onRoundEnd = onRoundEnd || null;
    _onNextRound = onNextRound || null;
    _onGameReset = onGameReset || null;
    _onGameStarted = onGameStarted || null;

    return () => {
      // Clear the callbacks when the component unmounts
      _onPlayersChange = null;
      _onRoomUpdate = null;
      _onRoundEnd = null;
      _onNextRound = null;
      _onGameReset = null;
      _onGameStarted = null;
    };
  },
};
