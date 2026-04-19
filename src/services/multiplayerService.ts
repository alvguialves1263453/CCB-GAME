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
  phase: 'lobby' | 'preparing' | 'answering' | 'result' | 'ranking';
  currentRound: number;
  roundCount: number;
  difficulty: string;
  deadlineAt: number | null;
  questions?: any[];
}

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let localPlayerId: string | null = null;

// Track subscription state to prevent stale events
let _isSubscribed = false;
let _lastPlayerSnapshot: Set<string> = new Set();
let _currentRefreshId = 0;
let _refreshTimeout: NodeJS.Timeout | null = null;

let _onPlayersChange: ((players: Player[]) => void) | null = null;
let _onRoomUpdate: ((room: Room) => void) | null = null;

const mapRoom = (row: any): Room => ({
  id: row.id,
  hostId: row.host_id,
  phase: row.phase,
  currentRound: row.current_round,
  roundCount: row.round_count,
  difficulty: row.difficulty,
  deadlineAt: row.deadline_at ? Number(row.deadline_at) : null,
  questions: row.questions,
});

const mapPlayer = (row: any): Player => ({
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
  const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
  if (data) {
    _lastPlayerSnapshot = new Set(data.map(p => p.id));
    _onPlayersChange?.(data.map(mapPlayer));
  }
};

const refreshRoom = async (roomId: string) => {
  const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (data) {
    _onRoomUpdate?.(mapRoom(data));
  }
};

export const multiplayerService = {
  async createRoom(nickname: string, avatar?: string): Promise<{ room: Room; player: Player } | null> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const playerId = Math.random().toString(36).substring(2, 10);
    const joinedAt = Date.now();

    // Insert Room
    const { data: roomData, error: roomError } = await supabase.from('rooms').insert({
      id: roomId,
      host_id: playerId,
      phase: 'lobby',
      current_round: 0,
      round_count: 5,
      difficulty: 'facil'
    }).select().single();

    if (roomError) {
      console.error("Error creating room DB:", roomError);
      return null;
    }

    // Insert Player
    const { data: playerData, error: playerError } = await supabase.from('players').insert({
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
      console.error("Error creating player DB:", playerError);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return { room: mapRoom(roomData), player: mapPlayer(playerData) };
  },

  async joinRoom(roomId: string, nickname: string, avatar?: string): Promise<Player | null> {
    roomId = roomId.toUpperCase();
    const playerId = Math.random().toString(36).substring(2, 10);
    
    const { data, error } = await supabase.from('players').insert({
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
      console.error("Error joining room DB:", error);
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
    
    channel = supabase.channel(`room_db:${roomId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        // Handle room deletion (when room no longer exists)
        if (!payload.new) {
          _onRoomUpdate?.(null as any);
          return;
        }
        _onRoomUpdate?.(mapRoom(payload.new));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, (payload) => {
        // Handle DELETE - refresh will get the actual current list
        // We can't access payload.old.id reliably, so just refresh
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
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

    // Initial fetch after confirmed subscription
    await refreshRoom(roomId);
    await refreshPlayers(roomId);
  },

  async toggleReady(roomId: string, isReady: boolean) {
    if (localPlayerId) {
      await supabase.from('players').update({ is_ready: isReady }).eq('id', localPlayerId);
    }
  },

  async submitAnswer(roomId: string, correct: boolean, score: number, round: number) {
    if (localPlayerId) {
      // We must fetch the current score first, or do an RPC. For simplicity, since it's a quiz, 
      // we can read it from the local state array if needed, but it's safer to read from DB.
      const { data } = await supabase.from('players').select('score').eq('id', localPlayerId).single();
      const currentScore = data?.score || 0;

      await supabase.from('players').update({
        has_answered: true,
        score: currentScore + score,
        round: round
      }).eq('id', localPlayerId);
    }
  },

  // Host Actions
  async startGame(roomId: string, questions: any[], roundCount: number, difficulty: string) {
    await supabase.from('rooms').update({
      phase: 'preparing',
      questions: questions,
      round_count: roundCount,
      difficulty: difficulty,
      current_round: 0,
      deadline_at: Date.now() + 3000 // 3 seconds preparing
    }).eq('id', roomId);
  },

  async touchRoom(roomId: string) {
    // Heartbeat: update updated_at so we know the room is alive
    await supabase.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', roomId);
  },

  async startRound(roomId: string, roundIndex: number, timeLimitSec: number) {
    // Reset all players has_answered for this room
    await supabase.from('players').update({ has_answered: false, round: roundIndex }).eq('room_id', roomId);

    await supabase.from('rooms').update({
      phase: 'answering',
      current_round: roundIndex,
      deadline_at: timeLimitSec === Infinity ? null : Date.now() + (timeLimitSec * 1000)
    }).eq('id', roomId);
  },

  async endRound(roomId: string) {
    await supabase.from('rooms').update({
      phase: 'result',
      deadline_at: Date.now() + 4000 // 4 seconds showing results
    }).eq('id', roomId);
  },

  async finishGame(roomId: string) {
    await supabase.from('rooms').update({
      phase: 'ranking',
      deadline_at: null
    }).eq('id', roomId);
  },

  async resetRoom(roomId: string) {
    // Reset players
    await supabase.from('players').update({
      score: 0,
      has_answered: false,
      is_ready: false,
      round: 0
    }).eq('room_id', roomId);

    // Reset room
    await supabase.from('rooms').update({
      phase: 'lobby',
      current_round: 0,
      deadline_at: null
    }).eq('id', roomId);
  },

  async deleteRoom(roomId: string) {
    // Note: If you have foreign keys set to CASCADE on 'players', deleting the room is enough.
    // Otherwise, we delete players first.
    await supabase.from('players').delete().eq('room_id', roomId);
    await supabase.from('rooms').delete().eq('id', roomId);
  },

  async leaveRoom() {
    const playerIdToRemove = localPlayerId;
    const roomIdToLeave = currentRoomId;
    
    // Clear local state first to prevent new events being processed
    currentRoomId = null;
    localPlayerId = null;
    _lastPlayerSnapshot.clear();
    _isSubscribed = false;
    
    // Delete from database
    if (playerIdToRemove && roomIdToLeave) {
      await supabase.from('players').delete().eq('id', playerIdToRemove);
    }
    
    // Remove channel after database operation completes
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
  },

  // Discovery (Keeping it simple for nearby rooms, could use a 'lobbies' view)
  async startDiscoveryListener(onNearbyRoomsChange: (rooms: { id: string; hostName: string }[]) => void) {
    const fetchLobbies = async () => {
      // Cleanup 1: Remove rooms stuck in lobby for 15+ min
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
      await supabase.from('rooms').delete().eq('phase', 'lobby').lt('created_at', fifteenMinsAgo);

      // Cleanup 2: Remove ANY room with no heartbeat for 3+ minutes (stale/ghost rooms)
      const threeMinsAgo = new Date(Date.now() - 3 * 60000).toISOString();
      await supabase.from('rooms').delete().lt('updated_at', threeMinsAgo).not('phase', 'eq', 'ranking');

      const { data } = await supabase.from('rooms').select('id, players(nickname)').eq('phase', 'lobby');
      if (data) {
         const formatted = data.map((r: any) => ({ id: r.id, hostName: r.players?.[0]?.nickname || 'Host' }));
         onNearbyRoomsChange(formatted);
      }
    };
    
    fetchLobbies();
    
    const channel = supabase.channel('lobby_discovery_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
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
    onPlayersChange: (players: Player[]) => void,
    onRoomUpdate: (room: Room) => void
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

  deleteRoomWithKeepalive(roomId: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !apikey) return;

    const headers = {
      'apikey': apikey,
      'Authorization': `Bearer ${apikey}`,
      'Content-Type': 'application/json'
    };

    // Delete players first, then room. keepalive ensures requests fire even when tab is closing.
    fetch(`${supabaseUrl}/rest/v1/players?room_id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
    fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
  }
};
