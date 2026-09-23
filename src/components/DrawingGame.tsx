import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Eraser, Trash2, Check, RefreshCw, Lightbulb, ArrowRight, Undo2, Redo2, PaintBucket, Timer } from 'lucide-react';


import { motion, AnimatePresence } from 'motion/react';
import { soundService } from '../lib/soundService';
import { DrawingCanvasView, type DrawingLine, type DrawingCanvasRef } from './DrawingComponents';

const TOTAL_TIME = 80;
const MAX_HINTS = 3;

function SlotMachineWord({ finalWord }: { finalWord: string }) {
  const [displayWord, setDisplayWord] = useState('...');

  // Mobile: bem menor pra não cortar em 320px (era text-4xl cortava)
  const len = finalWord.length;
  const fontSizeClass = len > 18 ? 'text-sm min-[360px]:text-base md:text-2xl' :
    len > 14 ? 'text-base min-[360px]:text-lg md:text-3xl' :
      len > 10 ? 'text-lg min-[360px]:text-xl md:text-4xl' :
        len > 6 ? 'text-xl min-[360px]:text-2xl md:text-4xl' :
          'text-2xl min-[360px]:text-3xl md:text-5xl';

  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const interval = setInterval(() => {
      let str = '';
      for (let i = 0; i < finalWord.length; i++) {
        if (finalWord[i] === ' ' || finalWord[i] === '-') str += finalWord[i];
        else str += chars[Math.floor(Math.random() * chars.length)];
      }
      setDisplayWord(str);
    }, 60);
    const stopTimer = setTimeout(() => {
      clearInterval(interval);
      setDisplayWord(finalWord.toUpperCase());
    }, 2000);
    return () => { clearInterval(interval); clearTimeout(stopTimer); };
  }, [finalWord]);
  return (
    <div className="w-full min-h-[96px] md:min-h-[128px] bg-slate-50 rounded-xl border-2 border-slate-200 tracking-widest uppercase shadow-inner flex items-center justify-center p-3 min-[360px]:p-4 overflow-hidden">
      <span className={`${fontSizeClass} font-black text-[#1E3A5F] text-center break-words hyphens-auto leading-tight px-1`}>
        {displayWord}
      </span>
    </div>
  );
}


// Levenshtein distance for "almost correct" detection
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
      );
  return dp[m][n];
}

interface DrawingGameProps {
  roomId: string;
  localPlayerId: string;
  players: any[];
  isHost: boolean;
  category?: string;
  scoreGoal?: number;
  onEndGame: () => void;
}

export function DrawingGame({ roomId, localPlayerId, players, isHost, category, scoreGoal = 500, onEndGame }: DrawingGameProps) {
  const [phase, setPhase] = useState<'waiting' | 'selecting_word' | 'drawing' | 'round_end' | 'game_over'>('waiting');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [words, setWords] = useState<{ word: string; category: string }[]>([]);
  const [wordChoices, setWordChoices] = useState<{ word: string; category: string }[]>([]);
  const [currentWord, setCurrentWord] = useState<{ word: string; category: string } | null>(null);
  const [time, setTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; isCorrect: boolean }[]>([]);
  const [floatingBubbles, setFloatingBubbles] = useState<{ id: string; sender: string; text: string; isCorrect: boolean; x: number }[]>([]);
  const [guess, setGuess] = useState('');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'bucket'>('pen');


  const [localPlayers, setLocalPlayers] = useState(players);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [drawerIndex, setDrawerIndex] = useState(0);
  const [showCorrectPopup, setShowCorrectPopup] = useState<{ points: number } | null>(null);
  const [almostMsg, setAlmostMsg] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hintToast, setHintToast] = useState<{ name: string } | null>(null);
  const hasGuessedCorrectlyRef = useRef(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // react-konva lines state
  const [externalLines, setExternalLines] = useState<DrawingLine[]>([]);
  // The in-progress line being drawn by the remote drawer (real-time stream)
  const [activeExternalLine, setActiveExternalLine] = useState<DrawingLine | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  // Track undo/redo availability for button disabled state
  const [canUndoState, setCanUndoState] = useState(false);
  const [canRedoState, setCanRedoState] = useState(false);
  const currentWordRef = useRef(currentWord);
  const drawerIdRef = useRef(drawerId);
  const localPlayersRef = useRef(localPlayers);
  const hintsRef = useRef(hints);
  const hintsUsedRef = useRef(hintsUsed);
  const persistedLinesRef = useRef<DrawingLine[]>([]);
  // Palavras já sorteadas nesta sessão (host). Só repete após esgotar o pool.
  const usedWordsRef = useRef<Set<string>>(new Set());
  // Nova sala = nova sessão → limpa histórico
  useEffect(() => { usedWordsRef.current.clear(); }, [roomId]);
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);
  useEffect(() => { drawerIdRef.current = drawerId; }, [drawerId]);
  useEffect(() => { localPlayersRef.current = localPlayers; }, [localPlayers]);
  useEffect(() => { hintsRef.current = hints; }, [hints]);
  useEffect(() => { hintsUsedRef.current = hintsUsed; }, [hintsUsed]);
  useEffect(() => { hasGuessedCorrectlyRef.current = hasGuessedCorrectly; }, [hasGuessedCorrectly]);

  useEffect(() => {
    const syncStates = () => {
      setCanUndoState(canvasRef.current?.canUndo() || false);
      setCanRedoState(canvasRef.current?.canRedo() || false);
    };
    syncStates();
    // Also sync on a small interval as a fallback since Konva events are external
    const timer = setInterval(syncStates, 500);
    return () => clearInterval(timer);
  }, [drawerId, phase]);

  const me = localPlayers.find(p => p.id === localPlayerId);
  const isDrawer = drawerId === localPlayerId;
  const isDrawerRef = useRef(false);
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);

  // Bolhas: só para desenhista, some rápido em 2.5s e máx 3 pra não tampar
  const lastChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isDrawer) return;
    if (chatMessages.length === 0) return;
    const last = chatMessages[chatMessages.length - 1];
    if (lastChatIdRef.current === last.id) return;
    lastChatIdRef.current = last.id;
    // Só palpites de jogadores viram bolha, sistema já é discreto
    if (last.sender === 'Sistema' && !last.text.includes('acertou')) return;
    const x = 12 + Math.random() * 58;
    const bubble = { id: last.id, sender: last.sender, text: last.text, isCorrect: last.isCorrect, x };
    setFloatingBubbles(prev => [...prev.slice(-2), bubble]); // máx 3 bolhas
    setTimeout(() => {
      setFloatingBubbles(prev => prev.filter(b => b.id !== bubble.id));
    }, 2500);
  }, [chatMessages, isDrawer]);

  // Debug logs
  useEffect(() => {
    if (phase === 'drawing') {
      console.log('[DrawingGame] Phase is drawing. Am I drawer?', isDrawer, 'My ID:', localPlayerId, 'Drawer ID:', drawerId);
    }
  }, [phase, isDrawer, localPlayerId, drawerId]);

  // ─── Load words from Supabase ────────────────────────────────────
  useEffect(() => {
    const fetchWords = async () => {
      console.log('[DrawingGame] Fetching words...');
      const { data, error } = await supabase.from('desenho_palavras').select('*');
      if (error) console.error('[DrawingGame] Error fetching words:', error);
      if (data && data.length > 0) {
        console.log(`[DrawingGame] Loaded ${data.length} words`);
        setWords(data);
      } else {
        console.warn('[DrawingGame] No words found! Using fallbacks.');
        setWords([
          { word: 'Bíblia', category: 'Igreja' },
          { word: 'Arca', category: 'Biblia' },
          { word: 'Harpa', category: 'Instrumentos' },
          { word: 'Anjo', category: 'Biblia' },
          { word: 'Véu', category: 'Igreja' },
          { word: 'Hino', category: 'Igreja' }
        ]);
      }
    };
    fetchWords();
  }, []);

  // ─── Supabase Broadcast Channel ──────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`drawing_${roomId}`, {
      config: { broadcast: { self: false } }
    });

    // Guarda última fase vista pra só resetar o input em TRANSIÇÃO de fase.
    // Antes o host mandava game_state a cada 1s com phase:'drawing' e o guest
    // executava setGuess('') toda vez — apagava o que estava digitando.
    // O host (self:false) nunca recebe o próprio broadcast, por isso no
    // celular (geralmente host) parecia "funcionar normal".
    let lastSeenPhase: string | null = null;

    channel
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        if (!isHost) {
          if (payload.phase) {
            const phaseChanged = payload.phase !== lastSeenPhase;
            lastSeenPhase = payload.phase;
            setPhase(payload.phase);
            // Reset per-round state APENAS quando a fase realmente mudou
            if (phaseChanged && payload.phase === 'selecting_word') {
              // New round starting — clear guessed state for all clients
              setHasGuessedCorrectly(false);
              hasGuessedCorrectlyRef.current = false;
              setAlmostMsg('');
              setShowCorrectPopup(null);
              setGuess('');
            } else if (phaseChanged && payload.phase === 'round_end') {
              // Round ended — prepare reset for next round
              setHasGuessedCorrectly(false);
              hasGuessedCorrectlyRef.current = false;
              setAlmostMsg('');
            }
            // NOTE: NÃO limpar setGuess/setAlmostMsg em 'drawing' — o tick
            // de 1s do host republica phase:'drawing' e apagaria o palpite
            // em digitação + o aviso "quase!".
          }
          if (payload.drawerId) setDrawerId(payload.drawerId);
          if (payload.time !== undefined) setTime(payload.time);
          if (payload.actualWord) {
            const currentDrawer = payload.drawerId || drawerIdRef.current;
            if (currentDrawer === localPlayerId) {
              setCurrentWord(payload.actualWord);
            } else if (!payload.currentWord) {
              // NOVO: se hints vazio, não cria placeholder _ _ _ (segredo total)
              if (payload.hints && payload.hints.length === 0) {
                setCurrentWord({ word: '', category: payload.actualWord.category });
              } else {
                setCurrentWord({ word: '_'.repeat(payload.wordLength || payload.actualWord.word.length), category: payload.actualWord.category });
              }
            }
          } else if (payload.wordLength && !payload.currentWord) {
            const currentDrawer = payload.drawerId || drawerIdRef.current;
            if (currentDrawer !== localPlayerId) {
              if (payload.hints && payload.hints.length === 0) {
                setCurrentWord({ word: '', category: payload.category });
              } else {
                setCurrentWord({ word: '_'.repeat(payload.wordLength), category: payload.category });
              }
            }
          }
          if (payload.currentWord) {
            setCurrentWord(payload.currentWord);
          }
          if (payload.hints) {
            setHints(payload.hints);
          }
          if (payload.players) {
            // Sync players from host including hasGuessed flags
            setLocalPlayers(payload.players);
          }
          if (payload.wordChoices) {
            setWordChoices(payload.wordChoices);
          }
          if (payload.currentRound !== undefined) {
            setCurrentRound(payload.currentRound);
          }
        }
      })
      .on('broadcast', { event: 'draw_line' }, ({ payload }) => {
        // Receive a COMPLETE line from the drawer — move to permanent lines and clear active
        if (payload.line) {
          setExternalLines(prev => [...prev, payload.line as DrawingLine]);
          setActiveExternalLine(null);
        }
      })
      .on('broadcast', { event: 'draw_move' }, ({ payload }) => {
        // Real-time partial line from the drawer while they are still drawing
        if (payload.line) {
          setActiveExternalLine(payload.line as DrawingLine);
        }
      })
      .on('broadcast', { event: 'canvas_replace' }, ({ payload }) => {
        // Full canvas state replace (after undo/redo by the drawer)
        if (!isHost && Array.isArray(payload.lines)) {
          setExternalLines(payload.lines as DrawingLine[]);
          setActiveExternalLine(null);
        }
      })
      .on('broadcast', { event: 'clear' }, () => {
        setExternalLines([]);
        setActiveExternalLine(null);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload]);
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      })
      .on('broadcast', { event: 'guess_correct' }, ({ payload }) => {
        soundService.playCorrect();
        setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `🎉 ${payload.nickname} acertou a palavra!`, isCorrect: true }]);
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
        // Update player's hasGuessed in localPlayers for all clients
        setLocalPlayers(prev => prev.map(p =>
          p.id === payload.playerId ? { ...p, hasGuessed: true, score: (p.score || 0) + (payload.points || 0) } :
            p.id === payload.drawerId ? { ...p, score: (p.score || 0) + (payload.drawerPoints || 0) } : p
        ));
        if (payload.playerId === localPlayerId) {
          setHasGuessedCorrectly(true);
          hasGuessedCorrectlyRef.current = true;
          setShowCorrectPopup({ points: payload.points || 0 });
          setTimeout(() => setShowCorrectPopup(null), 2500);
        }
      })
      .on('broadcast', { event: 'hint_used' }, ({ payload }) => {
        if (payload.hints) setHints(payload.hints);
        if (payload.hintsUsed !== undefined) setHintsUsed(payload.hintsUsed);
        soundService.playTick();
        const n = payload.name || 'Alguém';
        setHintToast({ name: n });
        setTimeout(() => setHintToast(null), 2200);
        setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `💡 ${n} deu uma dica!`, isCorrect: false }]);
      })

      .on('broadcast', { event: 'guess_attempt' }, ({ payload }) => {
        // HOST validates guesses from other players
        if (isHost && currentWordRef.current) {
          const normalizedGuess = payload.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          const normalizedWord = currentWordRef.current.word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

          if (normalizedGuess === normalizedWord) {
            // Correct!
            const guessedCount = localPlayersRef.current.filter(p => p.hasGuessed).length;
            const pts = Math.max(10, 100 - (guessedCount * 10));
            const drawerPts = Math.floor(pts / 2);

            setLocalPlayers(prev => {
              const updated = prev.map(p => {
                if (p.id === payload.playerId) return { ...p, score: (p.score || 0) + pts, hasGuessed: true };
                if (p.id === drawerIdRef.current) return { ...p, score: (p.score || 0) + drawerPts };
                return p;
              });
              // Broadcast updated players list so all clients stay in sync
              channelRef.current?.send({
                type: 'broadcast',
                event: 'players_update',
                payload: { players: updated }
              });
              // Check if all non-drawers have guessed
              const allGuessed = updated.filter(p => p.id !== drawerIdRef.current).every(p => p.hasGuessed);
              if (allGuessed) setTimeout(() => endRound(), 500);
              return updated;
            });
            channelRef.current?.send({
              type: 'broadcast',
              event: 'guess_correct',
              payload: { playerId: payload.playerId, nickname: payload.nickname, points: pts, drawerId: drawerIdRef.current, drawerPoints: drawerPts }
            });
            soundService.playCorrect();
            // Don't show the actual word in chat!
            setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `🎉 ${payload.nickname} acertou a palavra!`, isCorrect: true }]);
          } else {
            // Check almost correct
            const dist = levenshtein(normalizedGuess, normalizedWord);
            const threshold = normalizedWord.length <= 4 ? 1 : 2;
            if (dist > 0 && dist <= threshold) {
              channelRef.current?.send({
                type: 'broadcast',
                event: 'guess_almost',
                payload: { playerId: payload.playerId }
              });
            }
            // Show WRONG guesses in host chat (these are safe to show)
            setChatMessages(prev => [...prev, { id: payload.msgId, sender: payload.nickname, text: payload.text, isCorrect: false }]);
          }
        }
      })
      .on('broadcast', { event: 'guess_almost' }, ({ payload }) => {
        if (payload.playerId === localPlayerId) {
          setAlmostMsg('🟠 Está quase! Tente de novo...');
          setTimeout(() => setAlmostMsg(''), 2000);
        }
      })
      .on('broadcast', { event: 'word_selected' }, ({ payload }) => {
        if (isHost) {
          selectWord(payload);
        }
      })
      .on('broadcast', { event: 'players_update' }, ({ payload }) => {
        // Sync player scores and hasGuessed from host
        if (!isHost && payload.players) {
          setLocalPlayers(prev => prev.map(p => {
            const updated = payload.players.find((u: any) => u.id === p.id);
            return updated ? { ...p, score: updated.score, hasGuessed: updated.hasGuessed } : p;
          }));
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isHost, localPlayerId]);

  // ─── Host Logic ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;

    let timer: any;
    if (phase === 'waiting' && localPlayers.length > 0 && words.length > 0) {
      startNextRound();
    } else if (phase === 'selecting_word') {
      setTime(4);
      broadcastState({ phase, drawerId: drawerIdRef.current, time: 4 });
      timer = setInterval(() => {
        setTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            // Call selectWord outside of the setTime callback to avoid state conflicts
            setTimeout(() => {
              if (wordChoices.length > 0) {
                selectWord(wordChoices[0]);
              }
            }, 0);
            return 0;
          }
          broadcastState({ time: t - 1, phase: 'selecting_word', drawerId: drawerIdRef.current });
          return t - 1;
        });
      }, 1000);

    } else if (phase === 'drawing') {
      timer = setInterval(() => {
        setTime(t => {
          const nextT = t - 1;
          if (nextT <= 0) {
            clearInterval(timer);
            setTimeout(endRound, 0);
            return 0;
          }
          // Inclui phase+drawerId pra quem reconectar sincronizar em até 1s
          broadcastState({ time: nextT, phase: 'drawing', drawerId: drawerIdRef.current });
          return nextT;
        });
      }, 1000);

    } else if (phase === 'round_end') {
      timer = setTimeout(() => {
        startNextRound();
      }, 5000);
    }

    return () => clearInterval(timer);
  }, [phase, isHost, localPlayers.length, wordChoices, words]);

  // Nova rodada: limpa buffer local pra não misturar traços antigos
  useEffect(() => {
    if (phase === 'selecting_word') {
      persistedLinesRef.current = [];
    }
  }, [phase]);

  // Carrega desenho salvo ao reconectar (não zera)
  useEffect(() => {
    if (!roomId) return;
    // Roda no mount e quando entra em drawing (cobre waiting -> drawing do reconnect)
    if (phase !== 'drawing' && phase !== 'waiting') return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('drawing_states').select('*').eq('room_id', roomId).maybeSingle();
        if (!cancelled && data) {
          if ((data as any).drawer_id) {
            setDrawerId((data as any).drawer_id);
          }
          if (Array.isArray(data.hints) && data.hints.length > 0) {
            setHints(data.hints as string[]);
            // estima hintsUsados pela qtd de letras reveladas
            const revealed = (data.hints as string[]).filter(h => h !== '_' && h !== ' ' && h !== '-').length;
            setHintsUsed(revealed > 0 ? Math.min(revealed, MAX_HINTS) : 0);
          }
          if (Array.isArray(data.lines) && data.lines.length > 0) {
            persistedLinesRef.current = data.lines as DrawingLine[];
            setExternalLines(data.lines as DrawingLine[]);
          }
          // Se tem palavra salva, força phase drawing pra sair do waiting
          if ((data as any).word) {
            if (!isDrawerRef.current) {
              // Guesser: placeholder sem revelar (hints já mostram tamanho)
              const wlen = ((data as any).word as string).length;
              if (!currentWordRef.current) {
                setCurrentWord({ word: '', category: (data as any).category || 'Desenho' });
                void wlen;
              }
            } else if (!currentWordRef.current) {
              setCurrentWord({ word: (data as any).word, category: (data as any).category || 'Desenho' });
            }
            setPhase(prev => (prev === 'waiting' ? 'drawing' : prev));
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [roomId, phase]);

  // ─── Game Logic Functions ────────────────────────────────────────
  const startNextRound = () => {
    if (!isHost) return;

    // Check if anyone reached the score goal
    const winner = localPlayers.find(p => (p.score || 0) >= scoreGoal);

    if (winner) {
      setPhase('game_over');
      broadcastState({ phase: 'game_over', players: localPlayers });
      setTimeout(onEndGame, 8000);
      return;
    }

    const nextRound = currentRound + 1;

    // Sequential rotation: player at index (nextRound-1) draws
    const idx = (drawerIndex) % localPlayers.length;
    const nextDrawer = localPlayers[idx];
    setDrawerIndex(idx + 1);
    setCurrentRound(nextRound);

    setLocalPlayers(prev => prev.map(p => ({ ...p, hasGuessed: false })));
    setDrawerId(nextDrawer.id);
    setHintsUsed(0);
    setHasGuessedCorrectly(false);
    hasGuessedCorrectlyRef.current = false;
    setAlmostMsg('');
    setGuess('');

    const filteredWords = category && category !== 'Todos' ? words.filter(w => w.category.toLowerCase() === category.toLowerCase()) : words;
    const availableWords = filteredWords.length > 0 ? filteredWords : words;
    // Sem repetição na sessão: filtra as já usadas; se esgotou tudo, limpa e recomeça
    const wordKey = (w: { word: string }) => w.word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    let unused = availableWords.filter(w => !usedWordsRef.current.has(wordKey(w)));
    if (unused.length === 0 && availableWords.length > 0) {
      usedWordsRef.current.clear();
      unused = availableWords;
    }
    const picked = unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : null;
    if (picked) usedWordsRef.current.add(wordKey(picked));
    const choices = picked ? [picked] : [{ word: 'ERRO', category: 'N/A' }];
    setWordChoices(choices);
    setPhase('selecting_word');
    setHints([]);
    setCurrentWord(null);

    setExternalLines([]);
    setActiveExternalLine(null);
    channelRef.current?.send({ type: 'broadcast', event: 'clear' });

    broadcastState({
      phase: 'selecting_word',
      drawerId: nextDrawer.id,
      currentRound: nextRound,
      scoreGoal,
      wordChoices: choices,
      players: localPlayers.map(p => ({ ...p, hasGuessed: false }))
    });
  };

  const selectWord = (wordObj: { word: string; category: string }) => {
    if (!isHost) {
      setCurrentWord(wordObj);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'word_selected',
        payload: wordObj
      });
      return;
    }

    setCurrentWord(wordObj);
    setPhase('drawing');
    setTime(80);
    // NOVO: não mostra _ _ _ de cara, hints vazio = segredo total. Primeira dica revela tamanho
    setHints([]);
    setHintsUsed(0);
    setHasGuessedCorrectly(false);
    // Persiste pra reconexão ver palavra e desenho em tempo real
    persistWordHints(wordObj, []);
    persistCanvas([]);

    broadcastState({
      phase: 'drawing',
      drawerId: drawerId,
      time: 80,
      wordLength: wordObj.word.length,
      category: wordObj.category,
      hints: [],
      hintsUsed: 0,
      actualWord: wordObj
    });
  };

  const endRound = () => {
    setPhase('round_end');
    broadcastState({
      phase: 'round_end',
      currentWord: currentWordRef.current
    });
  };

  const broadcastState = (payload: any) => {
    if (!isHost) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_state',
      payload
    });
  };

  // Persiste canvas/word/hints em drawing_states pra reconexão ver desenho anterior em tempo real
  // Linhas: só o drawer persiste (host pode não estar desenhando). Word/hints: host persiste.
  const persistCanvas = async (lines: DrawingLine[]) => {
    if (!roomId) return;
    if (!isDrawerRef.current && !isHost) return;
    try {
      await supabase.from('drawing_states').upsert({
        room_id: roomId,
        word: currentWordRef.current?.word || null,
        category: currentWordRef.current?.category || null,
        hints: hintsRef.current as any,
        lines: lines as any,
        drawer_id: drawerIdRef.current || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'room_id' });
    } catch {}
  };
  const persistWordHints = async (word: {word:string, category:string} | null, hintsArr: string[]) => {
    if (!roomId) return;
    if (!isHost && !isDrawerRef.current) return;
    try {
      await supabase.from('drawing_states').upsert({
        room_id: roomId,
        word: word?.word || null,
        category: word?.category || null,
        hints: hintsArr as any,
        drawer_id: drawerIdRef.current || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'room_id' });
    } catch {}
  };

  // ─── Drawing callbacks (from DrawingCanvasView) ──────────────────
  const handleDraw = (line: DrawingLine) => {
    // Broadcast complete line to other players
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_line',
      payload: { line }
    });
    // Persiste pra quem reconectar ver o desenho anterior em tempo real
    persistedLinesRef.current = [...persistedLinesRef.current, line];
    persistCanvas(persistedLinesRef.current);
    // Update undo/redo button states
    setCanUndoState(true);
    setCanRedoState(false);
  };

  const handleUndo = () => {
    if (!canvasRef.current || !isDrawer) return;
    const newLines = canvasRef.current.undo();
    if (newLines !== null) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'canvas_replace',
        payload: { lines: newLines }
      });
      persistedLinesRef.current = newLines;
      persistCanvas(newLines);
      setCanUndoState(canvasRef.current.canUndo());
      setCanRedoState(true);
    }
  };

  const handleRedo = () => {
    if (!canvasRef.current || !isDrawer) return;
    const newLines = canvasRef.current.redo();
    if (newLines !== null) {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'canvas_replace',
        payload: { lines: newLines }
      });
      persistedLinesRef.current = newLines;
      persistCanvas(newLines);
      setCanUndoState(true);
      setCanRedoState(canvasRef.current.canRedo());
    }
  };

  // Called on every pointer move — streams the in-progress line in real-time
  const handleDrawMove = (line: DrawingLine) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_move',
      payload: { line }
    });
  };

  const handleClearCanvas = () => {
    if (!isDrawer || phase !== 'drawing') return;
    setExternalLines([]);
    setActiveExternalLine(null);
    channelRef.current?.send({ type: 'broadcast', event: 'clear' });
    persistedLinesRef.current = [];
    persistCanvas([]);
  };

  // ─── Hint System (DRAWER dá dicas) - progressive: 1ª revela tamanho, depois letras ─
  const useHint = () => {
    if (!isDrawer || phase !== 'drawing' || !currentWord) return;
    if (hintsUsed >= MAX_HINTS) return;

    const word = currentWord.word;

    // DICA 1: revela quantidade de letras ( _ _ _ _ )
    if (hints.length === 0) {
      const newHints = word.split('').map(ch => (ch === ' ' || ch === '-' ? ch : '_'));
      const newHintsUsed = 1;
      setHints(newHints);
      setHintsUsed(newHintsUsed);
      const hintName = me?.nickname || 'Alguém';
      setHintToast({ name: hintName });
      setTimeout(() => setHintToast(null), 2200);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'hint_used',
        payload: { hints: newHints, hintsUsed: newHintsUsed, revealCount: true, name: hintName }
      });
      broadcastState({ hints: newHints, hintsUsed: newHintsUsed });
      persistWordHints(currentWord, newHints);
      setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `💡 Dica 1: a palavra tem ${word.replace(/[^a-zA-Z\u00C0-\u00FF]/g,'').length} letras`, isCorrect: false }]);
      soundService.playTick();
      return;
    }

    const unrevealed = hints.map((h, i) => h === '_' ? i : -1).filter(i => i >= 0);
    if (unrevealed.length === 0) return;

    const randomIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const letter = word[randomIdx];
    const newHints = [...hints];
    newHints[randomIdx] = letter;
    
    const newHintsUsed = hintsUsed + 1;
    setHints(newHints);
    setHintsUsed(newHintsUsed);
    const hintName2 = me?.nickname || 'Alguém';
    setHintToast({ name: hintName2 });
    setTimeout(() => setHintToast(null), 2200);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'hint_used',
      payload: { hints: newHints, hintsUsed: newHintsUsed, letter, name: hintName2 }
    });
    
    broadcastState({ hints: newHints, hintsUsed: newHintsUsed });
    persistWordHints(currentWord, newHints);
    setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `💡 Dica ${newHintsUsed}: a palavra contém a letra '${letter.toUpperCase()}'`, isCorrect: false }]);
  };

  // ─── Chat / Guess Logic ──────────────────────────────────────────
  const normalizeString = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || hasGuessedCorrectly || isDrawer) return;

    const msgText = guess.trim();
    setGuess('');
    setAlmostMsg('');

    if (isHost) {
      // HOST validates locally (has the real word)
      const normalizedGuess = normalizeString(msgText);
      const normalizedWord = currentWord ? normalizeString(currentWord.word) : '';
      const isCorrect = phase === 'drawing' && currentWord && normalizedGuess === normalizedWord;

      if (isCorrect) {
        setHasGuessedCorrectly(true);
        const guessedCount = localPlayersRef.current.filter(p => p.hasGuessed).length;
        const pts = Math.max(10, 100 - (guessedCount * 10));
        const drawerPts = Math.floor(pts / 2);

        setShowCorrectPopup({ points: pts });
        setTimeout(() => setShowCorrectPopup(null), 2500);

        setLocalPlayers(prev => {
          const updated = prev.map(p => {
            if (p.id === localPlayerId) return { ...p, score: (p.score || 0) + pts, hasGuessed: true };
            if (p.id === drawerIdRef.current) return { ...p, score: (p.score || 0) + drawerPts };
            return p;
          });
          const allGuessed = updated.filter(p => p.id !== drawerIdRef.current).every(p => p.hasGuessed);
          if (allGuessed) setTimeout(() => endRound(), 500);
          return updated;
        });
        channelRef.current?.send({
          type: 'broadcast',
          event: 'guess_correct',
          payload: { playerId: localPlayerId, nickname: me?.nickname, points: pts }
        });
        soundService.playCorrect();
        setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `✅ Você acertou! +${pts} pontos`, isCorrect: true }]);
      } else {
        // Almost correct check
        if (phase === 'drawing' && currentWord && normalizedWord.length > 0) {
          const dist = levenshtein(normalizedGuess, normalizedWord);
          const threshold = normalizedWord.length <= 4 ? 1 : 2;
          if (dist > 0 && dist <= threshold) {
            setAlmostMsg('🟠 Está quase! Tente de novo...');
            setTimeout(() => setAlmostMsg(''), 2000);
          }
        }
        const msg = { id: Math.random().toString(), sender: me?.nickname || 'Anon', text: msgText, isCorrect: false };
        setChatMessages(prev => [...prev, msg]);
        channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg });
      }
    } else {
      // NON-HOST: send guess to host for validation (do NOT send as chat to avoid leaking answer)
      const msgId = Math.random().toString();
      setChatMessages(prev => [...prev, { id: msgId, sender: me?.nickname || 'Anon', text: msgText, isCorrect: false }]);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'guess_attempt',
        payload: { playerId: localPlayerId, nickname: me?.nickname, text: msgText, msgId }
      });
    }
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  // ─── Color palette ──────────────────────────────────────────────
  const colors = [
    '#000000', '#FFFFFF', '#808080', '#C0C0C0',
    '#FF0000', '#FF6B6B', '#FF00FF', '#800080',
    '#0000FF', '#4169E1', '#00FFFF', '#008080',
    '#00FF00', '#32CD32', '#FFFF00', '#FFA500',
    '#8B4513', '#D2691E', '#FFD700', '#FFC0CB'
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#E8E9EC] text-[#0F172A] overflow-hidden">
      {/* Top Header - estilo menu principal (claro) */}
      <div className="bg-white px-3 md:px-4 py-2 flex items-center justify-between border-b border-slate-200 shadow-sm shrink-0 h-14 md:h-16 gap-2">
        <div className="flex items-center">
          <div className="bg-white px-2.5 md:px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
            <Timer className="text-[#1E3A5F] w-3.5 h-3.5 md:w-4 h-4" />
            <span className="text-[#1E3A5F] font-black text-sm md:text-lg tabular-nums">{time}s</span>
          </div>
        </div>

        <div className="flex-1 flex justify-center min-w-0 px-1">
          {phase === 'drawing' && (
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`bg-white border border-slate-200 px-3 md:px-5 py-1 rounded-full font-mono font-bold text-[#0F172A] shadow-sm flex items-center justify-center whitespace-nowrap overflow-visible ${
                (isDrawer ? (currentWord?.word.length || 0) : hints.length) > 20 ? 'text-[10px] md:text-sm tracking-widest' :
                (isDrawer ? (currentWord?.word.length || 0) : hints.length) > 15 ? 'text-xs md:text-base tracking-[0.15em]' :
                (isDrawer ? (currentWord?.word.length || 0) : hints.length) > 10 ? 'text-sm md:text-xl tracking-[0.2em]' :
                'text-base md:text-2xl tracking-[0.3em]'
              }`}>
                {isDrawer ? currentWord?.word : hints.length === 0 ? '🔒 • • •' : hints.join(' ')}
              </div>
              {!isDrawer && hints.length === 0 && (
                <span className="hidden md:block text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Dica 1 revela o tamanho</span>
              )}
              {!isDrawer && hints.length === 0 && (
                <span className="md:hidden text-[8px] font-black uppercase tracking-wider text-slate-400">Toque em Dica</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0 ml-1">
          <div className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-wider leading-none mb-0.5">Sala</div>
          <div className="text-[10px] md:text-sm font-black bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg leading-none text-slate-700">{roomId}</div>
        </div>
      </div>


      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative z-0">

        {/* Animação: <NOME> deu uma dica!! */}
        <AnimatePresence>
          {hintToast && (
            <motion.div
              initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="absolute top-3 min-[360px]:top-4 left-1/2 -translate-x-1/2 z-[70] bg-amber-400 border-2 border-amber-500 text-[#1a0533] px-3 min-[360px]:px-4 py-2.5 min-[360px]:py-3 rounded-2xl shadow-xl flex items-center gap-2.5 min-[360px]:gap-3 w-[92vw] max-w-[320px] min-[360px]:max-w-[360px] pointer-events-none"
            >
              <div className="w-10 h-10 min-[360px]:w-11 min-[360px]:h-11 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                <Lightbulb size={20} className="text-amber-500 min-[360px]:w-[22px] min-[360px]:h-[22px]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-black text-[13px] min-[360px]:text-sm leading-none truncate">{hintToast.name} deu uma dica!!</p>
                <p className="text-[11px] min-[360px]:text-xs font-bold opacity-70 leading-none mt-0.5">💡 Revelando letra...</p>
              </div>
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: 2, duration: 0.5, delay: 0.3 }}
                className="text-lg min-[360px]:text-xl shrink-0"
              >
                ✨
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selecting Word Overlay - tema claro */}
        {phase === 'selecting_word' && (
          <div className="absolute inset-0 z-50 bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            {/* Animated Countdown for everyone */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <AnimatePresence mode="wait">
                 {time <= 3 && time > 0 && (
                   <motion.div
                     key={`countdown-${time}`}
                     initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                     animate={{ scale: 1.5, opacity: 1, rotate: 0 }}
                     exit={{ scale: 3, opacity: 0, rotate: 10 }}
                     transition={{ duration: 0.5, type: 'spring' }}
                     className="text-[96px] min-[360px]:text-[120px] md:text-[200px] font-black text-[#1E3A5F] drop-shadow-sm italic"
                   >
                     {time}
                   </motion.div>
                 )}
              </AnimatePresence>
            </div>

            {isDrawer ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  className="bg-white p-5 min-[360px]:p-6 rounded-3xl border-2 border-slate-200 w-[92vw] max-w-[450px] min-h-[300px] md:min-h-[400px] h-auto py-6 min-[360px]:py-8 flex flex-col justify-center items-center text-center shadow-xl relative overflow-hidden z-20"
                >
                  <div className="mb-4 min-[360px]:mb-6">
                    <h2 className="text-xl min-[360px]:text-2xl md:text-3xl font-black text-[#1E3A5F] uppercase tracking-tight">Sua palavra é...</h2>
                  </div>
                  <div className="w-full px-2">
                    {wordChoices[0] && <SlotMachineWord finalWord={wordChoices[0].word} />}
                  </div>
                  <div className="mt-6 min-[360px]:mt-8 flex flex-col items-center gap-1">
                    <p className="text-slate-500 text-[11px] min-[360px]:text-xs md:text-sm font-black uppercase tracking-[0.2em]">Prepare-se para desenhar!</p>
                  </div>
                </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 1 }}
                animate={{ opacity: time <= 3 && time > 0 ? 0 : 1 }}
                className="text-center z-20 flex flex-col items-center justify-center pointer-events-none px-4"
              >
                <RefreshCw className="w-10 h-10 min-[360px]:w-12 min-[360px]:h-12 text-[#1E3A5F] animate-spin mx-auto mb-4 min-[360px]:mb-6 opacity-40" />
                <h2 className="text-xl min-[360px]:text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight text-center">Sorteando Palavra</h2>
                <p className="text-slate-500 mt-2 font-bold text-[13px] min-[360px]:text-sm text-center">O desenhista está se preparando...</p>
              </motion.div>
            )}

          </div>
        )}

        {/* Round End Overlay - tema claro */}
        {phase === 'round_end' && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center w-full max-w-2xl px-2">
                <h2 className="text-2xl min-[360px]:text-3xl md:text-4xl font-black text-[#1E3A5F] mb-4 min-[360px]:mb-6 uppercase tracking-tight">A palavra era:</h2>
                <div className="bg-white py-6 min-[360px]:py-8 px-6 min-[360px]:px-8 rounded-3xl border-2 border-slate-200 shadow-xl inline-block min-w-[280px] min-[360px]:min-w-[300px] max-w-[92vw] overflow-hidden">
                  <span className={`${(currentWord?.word.length || 0) > 15 ? 'text-2xl min-[360px]:text-3xl md:text-4xl' : (currentWord?.word.length || 0) > 10 ? 'text-3xl min-[360px]:text-4xl md:text-5xl' : 'text-4xl min-[360px]:text-6xl md:text-7xl'} font-black text-[#1E3A5F] uppercase tracking-tight block break-words`}>
                    {currentWord?.word}
                  </span>
                </div>
                <div className="mt-6 min-[360px]:mt-10 flex items-center justify-center gap-2 min-[360px]:gap-3">
                  <div className="w-6 min-[360px]:w-8 h-1 bg-slate-200 rounded-full"></div>
                  <p className="text-sm min-[360px]:text-xl font-bold text-slate-500 uppercase tracking-widest text-center">Próxima rodada em breve</p>
                  <div className="w-6 min-[360px]:w-8 h-1 bg-slate-200 rounded-full"></div>
                </div>
              </motion.div>
            </div>
        )}

        {/* Game Over Overlay - tema claro */}
        {phase === 'game_over' && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <h2 className="text-3xl min-[360px]:text-5xl font-black text-[#1E3A5F] mb-6 min-[360px]:mb-8 text-center">🏆 Fim de Jogo!</h2>
            <div className="bg-white p-4 min-[360px]:p-6 rounded-2xl w-full max-w-md border-2 border-slate-200 shadow-xl">
              {[...localPlayers].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                  <span className="font-bold flex items-center gap-2 text-slate-800 text-sm min-[360px]:text-base">
                    {i === 0 && '👑'} {i === 1 && '🥈'} {i === 2 && '🥉'}
                    {p.nickname}
                  </span>
                  <span className="font-black text-[#1E3A5F] text-sm min-[360px]:text-base">{p.score || 0} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ Correct Guess Popup (center overlay, LOCAL only) */}
        <AnimatePresence>
          {showCorrectPopup && (
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-green-500/90 backdrop-blur-md text-white px-10 py-6 rounded-3xl shadow-[0_0_60px_rgba(34,197,94,0.5)] text-center">
                <div className="text-5xl mb-2">✅</div>
                <div className="text-2xl font-black">Você acertou!</div>
                <div className="text-4xl font-black text-[#FFD700] mt-1">+{showCorrectPopup.points} pts</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════ Canvas Area ═══════════ */}
        <div className="flex-1 flex flex-col items-stretch min-h-0 relative overflow-hidden">
          {/* Canvas - sempre branco para desenhar, borda estilo menu principal */}
          <div className="flex-1 min-h-0 w-full rounded-none border border-slate-200 relative overflow-hidden bg-white shadow-inner">
            <DrawingCanvasView
              ref={canvasRef}
              isDrawer={isDrawer && phase === 'drawing'}
              onDraw={handleDraw}
              onDrawMove={isDrawer && phase === 'drawing' ? handleDrawMove : undefined}
              onClear={handleClearCanvas}
              externalLines={externalLines}
              activeExternalLine={!isDrawer ? activeExternalLine : null}
              color={color}
              strokeWidth={brushSize}
              tool={tool}
            />
            {/* Bolhas - só desenhista, some rápido, pequena pra não tampar */}
            {isDrawer && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <AnimatePresence>
                  {floatingBubbles.map(b => {
                    const isSys = b.sender === 'Sistema';
                    const bubbleColor = b.isCorrect ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg' : isSys && b.text.includes('💡') ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-white/95 backdrop-blur text-slate-800 border-slate-200 shadow-md';
                    return (
                      <motion.div
                        key={b.id}
                        initial={{ y: 20, opacity: 0, scale: 0.92 }}
                        animate={{ y: -55, opacity: 1, scale: 1 }}
                        exit={{ y: -90, opacity: 0, scale: 0.9 }}
                        transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
                        className={`absolute bottom-4 px-2.5 py-1.5 rounded-xl border text-[11px] md:text-xs font-bold max-w-[62%] md:max-w-[55%] flex items-center gap-1 ${bubbleColor}`}
                        style={{ left: `${b.x}%`, transform: 'translateX(-50%)' }}
                      >
                        <span className="truncate leading-tight">
                          <span className="opacity-60 text-[9px] mr-1 font-black">{b.sender}:</span>{b.text}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Toolbar - tema claro menu principal */}
          {isDrawer && phase === 'drawing' && (
            <div className="bg-white px-2 min-[360px]:px-3 py-3 flex flex-col gap-2.5 w-full border-t border-slate-200 shrink-0 shadow-sm">
              {/* Linha 1: Ferramentas + undo/redo + ações */}
              <div className="flex items-center justify-between gap-1.5 min-[360px]:gap-2 w-full">
                <div className="flex bg-slate-100 p-1 min-[360px]:p-1.5 rounded-2xl gap-1 min-[360px]:gap-1.5 shrink-0 border border-slate-200">
                  <button onClick={() => setTool('pen')} className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 border-2 ${tool === 'pen' ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-sm scale-105' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Pencil size={18} strokeWidth={2.5} className="min-[360px]:w-5 min-[360px]:h-5 md:w-[18px] md:h-[18px]" />
                  </button>
                  <button onClick={() => setTool('eraser')} className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 border-2 ${tool === 'eraser' ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-sm scale-105' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <Eraser size={18} strokeWidth={2.5} className="min-[360px]:w-5 min-[360px]:h-5 md:w-[18px] md:h-[18px]" />
                  </button>
                  <button onClick={() => setTool('bucket')} className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 border-2 ${tool === 'bucket' ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-sm scale-105' : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`} title="Balde">
                    <PaintBucket size={18} strokeWidth={2.5} className="min-[360px]:w-5 min-[360px]:h-5 md:w-[18px] md:h-[18px]" />
                  </button>
                  <div className="w-px h-6 bg-slate-200 self-center mx-1 hidden md:block" />
                  <button onClick={handleUndo} disabled={!canUndoState} className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 border-2 ${canUndoState ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50' : 'text-slate-300 bg-slate-50 border-slate-200'}`}>
                    <Undo2 size={16} className="min-[360px]:w-[18px] min-[360px]:h-[18px]" />
                  </button>
                  <button onClick={handleRedo} disabled={!canRedoState} className={`w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 border-2 ${canRedoState ? 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50' : 'text-slate-300 bg-slate-50 border-slate-200'}`}>
                    <Redo2 size={16} className="min-[360px]:w-[18px] min-[360px]:h-[18px]" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 min-[360px]:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={useHint}
                    disabled={hintsUsed >= MAX_HINTS}
                    className={`h-9 min-[360px]:h-10 px-2.5 min-[360px]:px-3 rounded-xl font-black text-[11px] min-[360px]:text-xs flex items-center gap-1 min-[360px]:gap-1.5 transition-all active:scale-95 shadow-sm shrink-0 border-2 ${hintsUsed >= MAX_HINTS ? 'bg-slate-100 text-slate-400 border-slate-200' : hints.length === 0 ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse' : 'bg-white text-[#1E3A5F] border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Lightbulb size={14} strokeWidth={3} className="min-[360px]:w-4 min-[360px]:h-4" />
                    <span className="hidden min-[360px]:inline">{hints.length === 0 ? 'Tamanho' : `Dica ${hintsUsed}/${MAX_HINTS}`}</span>
                    <span className="min-[360px]:hidden">{hints.length === 0 ? 'Tam' : hintsUsed}</span>
                  </button>
                  <button onClick={() => setShowClearConfirm(true)} className="w-9 h-9 min-[360px]:w-10 min-[360px]:h-10 min-[375px]:w-11 min-[375px]:h-11 bg-white border-2 border-red-200 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 rounded-xl md:rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0" title="Apagar desenho">
                    <Trash2 size={16} strokeWidth={2.5} className="min-[360px]:w-[18px] min-[360px]:h-[18px] min-[375px]:w-5 min-[375px]:h-5" />
                  </button>
                </div>
              </div>
              {/* Linha 2: Cores + espessura - tema claro */}
              <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar pb-1">
                <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl shrink-0 border border-slate-200">
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => { setColor(c); if(tool === 'eraser') setTool('pen'); }}
                      className={`w-7 h-7 md:w-6 md:h-6 rounded-full border-2 transition-all active:scale-90 shrink-0 ${color === c && (tool === 'pen' || tool === 'bucket') ? 'border-[#1E3A5F] scale-110 shadow-[0_0_8px_rgba(30,58,95,0.3)]' : 'border-slate-300 hover:border-slate-400 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl gap-1 items-center shrink-0 ml-auto border border-slate-200">
                  {[2, 5, 10, 20].map(s => (
                    <button key={s} onClick={() => setBrushSize(s)} className={`w-8 h-8 md:w-7 md:h-7 flex items-center justify-center rounded-xl transition-all active:scale-90 border-2 ${brushSize === s ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-sm' : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <div className="bg-current rounded-full" style={{ width: Math.min(16, Math.max(4, s * 0.85)), height: Math.min(16, Math.max(4, s * 0.85)) }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - tema claro menu principal */}
        <div className={`w-full md:w-80 bg-white flex flex-col md:border-l border-slate-200 shrink-0 md:max-h-none md:flex-none shadow-[0_-12px_40px_rgba(15,23,42,0.08)] md:shadow-lg relative z-10 rounded-t-[20px] md:rounded-t-none -mt-3 md:mt-0 border-t border-slate-200 md:border-t-0 overflow-hidden ${isDrawer && isMobile ? 'max-h-[22dvh]' : 'max-h-[42dvh]'}`}>
          {/* Handle mobile */}
          <div className="md:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2 mb-1 shrink-0" />

          {/* Players - horizontal chips */}
          <div className="px-2 md:px-4 py-2 border-b border-slate-200 shrink-0 bg-slate-50 md:bg-white">
            <div className="hidden md:flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-[#FFD700] uppercase tracking-[0.2em] opacity-80">Jogadores</h3>
              <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full">{localPlayers.length}</span>
            </div>
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:max-h-[18vh] no-scrollbar pb-1 md:pb-0 snap-x">
              {localPlayers.map(p => {
                const isDrawer = p.id === drawerId;
                const guessed = p.hasGuessed;
                return (
                  <div key={p.id} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-sm border-2 shrink-0 min-w-[124px] md:min-w-0 snap-start transition-all shadow-sm ${
                    isDrawer ? 'bg-white text-[#1E3A5F] border-[#1E3A5F] shadow-sm' :
                    guessed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    'bg-white text-slate-700 border-slate-200'
                  }`}>
                    <div className="relative shrink-0">
                      {p.avatar ? (
                        <img src={p.avatar.startsWith('http') || p.avatar.startsWith('data:') ? p.avatar : `/ccb/${p.avatar}`} alt={p.nickname} className="w-8 h-8 rounded-xl object-cover border-2 border-slate-200 shadow-sm" onError={e => (e.currentTarget.style.display='none')} />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center font-black text-xs text-slate-600">{p.nickname.charAt(0).toUpperCase()}</div>
                      )}
                      {isDrawer && <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#1E3A5F] border-2 border-white rounded-full flex items-center justify-center shadow-sm"><Pencil size={10} className="text-white" /></span>}
                      {guessed && !isDrawer && <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm"><Check size={10} className="text-white" /></span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate leading-none">{p.nickname}</p>
                      <p className={`text-[10px] font-black leading-none mt-0.5 ${isDrawer ? 'text-[#1E3A5F]' : guessed ? 'text-emerald-700' : 'text-slate-500'}`}>{isDrawer ? 'Desenhando' : guessed ? 'Acertou!' : 'Adivinhando'}</p>
                    </div>
                    <span className={`font-black text-xs px-2 py-1 rounded-lg shrink-0 border ${isDrawer ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : guessed ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>{p.score || 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat - desenhista no celular não vê (bolhas sobem), adivinhadores veem normal */}
          <div className={`flex-1 overflow-y-auto p-2.5 md:p-4 flex flex-col gap-2 min-h-0 relative bg-slate-50 ${isDrawer && isMobile ? 'hidden md:flex' : ''}`} ref={chatRef}>
            <div className="hidden md:block text-center text-[10px] font-black text-slate-400 my-2 uppercase tracking-[0.2em] bg-white border border-slate-200 py-1 rounded-full mx-8">Histórico</div>
            {chatMessages.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Nenhum palpite ainda</p>
                <p className="text-[11px] mt-1 hidden md:block text-slate-400">As mensagens também aparecem como bolhas</p>
                <p className="text-[11px] mt-1 md:hidden text-slate-400">Toque nas bolhas que sobem ⬆️</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`px-3 py-2 rounded-2xl text-[13px] md:text-sm break-words shadow-sm flex gap-2 items-start border ${msg.isCorrect ? 'bg-emerald-500 text-white font-bold border-emerald-600' : msg.text.startsWith('💡') ? 'bg-amber-50 text-amber-900 font-bold border-amber-200' : 'bg-white text-slate-800 border-slate-200'}`}>
                <span className={`font-black shrink-0 text-xs px-1.5 py-0.5 rounded-lg ${msg.isCorrect ? 'bg-white/20 text-white' : msg.text.startsWith('💡') ? 'bg-amber-500 text-white' : 'bg-[#1E3A5F] text-white'}`}>{msg.sender.slice(0,8)}</span>
                <span className="flex-1 leading-snug">{msg.text}</span>
              </div>
            ))}
          </div>

          {/* Almost correct message (LOCAL only) */}
          <AnimatePresence>
            {almostMsg && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 bg-orange-50 border-t border-orange-200 text-orange-700 text-sm font-bold text-center"
              >
                {almostMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input - desenhista no celular não precisa (só vê bolhas) */}
          <form onSubmit={handleSendChat} className={`p-2.5 md:p-4 bg-white shrink-0 border-t border-slate-200 relative pb-[max(0.6rem,env(safe-area-inset-bottom))] ${isDrawer && isMobile ? 'hidden md:block' : ''}`}>
            <div className="relative flex gap-2">
              <input
                type="text"
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder={isDrawer ? "✏️ Você desenha..." : hasGuessedCorrectly ? "✅ Já acertou! Aguarde" : "💬 Palpite..."}
                disabled={isDrawer || hasGuessedCorrectly || phase !== 'drawing'}
                className="flex-1 bg-white border-2 border-slate-200 focus:border-[#FFD700] rounded-2xl px-4 py-3.5 text-[#1a0533] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#FFD700]/20 disabled:opacity-50 disabled:bg-slate-100 transition-all font-bold text-[15px] shadow-sm"
                maxLength={50}
                autoComplete="off"
                autoCorrect="off"
              />
              {!isDrawer && !hasGuessedCorrectly && phase === 'drawing' ? (
                <button type="submit" disabled={!guess.trim()} className="w-12 h-[52px] bg-[#FFD700] text-[#1a0533] rounded-2xl flex items-center justify-center hover:bg-white active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 shadow-md shrink-0">
                  <ArrowRight size={22} strokeWidth={3} />
                </button>
              ) : isDrawer ? (
                <div className="hidden md:flex w-12 h-[52px] bg-slate-100 border-2 border-slate-200 rounded-2xl items-center justify-center text-slate-400 shrink-0"><Pencil size={18} /></div>
              ) : null}
            </div>
            <p className="md:hidden text-[10px] font-bold text-slate-400 text-center mt-1.5 tracking-wide">{phase === 'drawing' ? (isDrawer ? 'Desenhe para os amigos adivinharem' : 'As mensagens sobem como bolhas ⬆️') : 'Aguardando...'}</p>
          </form>
        </div>
      </div>

      {/* Confirmação Apagar Desenho - responsivo 320px até tablet */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[20px] min-[360px]:rounded-3xl p-5 min-[360px]:p-6 w-[92vw] max-w-[340px] min-[375px]:w-full shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="w-14 h-14 min-[360px]:w-16 min-[360px]:h-16 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center justify-center mx-auto shrink-0">
                <Trash2 size={28} className="text-red-600 min-[360px]:w-7 min-[360px]:h-7" strokeWidth={2.5} />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-[15px] min-[360px]:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">Deseja excluir o desenho?</h3>
                <p className="text-[12px] min-[360px]:text-[13px] font-semibold text-slate-500 leading-snug">Todo o desenho será apagado para todos e não pode ser desfeito.</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 min-[360px]:gap-3 pt-1">
                <button
                  onClick={() => { soundService.playClick(); setShowClearConfirm(false); }}
                  className="py-3 min-[360px]:py-3.5 rounded-xl min-[360px]:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[11px] min-[360px]:text-xs tracking-widest transition-colors border border-slate-200 active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { soundService.playClick(); setShowClearConfirm(false); handleClearCanvas(); }}
                  className="py-3 min-[360px]:py-3.5 rounded-xl min-[360px]:rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] min-[360px]:text-xs tracking-widest transition-colors shadow-md active:scale-[0.98] border border-red-700"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Loader = ({ className }: { className?: string }) => <RefreshCw className={`animate-spin ${className}`} />;
