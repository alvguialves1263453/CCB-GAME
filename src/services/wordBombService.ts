import { supabase } from "../lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface WBPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
  lives: number;
  isAlive: boolean;
  score: number;
  turnOrder: number;
  joinedAt: number;
}

export interface WBRoom {
  id: string;
  hostId: string;
  phase: 'lobby' | 'playing' | 'finished';
  lives: number;
  turnDuration: number;
  currentTurnIndex: number;
  currentFragment: string | null;
  currentWord: string | null;
  turnStartedAt: number | null;
}

export interface WBFragment {
  text: string;
  hint: string;
}

let channel: RealtimeChannel | null = null;
let currentRoomId: string | null = null;
let localPlayerId: string | null = null;

let _isSubscribed = false;
let _lastPlayerSnapshot: Set<string> = new Set();
let _onPlayersChange: ((players: WBPlayer[]) => void) | null = null;
let _onRoomUpdate: ((room: WBRoom) => void) | null = null;
let _onTypingUpdate: ((playerId: string, text: string) => void) | null = null;
let _onNotification: ((message: string, type: 'leave' | 'host_left') => void) | null = null;

let WORDS: string[] = [];
let _availableWords: string[] = [];
let _validFragments: { text: string; words: string[] }[] = [];
let _initPromise: Promise<void> | null = null;

function normalizeText(s: string): string {
  const accentMap: Record<string, string> = {
    à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a',
    è: 'e', é: 'e', ê: 'e', ë: 'e',
    ì: 'i', í: 'i', î: 'i', ï: 'i',
    ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
    ù: 'u', ú: 'u', û: 'u', ü: 'u',
    ç: 'c', ñ: 'n',
  };
  return s.toLowerCase().split('').map(c => accentMap[c] || c).join('');
}

export async function initWords(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      const resp = await fetch('/br-sem-acentos.txt');
      const text = await resp.text();
      const raw = text.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => w.length > 1);
      WORDS = [...new Set(raw)];
      _availableWords = shuffleArray([...WORDS]);
      buildFragments();
    } catch (e) {
      console.error("Failed to load br-sem-acentos.txt, using fallback list", e);
      WORDS = [
        "amor","fe","paz","graça","cristo","jesus","senhor","deus","espirito",
        "santo","biblia","igreja","oracao","louvor","adoracao","milagre",
        "alegria","esperanca","verdade","luz","vida","caminho","ceu","terra",
        "mar","sol","lua","cruz","poder","gloria","fogo","agua","vento",
        "cachorro","gato","casa","livro","falar","cantar","correr","andar",
      ];
      _availableWords = shuffleArray([...WORDS]);
      buildFragments();
    }
  })();
  return _initPromise;
}

function buildFragments(): void {
  const temp = new Map<string, Set<string>>();
  const normWords = WORDS.map(w => normalizeText(w));
  for (const word of normWords) {
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i <= word.length - len; i++) {
        const frag = word.substring(i, i + len);
        if (new Set(frag).size === 1) continue;
        if (!temp.has(frag)) {
          temp.set(frag, new Set());
        }
        const set = temp.get(frag)!;
        if (set.size < 10) {
          set.add(word);
        }
      }
    }
  }
  _validFragments = [];
  for (const [text, words] of temp) {
    if (words.size >= 3) {
      _validFragments.push({ text, words: [...words] });
    }
  }
}

export function generateFragments(count: number): WBFragment[] {
  const shuffled = shuffleArray([..._validFragments]);
  return shuffled.slice(0, count).map(f => {
    const uniqueWords = shuffleArray([...f.words]);
    const hints = uniqueWords.slice(0, 3);
    return { text: f.text.toUpperCase(), hint: hints.join(', ') };
  });
}

export function wordContainsFragment(word: string, fragment: string): boolean {
  return normalizeText(word).includes(normalizeText(fragment));
}

export function isValidWord(word: string): boolean {
  const w = word.trim().toLowerCase();
  if (!w || w.length < 3) return false;
  return /^[a-záàâãäéèêëíìîïóòôõöúùûüçñ]+$/.test(w);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeLetter(letter: string): string {
  const accentMap: Record<string, string> = {
    à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a',
    è: 'e', é: 'e', ê: 'e', ë: 'e',
    ì: 'i', í: 'i', î: 'i', ï: 'i',
    ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
    ù: 'u', ú: 'u', û: 'u', ü: 'u',
    ç: 'c', ñ: 'n',
  };
  return accentMap[letter] || letter;
}

export function getLastLetter(word: string): string {
  const trimmed = word.trim();
  const last = trimmed[trimmed.length - 1]?.toLowerCase() || '';
  return normalizeLetter(last);
}

export const wordBombService = {
  async ensureWords(): Promise<void> {
    await initWords();
  },

  async createRoom(nickname: string, avatar?: string, lives: number = 2, turnDuration: number = 15): Promise<{ room: WBRoom; player: WBPlayer } | null> {
    await initWords();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId = '';
    for (let i = 0; i < 5; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const playerId = Math.random().toString(36).substring(2, 10);
    const joinedAt = Date.now();

    const { data: roomData, error: roomError } = await supabase.from('wb_rooms').insert({
      id: roomId,
      host_id: playerId,
      phase: 'lobby',
      lives,
      turn_duration: turnDuration,
      current_turn_index: 0,
      current_letter: null,
      current_word: null,
      turn_started_at: null,
    }).select().single();

    if (roomError) {
      console.error("Error creating wb room:", roomError.message);
      return null;
    }

    const { data: playerData, error: playerError } = await supabase.from('wb_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: true,
      lives,
      is_alive: true,
      score: 0,
      turn_order: 0,
      joined_at: joinedAt,
    }).select().single();

    if (playerError) {
      console.error("Error creating wb player:", playerError);
      return null;
    }

    await this.initChannel(roomId, playerId);
    return { room: mapRoom(roomData), player: mapPlayer(playerData) };
  },

  async joinRoom(roomId: string, nickname: string, avatar?: string): Promise<WBPlayer | null> {
    await initWords();
    roomId = roomId.toUpperCase();
    const playerId = Math.random().toString(36).substring(2, 10);

    const { data: roomData } = await supabase.from('wb_rooms').select('lives').eq('id', roomId).single();
    if (!roomData) return null;
    const playerLives = roomData.lives;

    const { data: existingPlayers } = await supabase.from('wb_players').select('turn_order').eq('room_id', roomId).order('turn_order', { ascending: false }).limit(1);
    const nextOrder = (existingPlayers && existingPlayers.length > 0 ? existingPlayers[0].turn_order + 1 : 0);

    const { data, error } = await supabase.from('wb_players').insert({
      id: playerId,
      room_id: roomId,
      nickname,
      avatar,
      is_host: false,
      lives: playerLives,
      is_alive: true,
      score: 0,
      turn_order: nextOrder,
      joined_at: Date.now(),
    }).select().single();

    if (error) {
      console.error("Error joining wb room:", error);
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

    channel = supabase.channel(`wb_room_db:${roomId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wb_rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (!payload.new) {
          _onRoomUpdate?.(null as any);
          return;
        }
        _onRoomUpdate?.(mapRoom(payload.new));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wb_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wb_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wb_players', filter: `room_id=eq.${roomId}` }, () => {
        refreshPlayers(roomId);
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        _onTypingUpdate?.(payload.payload.playerId, payload.payload.text);
      })
      .on('broadcast', { event: 'notification' }, (payload) => {
        _onNotification?.(payload.payload.message, payload.payload.type);
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

  subscribeToRoom(
    roomId: string,
    onPlayersChange: (players: WBPlayer[]) => void,
    onRoomUpdate: (room: WBRoom) => void,
    onTypingUpdate?: (playerId: string, text: string) => void,
    onNotification?: (message: string, type: 'leave' | 'host_left') => void,
  ) {
    _onPlayersChange = onPlayersChange;
    _onRoomUpdate = onRoomUpdate;
    if (onTypingUpdate) _onTypingUpdate = onTypingUpdate;
    if (onNotification) _onNotification = onNotification;

    if (channel && currentRoomId === roomId) {
      refreshRoom(roomId);
      refreshPlayers(roomId);
    }

    return () => {
      _onPlayersChange = null;
      _onRoomUpdate = null;
      if (onTypingUpdate) _onTypingUpdate = null;
      if (onNotification) _onNotification = null;
    };
  },

  sendTyping(text: string) {
    if (channel && localPlayerId) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { playerId: localPlayerId, text },
      });
    }
  },

  broadcastNotification(message: string, type: 'leave' | 'host_left') {
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'notification',
        payload: { message, type },
      });
    }
  },

  async startGame(roomId: string) {
    const { data: players } = await supabase.from('wb_players').select('id').eq('room_id', roomId).order('turn_order', { ascending: true });
    if (!players || players.length < 2) return;

    const { data: room } = await supabase.from('wb_rooms').select('lives').eq('id', roomId).single();
    if (room) {
      await supabase.from('wb_players').update({ lives: room.lives, is_alive: true, score: 0 }).eq('room_id', roomId);
    }

    const frags = generateFragments(1);
    const fragment = frags.length > 0 ? frags[0].text : 'CA';

    await supabase.from('wb_rooms').update({
      phase: 'playing',
      current_turn_index: 0,
      current_letter: fragment,
      current_word: null,
      turn_duration: 15,
      turn_started_at: Date.now(),
    }).eq('id', roomId);

    await supabase.from('wb_used_words').delete().eq('room_id', roomId);
  },

  async submitWord(roomId: string, word: string, playerId: string, turnIndex: number) {
    word = word.trim().toLowerCase();
    const { data: room } = await supabase.from('wb_rooms').select('current_letter, current_turn_index, turn_started_at, turn_duration, phase').eq('id', roomId).single();
    if (!room || room.phase !== 'playing') return { success: false, reason: 'game_not_active' };

    if (room.current_turn_index !== turnIndex) return { success: false, reason: 'not_your_turn' };

    const fragment = room.current_letter;
    if (!fragment) return { success: false, reason: 'no_fragment' };

    if (!isValidWord(word)) return { success: false, reason: 'invalid_word' };

    if (!wordContainsFragment(word, fragment)) return { success: false, reason: 'wrong_fragment' };

    const { data: used } = await supabase.from('wb_used_words').select('id').eq('room_id', roomId).eq('word', word);
    if (used && used.length > 0) return { success: false, reason: 'word_already_used' };

    const lastLetter = getLastLetter(word);

    await supabase.from('wb_used_words').insert({
      room_id: roomId,
      word,
      player_id: playerId,
      round: 1,
    });

    const { data: alivePlayers } = await supabase.from('wb_players').select('id, turn_order').eq('room_id', roomId).eq('is_alive', true).order('turn_order', { ascending: true });
    if (!alivePlayers || alivePlayers.length === 0) return { success: false, reason: 'no_players' };

    // Encontrar índice do jogador atual na lista de vivos
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === playerId);
    if (currentPlayerIndex === -1) return { success: false, reason: 'player_not_found' };

    // Próximo jogador é sempre o seguinte na sequência
    const nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;

    const { data: playerData } = await supabase.from('wb_players').select('score').eq('id', playerId).single();
    const currentScore = playerData?.score || 0;
    await supabase.from('wb_players').update({ score: currentScore + word.length }).eq('id', playerId);

    const frags = generateFragments(1);
    const newFragment = frags.length > 0 ? frags[0].text : 'CA';

    const currentDuration = room.turn_duration ?? 15;
    const newDuration = Math.max(3, currentDuration - 0.3);

    await supabase.from('wb_rooms').update({
      current_turn_index: nextPlayerIndex,
      current_word: word,
      current_letter: newFragment,
      turn_duration: newDuration,
      turn_started_at: Date.now(),
    }).eq('id', roomId);

    return { success: true, lastLetter, word, newFragment };
  },

  async handleTimeout(roomId: string, playerId: string, turnIndex: number): Promise<boolean> {
    const { data: room } = await supabase.from('wb_rooms').select('lives, phase, current_turn_index').eq('id', roomId).single();
    if (!room || room.phase !== 'playing') return false;
    if (room.current_turn_index !== turnIndex) return false;

    const { data: player } = await supabase.from('wb_players').select('lives').eq('id', playerId).single();
    if (!player) return false;

    const newLives = player.lives - 1;
    if (newLives <= 0) {
      await supabase.from('wb_players').update({ lives: 0, is_alive: false }).eq('id', playerId);
    } else {
      await supabase.from('wb_players').update({ lives: newLives }).eq('id', playerId);
    }

    const { data: alivePlayers } = await supabase.from('wb_players').select('id, turn_order').eq('room_id', roomId).eq('is_alive', true).order('turn_order', { ascending: true });
    if (!alivePlayers || alivePlayers.length <= 1) {
      await supabase.from('wb_rooms').update({ phase: 'finished', current_turn_index: 0 }).eq('id', roomId);
      return true;
    }

    // Encontrar índice do jogador atual na lista de vivos
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === playerId);
    let nextPlayerIndex: number;
    
    if (currentPlayerIndex === -1) {
      // Jogador já saiu, use o turnIndex atual
      nextPlayerIndex = Math.min(turnIndex, alivePlayers.length - 1);
    } else {
      // Próximo jogador é sempre o seguinte na sequência
      nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;
    }

    const frags = generateFragments(1);
    const newFragment = frags.length > 0 ? frags[0].text : 'CA';
    await supabase.from('wb_rooms').update({
      current_turn_index: nextPlayerIndex,
      current_letter: newFragment,
      current_word: null,
      turn_started_at: Date.now(),
    }).eq('id', roomId);
    await supabase.from('wb_used_words').delete().eq('room_id', roomId);
    return true;
  },

  async finishGame(roomId: string) {
    await supabase.from('wb_rooms').update({ phase: 'finished' }).eq('id', roomId);
  },

  async resetRoom(roomId: string) {
    const { data: room } = await supabase.from('wb_rooms').select('lives').eq('id', roomId).single();
    const lives = room?.lives || 2;

    await supabase.from('wb_players').update({ lives, is_alive: true, score: 0 }).eq('room_id', roomId);
    await supabase.from('wb_rooms').update({
      phase: 'lobby',
      current_turn_index: 0,
      current_letter: null,
      current_word: null,
      turn_duration: 15,
      turn_started_at: null,
    }).eq('id', roomId);
    await supabase.from('wb_used_words').delete().eq('room_id', roomId);
  },

  async deleteRoom(roomId: string) {
    await supabase.from('wb_players').delete().eq('room_id', roomId);
    await supabase.from('wb_used_words').delete().eq('room_id', roomId);
    await supabase.from('wb_rooms').delete().eq('id', roomId);
  },

  async leaveRoom(roomId?: string, playerId?: string, isHost?: boolean) {
    const rId = roomId || currentRoomId;
    const pId = playerId || localPlayerId;

    if (rId && pId) {
      let hostStatus = isHost;
      let nickname = 'Alguém';
      if (hostStatus === undefined) {
        const { data: player } = await supabase.from('wb_players').select('is_host, nickname').eq('id', pId).single();
        hostStatus = player?.is_host;
        nickname = player?.nickname || nickname;
      } else {
        const { data: player } = await supabase.from('wb_players').select('nickname').eq('id', pId).single();
        nickname = player?.nickname || nickname;
      }

      if (hostStatus) {
        this.broadcastNotification(`${nickname} (HOST) saiu da partida`, 'host_left');
        await this.deleteRoomWithKeepalive(rId);
      } else {
        this.broadcastNotification(`${nickname} saiu da partida`, 'leave');
        await supabase.from('wb_players').delete().eq('id', pId);
        const su = import.meta.env.VITE_SUPABASE_URL;
        const ak = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (su && ak) {
          fetch(`${su}/rest/v1/wb_players?id=eq.${pId}`, {
            method: 'DELETE', headers: { 'apikey': ak, 'Authorization': `Bearer ${ak}` }, keepalive: true,
          }).catch(() => {});
        }
      }
    }

    if (channel) {
      await supabase.removeChannel(channel);
      channel = null;
    }
    currentRoomId = null;
    localPlayerId = null;
    _lastPlayerSnapshot.clear();
    _isSubscribed = false;
    _onTypingUpdate = null;
    _onNotification = null;
  },

  async deleteRoomWithKeepalive(roomId: string) {
    try {
      await supabase.from('wb_players').delete().eq('room_id', roomId);
      await supabase.from('wb_used_words').delete().eq('room_id', roomId);
      await supabase.from('wb_rooms').delete().eq('id', roomId);
    } catch (e) {
      console.error("SDK delete failed", e);
    }
    const su = import.meta.env.VITE_SUPABASE_URL;
    const ak = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (su && ak) {
      const headers = { 'apikey': ak, 'Authorization': `Bearer ${ak}`, 'Content-Type': 'application/json' };
      fetch(`${su}/rest/v1/wb_players?room_id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
      fetch(`${su}/rest/v1/wb_used_words?room_id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
      fetch(`${su}/rest/v1/wb_rooms?id=eq.${roomId}`, { method: 'DELETE', headers, keepalive: true }).catch(() => {});
    }
  },

  async startDiscoveryListener(onNearbyRoomsChange: (rooms: { id: string; hostName: string; hostAvatar?: string; lives: number; turnDuration: number }[]) => void) {
    const fetchLobbies = async () => {
      const { data } = await supabase.from('wb_rooms').select('id, lives, turn_duration').eq('phase', 'lobby');
      const allRooms: { id: string; hostName: string; hostAvatar?: string; lives: number; turnDuration: number }[] = [];
      if (data) {
        for (const r of data) {
          const { data: players } = await supabase.from('wb_players').select('nickname, avatar').eq('room_id', r.id).eq('is_host', true).limit(1);
          allRooms.push({
            id: r.id,
            hostName: players?.[0]?.nickname || 'Host',
            hostAvatar: players?.[0]?.avatar,
            lives: r.lives || 2,
            turnDuration: r.turn_duration || 15,
          });
        }
      }
      onNearbyRoomsChange(allRooms);
    };
    fetchLobbies();
    const discChannel = supabase.channel('wb_lobby_discovery_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wb_rooms' }, () => { fetchLobbies(); })
      .subscribe();
    (this as any)._discoveryChannel = discChannel;
  },

  stopDiscoveryListener() {
    if ((this as any)._discoveryChannel) {
      supabase.removeChannel((this as any)._discoveryChannel);
      (this as any)._discoveryChannel = null;
    }
  },

  async getRoom(roomId: string): Promise<WBRoom | null> {
    const { data } = await supabase.from('wb_rooms').select('*').eq('id', roomId).single();
    return data ? mapRoom(data) : null;
  },

  async getRoomPlayers(roomId: string): Promise<WBPlayer[]> {
    const { data } = await supabase.from('wb_players').select('*').eq('room_id', roomId).order('turn_order', { ascending: true });
    return data?.map(mapPlayer) || [];
  },

  getCurrentRoomId() { return currentRoomId; },
  getLocalPlayerId() { return localPlayerId; },
};

const mapRoom = (row: any): WBRoom => ({
  id: row.id,
  hostId: row.host_id,
  phase: row.phase,
  lives: row.lives,
  turnDuration: row.turn_duration,
  currentTurnIndex: row.current_turn_index,
  currentFragment: row.current_letter,
  currentWord: row.current_word,
  turnStartedAt: row.turn_started_at ? Number(row.turn_started_at) : null,
});

const mapPlayer = (row: any): WBPlayer => ({
  id: row.id,
  nickname: row.nickname,
  avatar: row.avatar,
  isHost: row.is_host,
  lives: row.lives,
  isAlive: row.is_alive,
  score: row.score,
  turnOrder: row.turn_order,
  joinedAt: row.joined_at ? Number(row.joined_at) : 0,
});

const refreshPlayers = async (roomId: string) => {
  const { data } = await supabase.from('wb_players').select('*').eq('room_id', roomId).order('turn_order', { ascending: true });
  if (data) {
    _lastPlayerSnapshot = new Set(data.map(p => p.id));
    _onPlayersChange?.(data.map(mapPlayer));
  }
};

const refreshRoom = async (roomId: string) => {
  const { data } = await supabase.from('wb_rooms').select('*').eq('id', roomId).single();
  if (data) {
    _onRoomUpdate?.(mapRoom(data));
  }
};
