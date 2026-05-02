import { supabase } from "../lib/supabase";

let currentRoomId: string | null = null;
let localPlayerId: string | null = null;
let _onPlayersChange: ((players: any[]) => void) | null = null;
let _onRoomUpdate: ((room: any) => void) | null = null;
let channel: any = null;

export const drawingService = {
  async createRoom(nickname: string, avatar: string, roundCount: number, category: string) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    
    const playerId = Math.random().toString(36).substring(2, 10);
    
    const { data: roomData, error: roomError } = await supabase.from('rooms').insert({
      id: roomId,
      host_id: playerId,
      phase: 'lobby',
      current_round: 0,
      round_count: roundCount,
      difficulty: category,
      game_type: 'desenho'
    }).select().single();

    if (roomError) {
      console.error("Room creation error:", roomError);
      return null;
    }

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
      joined_at: Date.now()
    }).select().single();

    if (playerError) {
      console.error("Player creation error:", playerError);
      return null;
    }

    currentRoomId = roomId;
    localPlayerId = playerId;
    
    return { roomId, playerId };
  },

  async joinRoom(roomId: string, nickname: string, avatar: string) {
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

    if (error) return null;

    currentRoomId = roomId;
    localPlayerId = playerId;
    
    return { roomId, playerId };
  },

  subscribeToRoom(roomId: string, onPlayersChange: (players: any[]) => void, onRoomUpdate: (room: any) => void) {
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;

    if (channel) {
      supabase.removeChannel(channel);
    }

    channel = supabase.channel(`drawing_room_db:${roomId}`);
    
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload: any) => {
        if (!payload.new) return;
        const mappedRoom = {
          id: payload.new.id,
          phase: payload.new.phase,
          currentRound: payload.new.current_round,
          roundCount: payload.new.round_count,
          category: payload.new.difficulty,
          deadline_at: payload.new.deadline_at,
        };
        console.log('[DrawingService] Room update received:', mappedRoom);
        _onRoomUpdate?.(mappedRoom);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
        this.refreshPlayers(roomId);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[DrawingService] Subscribed to room updates');
          await this.refreshRoom(roomId);
          await this.refreshPlayers(roomId);
        }
      });

    return () => {
      _onPlayersChange = null;
      _onRoomUpdate = null;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
  },

  async refreshRoom(roomId: string) {
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (error) console.error('[DrawingService] Error refreshing room:', error);
    if (data && _onRoomUpdate) {
      const mappedRoom = {
        id: data.id,
        phase: data.phase,
        currentRound: data.current_round,
        roundCount: data.round_count,
        category: data.difficulty,
        deadline_at: data.deadline_at,
      };
      console.log('[DrawingService] Initial room state:', mappedRoom);
      _onRoomUpdate(mappedRoom);
    }
  },

  async refreshPlayers(roomId: string) {
    const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
    if (data && _onPlayersChange) {
      _onPlayersChange(data.map(row => ({
        id: row.id,
        nickname: row.nickname,
        avatar: row.avatar,
        isHost: row.is_host,
        isReady: row.is_ready,
        totalScore: row.score || 0
      })));
    }
  },

  async toggleReady(roomId: string, isReady: boolean) {
    if (localPlayerId) {
      await supabase.from('players').update({ is_ready: isReady }).eq('id', localPlayerId);
    }
  },

  async startDrawingGame(roomId: string, roundCount: number) {
    await supabase.from('rooms').update({
      phase: 'drawing',
      round_count: roundCount,
      current_round: 1
    }).eq('id', roomId);
  },

  async getRoom(roomId: string) {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    return data;
  },

  async leaveRoom() {
    if (localPlayerId && currentRoomId) {
      // Check if host
      const { data: player } = await supabase.from('players').select('is_host').eq('id', localPlayerId).single();
      
      if (player?.is_host) {
        // Host leaving -> destroy room
        await this.deleteRoomWithKeepalive(currentRoomId);
      } else {
        // Just player leaving
        await supabase.from('players').delete().eq('id', localPlayerId);
      }
    }
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    currentRoomId = null;
    localPlayerId = null;
  },
  
  async deleteRoomWithKeepalive(roomId: string) {
    // Use SDK for normal operation
    await supabase.from('players').delete().eq('room_id', roomId);
    await supabase.from('rooms').delete().eq('id', roomId);
    
    // Fallback: also try fetch with keepalive in case SDK fails (e.g. tab closed)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (supabaseUrl && apikey) {
      const headers = {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`,
        'Content-Type': 'application/json'
      };
      fetch(`${supabaseUrl}/rest/v1/players?room_id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
      fetch(`${supabaseUrl}/rest/v1/rooms?id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
    }
  },
  
  async submitDrawing() {},
  async submitVote() {},
  async updateDrawingIndex() {},
  async moveToVoting() {},
  async revealDrawing() {},
  async calculateRoundScores() {},
  async nextRound() {},
  async getFinalRanking() { return []; },
  async getRoomSubmissions() { return []; },
  async getSubmissionVotes() { return []; }
};