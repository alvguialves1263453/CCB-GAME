import { supabase } from "../lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";


export interface Player {
  id: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  hasAnswered: boolean;
  round: number;
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
let isGameStarted = false;
let discoveryChannel: RealtimeChannel | null = null;
let clientIp: string | null = null;

// Global callbacks to be assigned when React component mounts
let _onPlayersChange: ((players: Player[]) => void) | null = null;
let _onRoomUpdate: ((room: Room) => void) | null = null;
let _onRoundEnd: (() => void) | null = null;
let _onNextRound: ((round: number) => void) | null = null;
let _onGameReset: (() => void) | null = null;
let _onGameStarted: ((data: { questions: any[]; roundCount: number; difficulty: string }) => void) | null = null;
let _onPlayerAnswered: ((data: { playerId: string; correct: boolean; round: number }) => void) | null = null;
let _onNearbyRoomsChange: ((rooms: { id: string; hostName: string }[]) => void) | null = null;

const getClientIp = async () => {
  if (clientIp) return clientIp;
  const services = [
    'https://api64.ipify.org?format=json',
    'https://api.ipify.org?format=json',
    'https://ipapi.co/json/'
  ];

  for (const url of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      clientIp = data.ip || data.query;
      if (clientIp) return clientIp;
    } catch (e) {
      continue;
    }
  }
  return 'unknown';
};

const triggerSync = () => {
  if (!channel || !currentRoomId) return;
  const state = channel.presenceState();
  const uniquePlayers = new Map<string, Player>();
  
  Object.values(state).forEach((presences: any) => {
    presences.forEach((p: Player) => {
      uniquePlayers.set(p.id, p);
    });
  });

  const playersList = Array.from(uniquePlayers.values());
  const sortedPlayers = playersList.sort((a, b) => a.joinedAt - b.joinedAt);
  const host = sortedPlayers.find(p => p.isHost) || sortedPlayers[0];
  
  _onPlayersChange?.(sortedPlayers);
  
  const room: Room = {
    id: currentRoomId,
    hostId: host?.id || '',
    gameStarted: isGameStarted, 
    players: sortedPlayers,
    roundCount: 5
  };
  
  _onRoomUpdate?.(room);
};

export const multiplayerService = {
  async createRoom(nickname: string, avatar?: string): Promise<{ room: Room; player: Player } | null> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const player: Player = {
      id: Math.random().toString(36).substring(2, 10),
      nickname,
      avatar,
      isHost: true,
      isReady: false,
      score: 0,
      hasAnswered: false,
      round: 0,
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
      // Start broadcasting for discovery
      this.startDiscoveryBroadcast(roomId, player.nickname);
      return { room, player };
    } catch (error) {
      console.error("Error creating room:", error);
      return null;
    }
  },

  async joinRoom(roomId: string, nickname: string, avatar?: string): Promise<Player | null> {
    const player: Player = {
      id: Math.random().toString(36).substring(2, 10),
      nickname,
      avatar,
      isHost: false,
      isReady: false,
      score: 0,
      hasAnswered: false,
      round: 0,
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
        broadcast: { self: false },
      },
    });

    // ATTACH LISTENERS BEFORE SUBSCRIBING
    channel
      .on('presence', { event: 'sync' }, triggerSync)
      .on('presence', { event: 'join' }, triggerSync)
      .on('presence', { event: 'leave' }, triggerSync)
      .on('broadcast', { event: 'game:start' }, ({ payload }) => {
        isGameStarted = true;
        _onGameStarted?.(payload);
      })
      .on('broadcast', { event: 'game:next_round' }, ({ payload }) => {
        _onNextRound?.(payload?.round ?? 0);
      })
      .on('broadcast', { event: 'game:reset' }, () => {
        isGameStarted = false;
        _onGameReset?.();
      })
      .on('broadcast', { event: 'player:answered' }, ({ payload }) => {
        _onPlayerAnswered?.(payload);
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

  updateScore(roomId: string, correct: boolean, score: number, round: number) {
    if (channel && localPlayer) {
      localPlayer.score += score;
      localPlayer.hasAnswered = true;
      localPlayer.round = round;
      channel.track(localPlayer);
      
      // If correct, broadcast answer event if needed (optional)
      channel.send({
        type: 'broadcast',
        event: 'player:answered',
        payload: { playerId: localPlayer.id, correct, round }
      });
    }
  },

  startGameWithQuestions(roomId: string, questions: any[], roundCount: number, difficulty: string) {
    if (channel) {
      isGameStarted = true;
      // Stop broadcasting for discovery when game starts
      this.stopDiscoveryBroadcast();
      channel.send({
        type: 'broadcast',
        event: 'game:start',
        payload: { questions, roundCount, difficulty }
      });
    }
  },

  resetRoom(roomId: string) {
    if (channel && localPlayer) {
      isGameStarted = false;
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

  nextRound(roomId: string, nextRoundIndex: number) {
    if (channel && localPlayer) {
      this.resetPlayerRoundState(nextRoundIndex);

      channel.send({
        type: 'broadcast',
        event: 'game:next_round',
        payload: { round: nextRoundIndex }
      });
    }
  },

  resetPlayerRoundState(round: number) {
    if (channel && localPlayer) {
      localPlayer.hasAnswered = false;
      localPlayer.round = round;
      channel.track(localPlayer);
    }
  },

  leaveRoom() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    isGameStarted = false;
    currentRoomId = null;
    localPlayer = null;
    this.stopDiscoveryBroadcast();
  },

  async startDiscoveryBroadcast(roomId: string, hostName: string) {
    const ip = await getClientIp();
    if (discoveryChannel) {
       await supabase.removeChannel(discoveryChannel);
    }

    discoveryChannel = supabase.channel('lobby_discovery', {
      config: { 
        presence: { key: roomId },
        broadcast: { self: true }
      }
    });

    discoveryChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await discoveryChannel!.track({ roomId, hostName, ip, createdAt: Date.now(), isLobby: true });
      }
    });
  },

  stopDiscoveryBroadcast() {
    if (discoveryChannel) {
      supabase.removeChannel(discoveryChannel);
      discoveryChannel = null;
    }
  },

  async startDiscoveryListener(onNearbyRoomsChange: (rooms: { id: string; hostName: string }[]) => void) {
    _onNearbyRoomsChange = onNearbyRoomsChange;
    const myIp = await getClientIp();

    if (discoveryChannel) {
      await supabase.removeChannel(discoveryChannel);
    }

    discoveryChannel = supabase.channel('lobby_discovery', {
      config: { broadcast: { self: true } }
    });

    const updateNearbyList = () => {
      if (!discoveryChannel) return;
      const state = discoveryChannel.presenceState();
      const rooms: { id: string; hostName: string }[] = [];
      
      Object.values(state).forEach((presences: any) => {
        presences.forEach((p: any) => {
          // IP matching or fallback to 'unknown' if both fail
          const ipMatches = (p.ip === myIp && myIp !== 'unknown') || (p.ip === 'unknown' && myIp === 'unknown');
          
          if (p.isLobby && ipMatches && p.roomId && (Date.now() - (p.createdAt || 0) < 3600000)) {
            if (!rooms.find(r => r.id === p.roomId)) {
               rooms.push({ id: p.roomId, hostName: p.hostName });
            }
          }
        });
      });
      
      _onNearbyRoomsChange?.(rooms);
    };

    discoveryChannel
      .on('presence', { event: 'sync' }, updateNearbyList)
      .on('presence', { event: 'join' }, updateNearbyList)
      .on('presence', { event: 'leave' }, updateNearbyList)
      .subscribe();
  },

  stopDiscoveryListener() {
    this.stopDiscoveryBroadcast();
    _onNearbyRoomsChange = null;
  },

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: Player[]) => void,
    onRoomUpdate: (room: Room) => void,
    onRoundEnd?: () => void,
    onNextRound?: (round: number) => void,
    onGameReset?: () => void,
    onGameStarted?: (data: { questions: any[]; roundCount: number; difficulty: string }) => void,
    onPlayerAnswered?: (data: { playerId: string; correct: boolean; round: number }) => void
  ) {
    // Assign the callbacks provided by the React hook to our global variables
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;
    _onRoundEnd = onRoundEnd || null;
    _onNextRound = onNextRound || null;
    _onGameReset = onGameReset || null;
    _onGameStarted = onGameStarted || null;
    _onPlayerAnswered = onPlayerAnswered || null;

    // If channel is already present (e.g. view changed), trigger sync immediately
    // to populate UI with the current presence state.
    if (channel && currentRoomId === roomId) {
       triggerSync();
    }

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
