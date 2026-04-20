import { supabase } from "../lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface BibliaPlayer {
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

export interface BibliaRoom {
  id: string;
  hostId: string;
  phase: 'lobby' | 'preparing' | 'answering' | 'result' | 'ranking';
  currentRound: number;
  roundCount: number;
  difficulty: string;
  currentPergunta: string | null;
  deadlineAt: number | null;
  questions?: any[];
}

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let localPlayerId: string | null = null;

let _isSubscribed = false;
let _lastPlayerSnapshot: Set<string> = new Set();
let _onPlayersChange: ((players: BibliaPlayer[]) => void) | null = null;
let _onRoomUpdate: ((room: BibliaRoom) => void) | null = null;

const mapRoom = (row: any): BibliaRoom => ({
  id: row.id,
  hostId: row.host_id,
  phase: row.phase,
  currentRound: row.current_round,
  roundCount: row.round_count,
  difficulty: row.difficulty,
  currentPergunta: row.current_pergunta,
  deadlineAt: row.deadline_at ? Number(row.deadline_at) : null,
  questions: row.questions,
});

const mapPlayer = (row: any): BibliaPlayer => ({
  id: row.id,
  nickname: row.nickname,
  avatar: row.avatar,
  isHost: row.is_host,
  isReady: row.is_ready,
  score: row.score,
  hasAnswered: row.has_answered,
  round: row.round,
  joinedAt: row.joined_at ? Number(row.joined_at) : 0,
});

const refreshPlayers = async (roomId: string) => {
  const { data } = await supabase.from('biblia_players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
  if (data) {
    _lastPlayerSnapshot = new Set(data.map(p => p.id));
    _onPlayersChange?.(data.map(mapPlayer));
  }
};

const refreshRoom = async (roomId: string) => {
  const { data } = await supabase.from('biblia_rooms').select('*').eq('id', roomId).single();
  if (data) {
    _onRoomUpdate?.(mapRoom(data));
  }
};

export const bibliaService = {
  async createRoom(nickname: string, avatar?: string, difficulty: string = 'facil', roundCount: number = 5): Promise<{ room: BibliaRoom; player: BibliaPlayer } | null> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const playerId = Math.random().toString(36).substring(2, 10);
    const joinedAt = Date.now();

    const { data: roomData, error: roomError } = await supabase.from('biblia_rooms').insert({
      id: roomId,
      host_id: playerId,
      phase: 'lobby',
      current_round: 0,
      round_count: roundCount,
      difficulty: difficulty
    }).select().single();

    if (roomError) {
      console.error("Error creating biblia room:", roomError);
      return null;
    }

    const { data: playerData, error: playerError } = await supabase.from('biblia_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: true,
      is_ready: false,
      score: 0,
      has_answered: false,
      round: 0,
      joined_at: joinedAt
    }).select().single();

    if (playerError) {
      console.error("Error creating biblia player:", playerError);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return { room: mapRoom(roomData), player: mapPlayer(playerData) };
  },

  async joinRoom(roomId: string, nickname: string, avatar?: string): Promise<BibliaPlayer | null> {
    roomId = roomId.toUpperCase();
    const playerId = Math.random().toString(36).substring(2, 10);
    
    const { data, error } = await supabase.from('biblia_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: false,
      is_ready: false,
      score: 0,
      has_answered: false,
      round: 0,
      joined_at: Date.now()
    }).select().single();

    if (error) {
      console.error("Error joining biblia room:", error);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return mapPlayer(data);
  },

  async initChannel(roomId: string, playerId: string) {
    if (channel) {
      await supabase.removeChannel(channel);
    }

    currentRoomId = roomId;
    localPlayerId = playerId;
    _isSubscribed = false;
    
    channel = supabase.channel(`biblia_room_db:${roomId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'biblia_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (!payload.new) {
          _onRoomUpdate?.(null as any);
          return;
        }
        _onRoomUpdate?.(mapRoom(payload.new));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'biblia_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'biblia_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'biblia_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      });

    await new Promise((resolve) => {
      channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          _isSubscribed = true;
          resolve(true);
        }
      });
    });

    await refreshRoom(roomId);
    await refreshPlayers(roomId);
  },

  async toggleReady(roomId: string, isReady: boolean) {
    if (localPlayerId) {
      await supabase.from('biblia_players').update({ is_ready: isReady }).eq('id', localPlayerId);
    }
  },

  async submitAnswer(roomId: string, correct: boolean, score: number, round: number) {
    if (localPlayerId) {
      const { data } = await supabase.from('biblia_players').select('score').eq('id', localPlayerId).single();
      const currentScore = data?.score || 0;

      await supabase.from('biblia_players').update({
        has_answered: true,
        score: currentScore + score,
        round: round
      }).eq('id', localPlayerId);
    }
  },

  async startGame(roomId: string, perguntas: any[], roundCount: number, difficulty: string) {
    await supabase.from('biblia_rooms').update({
      phase: 'preparing',
      questions: perguntas,
      round_count: roundCount,
      difficulty: difficulty,
      current_round: 0,
      deadline_at: Date.now() + 3000
    }).eq('id', roomId);
  },

  async touchRoom(roomId: string) {
    await supabase.from('biblia_rooms').update({ updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  async startRound(roomId: string, roundIndex: number, timeLimitSec: number, pergunta: string) {
    await supabase.from('biblia_players').update({ has_answered: false, round: roundIndex }).eq('room_id', roomId);

    await supabase.from('biblia_rooms').update({
      phase: 'answering',
      current_round: roundIndex,
      current_pergunta: pergunta,
      deadline_at: timeLimitSec === Infinity ? null : Date.now() + (timeLimitSec * 1000)
    }).eq('id', roomId);
  },

  async endRound(roomId: string) {
    await supabase.from('biblia_rooms').update({
      phase: 'result',
      deadline_at: Date.now() + 4000
    }).eq('id', roomId);
  },

  async finishGame(roomId: string) {
    await supabase.from('biblia_rooms').update({
      phase: 'ranking',
      deadline_at: null
    }).eq('id', roomId);
  },

  async resetRoom(roomId: string) {
    await supabase.from('biblia_players').update({
      score: 0,
      has_answered: false,
      is_ready: false,
      round: 0
    }).eq('room_id', roomId);

    await supabase.from('biblia_rooms').update({
      phase: 'lobby',
      current_round: 0,
      deadline_at: null
    }).eq('id', roomId);
  },

  async deleteRoom(roomId: string) {
    await supabase.from('biblia_players').delete().eq('room_id', roomId);
    await supabase.from('biblia_rooms').delete().eq('id', roomId);
  },

  async leaveRoom() {
    const playerIdToRemove = localPlayerId;
    const roomIdToLeave = currentRoomId;
    
    currentRoomId = null;
    localPlayerId = null;
    _lastPlayerSnapshot.clear();
    _isSubscribed = false;
    
    if (playerIdToRemove && roomIdToLeave) {
      await supabase.from('biblia_players').delete().eq('id', playerIdToRemove);
    }
    
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
  },

  async startDiscoveryListener(onNearbyRoomsChange: (rooms: { id: string; hostName: string; difficulty?: string; roundCount: number }[]) => void) {
    const fetchLobbies = async () => {
      const { data } = await supabase.from('biblia_rooms').select('id, round_count, difficulty').eq('phase', 'lobby');
      
      const allRooms: { id: string; hostName: string; difficulty?: string; roundCount: number }[] = [];
      
      if (data) {
        for (const r of data) {
          const { data: players } = await supabase.from('biblia_players').select('nickname, avatar').eq('room_id', r.id).eq('is_host', true).limit(1);
          allRooms.push({
            id: r.id,
            hostName: players?.[0]?.nickname || 'Host',
            difficulty: r.difficulty || 'facil',
            roundCount: r.round_count || 5
          });
        }
      }
      
      onNearbyRoomsChange(allRooms);
    };
    
    fetchLobbies();
    
    const channel = supabase.channel('biblia_lobby_discovery_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'biblia_rooms' }, () => {
         fetchLobbies();
      })
      .subscribe();
      
    (this as any)._discoveryChannel = channel;
  },

  stopDiscoveryListener() {
    if ((this as any)._discoveryChannel) {
      supabase.removeChannel((this as any)._discoveryChannel);
      (this as any)._discoveryChannel = null;
    }
  },

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: BibliaPlayer[]) => void,
    onRoomUpdate: (room: BibliaRoom) => void
  ) {
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;

    if (channel && currentRoomId === roomId) {
      refreshRoom(roomId);
      refreshPlayers(roomId);
    }

    return () => {
      _onPlayersChange = null;
      _onRoomUpdate = null;
    };
  },

  getCurrentRoomId() {
    return currentRoomId;
  },

  getLocalPlayerId() {
    return localPlayerId;
  },

  async getRoom(roomId: string): Promise<BibliaRoom | null> {
    const { data } = await supabase.from('biblia_rooms').select('*').eq('id', roomId).single();
    return data ? mapRoom(data) : null;
  },

  async getRoomPlayers(roomId: string): Promise<BibliaPlayer[]> {
    const { data } = await supabase.from('biblia_players').select('*').eq('room_id', roomId).order('score', { ascending: false });
    return data?.map(mapPlayer) || [];
  },

  isHost(): boolean {
    return localPlayerId !== null;
  }
};