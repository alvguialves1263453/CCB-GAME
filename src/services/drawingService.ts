import { supabase } from "../lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface DrawingPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
  isReady: boolean;
  totalScore: number;
  roundScores: number[];
}

export interface DrawingRoom {
  id: string;
  hostId: string;
  phase: 'lobby' | 'drawing' | 'voting' | 'reveal' | 'ranking';
  currentRound: number;
  roundCount: number;
  currentPrompt: string;
  currentDrawingIndex: number;
  deadlineAt: number | null;
}

export interface DrawingSubmission {
  id: number;
  roomId: string;
  playerId: string;
  playerNickname: string;
  round: number;
  drawingData: string;
  submittedAt: Date;
}

export interface DrawingVote {
  id: number;
  submissionId: number;
  voterId: string;
  stars: number;
  votedAt: Date;
}

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let localPlayerId: string | null = null;

let _onPlayersChange: ((players: DrawingPlayer[]) => void) | null = null;
let _onRoomUpdate: ((room: Partial<DrawingRoom>) => void) | null = null;
let _onSubmissionReceived: ((submission: DrawingSubmission) => void) | null = null;
let _onVoteUpdate: ((votes: DrawingVote[]) => void) | null = null;
let _drawingRoomRef: Partial<DrawingRoom> | null = null;

const DRAW_TIME = 60;
const VOTE_TIME = 5;
const REVEAL_TIME = 3;

const mapPlayer = (row: any): DrawingPlayer => ({
  id: row.id,
  nickname: row.nickname,
  avatar: row.avatar,
  isHost: row.is_host,
  isReady: row.is_ready,
  totalScore: row.total_score || 0,
  roundScores: row.round_scores || [],
});

const mapRoom = (row: any): Partial<DrawingRoom> => ({
  id: row.id,
  hostId: row.host_id,
  phase: row.phase,
  currentRound: row.current_round,
  roundCount: row.round_count,
  currentPrompt: row.current_prompt,
  currentDrawingIndex: row.current_drawing_index,
  deadlineAt: row.deadline_at ? Number(row.deadline_at) : null,
});

const refreshPlayers = async (roomId: string) => {
  const { data } = await supabase.from('drawing_players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
  if (data) {
    _onPlayersChange?.(data.map(mapPlayer));
  }
};

const refreshRoom = async (roomId: string) => {
  const { data } = await supabase.from('drawing_rooms').select('*').eq('id', roomId).single();
  if (data) {
    _drawingRoomRef = mapRoom(data);
    _onRoomUpdate?.(mapRoom(data));
  }
};

const getSubmissions = async (roomId: string, round: number) => {
  const { data } = await supabase.from('drawing_submissions').select('*').eq('room_id', roomId).eq('round', round);
  return data || [];
};

const getVotes = async (submissionId: number) => {
  const { data } = await supabase.from('drawing_votes').select('*').eq('submission_id', submissionId);
  return data || [];
};

export const drawingService = {
  async createRoom(nickname: string, avatar?: string, roundCount: number = 3): Promise<{ roomId: string; playerId: string } | null> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const playerId = Math.random().toString(36).substring(2, 10);
    const joinedAt = Date.now();

    const { error: roomError } = await supabase.from('drawing_rooms').insert({
      id: roomId,
      host_id: playerId,
      phase: 'lobby',
      current_round: 0,
      round_count: roundCount,
    });

    if (roomError) {
      console.error("Error creating drawing room:", roomError);
      return null;
    }

    const { error: playerError } = await supabase.from('drawing_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: true,
      is_ready: false,
      total_score: 0,
      round_scores: [],
      joined_at: joinedAt
    });

    if (playerError) {
      console.error("Error creating drawing player:", playerError);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return { roomId, playerId };
  },

  async joinRoom(roomId: string, nickname: string, avatar?: string): Promise<string | null> {
    roomId = roomId.toUpperCase();
    const playerId = Math.random().toString(36).substring(2, 10);
    
    const { error } = await supabase.from('drawing_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: false,
      is_ready: false,
      total_score: 0,
      round_scores: [],
      joined_at: Date.now()
    });

    if (error) {
      console.error("Error joining drawing room:", error);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return playerId;
  },

  async initChannel(roomId: string, playerId: string) {
    if (channel) {
      await supabase.removeChannel(channel);
    }

    currentRoomId = roomId;
    localPlayerId = playerId;
    
    channel = supabase.channel(`drawing_room_db:${roomId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawing_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (!payload.new) {
          _onRoomUpdate?.(null as any);
          return;
        }
        _drawingRoomRef = mapRoom(payload.new);
        _onRoomUpdate?.(mapRoom(payload.new));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'drawing_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drawing_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drawing_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drawing_submissions', filter: `room_id=eq.${roomId}` }, (payload) => {
        _onSubmissionReceived?.({
          id: payload.new.id,
          roomId: payload.new.room_id,
          playerId: payload.new.player_id,
          playerNickname: payload.new.player_nickname,
          round: payload.new.round,
          drawingData: payload.new.drawing_data,
          submittedAt: new Date(payload.new.submitted_at),
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drawing_votes' }, (payload) => {
        const submissionId = payload.new.submission_id;
        getVotes(submissionId).then(votes => {
          _onVoteUpdate?.(votes);
        });
      });

    await new Promise((resolve) => {
      channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve(true);
        }
      });
    });

    await refreshRoom(roomId);
    await refreshPlayers(roomId);
  },

  async toggleReady(roomId: string, isReady: boolean) {
    if (localPlayerId) {
      await supabase.from('drawing_players').update({ is_ready: isReady }).eq('id', localPlayerId);
    }
  },

  async submitDrawing(roomId: string, drawingData: string) {
    if (!localPlayerId) return;

    const { data: player } = await supabase.from('drawing_players').select('nickname').eq('id', localPlayerId).single();
    const nickname = player?.nickname || 'Player';

    const { data: room } = await supabase.from('drawing_rooms').select('current_round').eq('id', roomId).single();
    const round = room?.current_round || 0;

    await supabase.from('drawing_submissions').insert({
      room_id: roomId,
      player_id: localPlayerId,
      player_nickname: nickname,
      round: round,
      drawing_data: drawingData,
    });
  },

  async submitVote(submissionId: number, stars: number) {
    if (!localPlayerId) return;

    const { data: existing } = await supabase.from('drawing_votes')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('voter_id', localPlayerId)
      .single();

    if (existing) {
      await supabase.from('drawing_votes').update({ stars }).eq('id', existing.id);
    } else {
      await supabase.from('drawing_votes').insert({
        submission_id: submissionId,
        voter_id: localPlayerId!,
        stars,
      });
    }
  },

  async startDrawingGame(roomId: string, roundCount: number) {
    const { data: prompts } = await supabase.from('drawing_prompts').select('prompt').order('random()').limit(1);
    const prompt = prompts?.[0]?.prompt || 'Desenhe algo';

    await supabase.from('drawing_rooms').update({
      phase: 'drawing',
      current_round: 1,
      round_count: roundCount,
      current_prompt: prompt,
      current_drawing_index: 0,
      deadline_at: Date.now() + (DRAW_TIME * 1000)
    }).eq('id', roomId);
  },

  async updateDrawingIndex(roomId: string, index: number) {
    await supabase.from('drawing_rooms').update({
      current_drawing_index: index,
      deadline_at: Date.now() + (DRAW_TIME * 1000)
    }).eq('id', roomId);
  },

  async moveToVoting(roomId: string) {
    await supabase.from('drawing_rooms').update({
      phase: 'voting',
      current_drawing_index: 0,
      deadline_at: Date.now() + (VOTE_TIME * 1000)
    }).eq('id', roomId);
  },

  async revealDrawing(roomId: string) {
    await supabase.from('drawing_rooms').update({
      phase: 'reveal',
      current_drawing_index: 0,
      deadline_at: Date.now() + (REVEAL_TIME * 1000)
    }).eq('id', roomId);
  },

  async calculateRoundScores(roomId: string, round: number) {
    const submissions = await getSubmissions(roomId, round);
    
    for (const sub of submissions) {
      const votes = await getVotes(sub.id);
      const totalStars = votes.reduce((sum, v) => sum + v.stars, 0);
      const avgStars = votes.length > 0 ? totalStars / votes.length : 0;
      const score = Math.round(avgStars * 100);
      
      const { data: player } = await supabase.from('drawing_players').select('total_score', 'round_scores').eq('id', sub.player_id).single();
      const currentScore = player?.total_score || 0;
      const currentRoundScores = player?.round_scores || [];
      
      await supabase.from('drawing_players').update({
        total_score: currentScore + score,
        round_scores: [...currentRoundScores, score]
      }).eq('id', sub.player_id);
    }
  },

  async nextRound(roomId: string) {
    const { data: room } = await supabase.from('drawing_rooms').select('*').eq('id', roomId).single();
    if (!room) return;

    const nextRound = (room.current_round || 0) + 1;
    
    if (nextRound > room.round_count) {
      await supabase.from('drawing_rooms').update({
        phase: 'ranking',
        deadline_at: null
      }).eq('id', roomId);
    } else {
      const { data: prompts } = await supabase.from('drawing_prompts').select('prompt').order('random()').limit(1);
      const prompt = prompts?.[0]?.prompt || 'Desenhe algo';

      await supabase.from('drawing_rooms').update({
        phase: 'drawing',
        current_round: nextRound,
        current_prompt: prompt,
        current_drawing_index: 0,
        deadline_at: Date.now() + (DRAW_TIME * 1000)
      }).eq('id', roomId);
    }
  },

  async getFinalRanking(roomId: string) {
    const { data } = await supabase.from('drawing_players')
      .select('*')
      .eq('room_id', roomId)
      .order('total_score', { ascending: false });
    
    return data || [];
  },

  async getRoomSubmissions(roomId: string, round: number) {
    return getSubmissions(roomId, round);
  },

  async getSubmissionVotes(submissionId: number) {
    return getVotes(submissionId);
  },

  async leaveRoom() {
    if (localPlayerId && currentRoomId) {
      await supabase.from('drawing_players').delete().eq('id', localPlayerId);
    }
    
    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
    
    currentRoomId = null;
    localPlayerId = null;
  },

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: DrawingPlayer[]) => void,
    onRoomUpdate: (room: Partial<DrawingRoom>) => void,
    onSubmissionReceived?: (submission: DrawingSubmission) => void,
    onVoteUpdate?: (votes: DrawingVote[]) => void
  ) {
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;
    _onSubmissionReceived = onSubmissionReceived || null;
    _onVoteUpdate = onVoteUpdate || null;

    if (channel && currentRoomId === roomId) {
      refreshRoom(roomId);
      refreshPlayers(roomId);
    }

    return () => {
      _onPlayersChange = null;
      _onRoomUpdate = null;
      _onSubmissionReceived = null;
      _onVoteUpdate = null;
    };
  },

  getCurrentRoomId() {
    return currentRoomId;
  },

  getLocalPlayerId() {
    return localPlayerId;
  },

  isHost(): boolean {
    return _drawingRoomRef?.hostId === localPlayerId;
  },

  async deleteRoom(roomId: string) {
    await supabase.from('drawing_submissions').delete().eq('room_id', roomId);
    await supabase.from('drawing_players').delete().eq('room_id', roomId);
    await supabase.from('drawing_rooms').delete().eq('id', roomId);
  },

  async startDiscoveryListener(onNearbyRoomsChange: (rooms: { id: string; hostName: string }[]) => void) {
    const fetchLobbies = async () => {
      const { data } = await supabase.from('drawing_rooms')
        .select('id, round_count')
        .eq('phase', 'lobby');
      
      if (data && data.length > 0) {
        const formatted = await Promise.all(data.map(async (r: any) => {
          const { data: players } = await supabase.from('drawing_players')
            .select('nickname, avatar')
            .eq('room_id', r.id)
            .eq('is_host', true)
            .limit(1);
          
          return {
            id: r.id,
            hostName: players?.[0]?.nickname || 'Host',
            roundCount: r.round_count || 3
          };
        }));
        onNearbyRoomsChange(formatted);
      } else {
        onNearbyRoomsChange([]);
      }
    };
    
    fetchLobbies();
    
    const channel = supabase.channel('drawing_lobby_discovery_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drawing_rooms' }, () => {
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
};