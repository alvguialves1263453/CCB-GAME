import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Eraser, Trash2, Check, RefreshCw, Lightbulb, ArrowRight, Undo2, Redo2, PaintBucket } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { soundService } from '../lib/soundService';
import { DrawingCanvasView, type DrawingLine, type DrawingCanvasRef } from './DrawingComponents';

const TOTAL_TIME = 80;
const MAX_HINTS = 3;

function SlotMachineWord({ finalWord }: { finalWord: string }) {
  const [displayWord, setDisplayWord] = useState('...');

  // Scale font size based on word length
  const len = finalWord.length;
  const fontSizeClass = len > 15 ? 'text-xl md:text-2xl' :
    len > 12 ? 'text-2xl md:text-3xl' :
      len > 8 ? 'text-3xl md:text-4xl' :
        'text-4xl md:text-5xl';

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
    <div className="w-full h-24 md:h-32 bg-white/10 rounded-xl border-2 border-[#FFD700]/50 tracking-widest uppercase shadow-[inset_0_0_20px_rgba(255,215,0,0.1)] flex items-center justify-center p-4">
      <span className={`${fontSizeClass} font-black text-white text-center break-all`}>
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
  const hasGuessedCorrectlyRef = useRef(false);

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
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);
  useEffect(() => { drawerIdRef.current = drawerId; }, [drawerId]);
  useEffect(() => { localPlayersRef.current = localPlayers; }, [localPlayers]);
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

    channel
      .on('broadcast', { event: 'game_state' }, ({ payload }) => {
        if (!isHost) {
          if (payload.phase) {
            setPhase(payload.phase);
            // Reset per-round state when a new round phase starts
            if (payload.phase === 'selecting_word') {
              // New round starting — clear guessed state for all clients
              setHasGuessedCorrectly(false);
              hasGuessedCorrectlyRef.current = false;
              setAlmostMsg('');
              setShowCorrectPopup(null);
              setGuess('');
            } else if (payload.phase === 'drawing') {
              // Drawing restarted — make sure guess is cleared
              setAlmostMsg('');
              setGuess('');
            } else if (payload.phase === 'round_end') {
              // Round ended — prepare reset for next round
              setHasGuessedCorrectly(false);
              hasGuessedCorrectlyRef.current = false;
              setAlmostMsg('');
            }
          }
          if (payload.drawerId) setDrawerId(payload.drawerId);
          if (payload.time !== undefined) setTime(payload.time);
          if (payload.wordLength && !payload.currentWord) {
            const currentDrawer = payload.drawerId || drawerIdRef.current;
            if (currentDrawer !== localPlayerId) {
              setCurrentWord({ word: '_'.repeat(payload.wordLength), category: payload.category });
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
        soundService.playCorrect(); // Small sound for hint
        setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `💡 Uma dica foi revelada!`, isCorrect: false }]);
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
          broadcastState({ time: t - 1 });
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
          if (currentWord && nextT === 45 && currentWord.word.length > 2) {
            const h = [...hints];
            h[0] = currentWord.word[0];
            setHints(h);
            broadcastState({ hints: h });
          }
          if (currentWord && nextT === 20 && currentWord.word.length > 4) {
            const h = [...hints];
            h[currentWord.word.length - 1] = currentWord.word[currentWord.word.length - 1];
            setHints(h);
            broadcastState({ hints: h });
          }
          broadcastState({ time: nextT });
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
    const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
    const choices = shuffled.length > 0 ? [shuffled[0]] : [{ word: 'ERRO', category: 'N/A' }];
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
    setHints(Array(wordObj.word.length).fill('_'));
    setHasGuessedCorrectly(false);

    broadcastState({
      phase: 'drawing',
      drawerId: drawerId,
      time: 80,
      wordLength: wordObj.word.length,
      category: wordObj.category,
      hints: Array(wordObj.word.length).fill('_')
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

  // ─── Drawing callbacks (from DrawingCanvasView) ──────────────────
  const handleDraw = (line: DrawingLine) => {
    // Broadcast complete line to other players
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_line',
      payload: { line }
    });
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
  };

  // ─── Hint System (DRAWER gives hints to everyone) ────────────────
  const useHint = () => {
    if (!isDrawer || phase !== 'drawing' || !currentWord) return;
    if (hintsUsed >= MAX_HINTS) return;

    const word = currentWord.word;
    const unrevealed = hints.map((h, i) => h === '_' ? i : -1).filter(i => i >= 0);
    if (unrevealed.length === 0) return;

    const randomIdx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const letter = word[randomIdx];
    const newHints = [...hints];
    newHints[randomIdx] = letter;
    
    const newHintsUsed = hintsUsed + 1;
    setHints(newHints);
    setHintsUsed(newHintsUsed);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'hint_used',
      payload: { hints: newHints, hintsUsed: newHintsUsed, letter }
    });
    
    // Also broadcast via game_state for late joiners or sync
    broadcastState({ hints: newHints, hintsUsed: newHintsUsed });
    setChatMessages(prev => [...prev, { id: Math.random().toString(), sender: 'Sistema', text: `💡 Dica: a palavra contém a letra '${letter.toUpperCase()}'`, isCorrect: false }]);
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
    <div className="flex flex-col h-[100dvh] w-full bg-[#1a0533] text-white overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2D1B69] to-[#1a0533]">
      {/* Top Header */}
      <div className="bg-[#2D1B69]/90 backdrop-blur-md px-3 md:px-4 py-2 flex items-center justify-between border-b border-white/10 shadow-lg shrink-0 h-14 md:h-16 gap-2">
        <div className="flex items-center">
          <div className="bg-[#1a0533] px-2 md:px-3 py-1 rounded-2xl border-2 border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.2)] flex items-center gap-1 md:gap-1.5">
            <Timer className="text-[#FFD700] w-3.5 h-3.5 md:w-4 h-4" />
            <span className="text-[#FFD700] font-black text-sm md:text-lg tabular-nums">{time}s</span>
          </div>
        </div>

        <div className="flex-1 flex justify-center min-w-0">
          {phase === 'drawing' && (
            <div className="bg-white/5 border border-white/10 px-3 md:px-5 py-0.5 md:py-1.5 rounded-full text-base md:text-2xl tracking-[0.2em] md:tracking-[0.3em] font-mono font-bold text-white shadow-inner truncate max-w-full">
              {isDrawer ? currentWord?.word : hints.join(' ')}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div className="text-[10px] font-black text-[#FFD700] uppercase tracking-wider opacity-80 leading-none mb-0.5">Sala</div>
          <div className="text-xs md:text-base font-bold bg-white/10 px-2 py-0.5 rounded leading-none">{roomId}</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative z-0">

        {/* Selecting Word Overlay */}
        {phase === 'selecting_word' && (
          <div className="absolute inset-0 z-50 bg-[#1a0533]/90 flex flex-col items-center justify-center p-4">
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
                     className="text-[120px] md:text-[200px] font-black text-[#FFD700] drop-shadow-[0_0_30px_rgba(255,215,0,0.5)] italic"
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
                  className="bg-[#2D1B69] p-6 rounded-3xl border-4 border-[#FFD700] w-[90vw] max-w-[450px] h-[320px] md:h-[400px] flex flex-col justify-center items-center text-center shadow-[0_0_50px_rgba(255,215,0,0.3)] relative overflow-hidden z-20"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl md:text-3xl font-black text-[#FFD700] uppercase tracking-tighter">Sua palavra é...</h2>
                  </div>
                  <div className="w-full px-2">
                    {wordChoices[0] && <SlotMachineWord finalWord={wordChoices[0].word} />}
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-1">
                    <p className="opacity-60 text-xs md:text-sm font-black uppercase tracking-[0.2em]">Prepare-se para desenhar!</p>
                  </div>
                </motion.div>
            ) : (
              <div className="text-center z-20">
                <RefreshCw className="w-12 h-12 text-[#FFD700] animate-spin mx-auto mb-6 opacity-30" />
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">Sorteando Palavra</h2>
                <p className="opacity-70 mt-2 font-bold text-white/50">O desenhista está se preparando...</p>
              </div>
            )}

          </div>
        )}

        {/* Round End Overlay */}
        {phase === 'round_end' && (
            <div className="absolute inset-0 z-50 bg-[#1a0533]/90 flex flex-col items-center justify-center p-4">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center w-full max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-black text-[#FFD700] mb-6 uppercase tracking-widest">A palavra era:</h2>
                <div className="bg-[#2D1B69] py-8 px-8 rounded-3xl border-4 border-[#FFD700]/30 shadow-2xl inline-block min-w-[300px] max-w-[full] overflow-hidden">
                  <span className={`${(currentWord?.word.length || 0) > 15 ? 'text-3xl md:text-4xl' : (currentWord?.word.length || 0) > 10 ? 'text-4xl md:text-5xl' : 'text-6xl md:text-7xl'} font-black text-white uppercase tracking-tighter block break-words`}>
                    {currentWord?.word}
                  </span>
                </div>
                <div className="mt-10 flex items-center justify-center gap-3">
                  <div className="w-8 h-1 bg-[#FFD700]/30 rounded-full"></div>
                  <p className="text-xl font-bold text-white/70 uppercase tracking-widest">Próxima rodada em breve</p>
                  <div className="w-8 h-1 bg-[#FFD700]/30 rounded-full"></div>
                </div>
              </motion.div>
            </div>
        )}

        {/* Game Over Overlay */}
        {phase === 'game_over' && (
          <div className="absolute inset-0 z-50 bg-[#1a0533]/95 flex flex-col items-center justify-center p-4">
            <h2 className="text-5xl font-black text-[#FFD700] mb-8">🏆 Fim de Jogo!</h2>
            <div className="bg-[#2D1B69] p-6 rounded-2xl w-full max-w-md">
              {[...localPlayers].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center py-3 border-b border-white/10 last:border-0">
                  <span className="font-bold flex items-center gap-2">
                    {i === 0 && '👑'} {i === 1 && '🥈'} {i === 2 && '🥉'}
                    {p.nickname}
                  </span>
                  <span className="font-black text-[#FFD700]">{p.score || 0} pts</span>
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
          {/* Canvas fills ALL remaining space — no padding, no max-width */}
          <div className="flex-1 min-h-0 w-full rounded-none shadow-[inset_0_0_0_3px_rgba(255,255,255,0.15)] relative overflow-hidden">
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
          </div>

          {/* ═══════════ Drawing Toolbar ═══════════ */}
          {isDrawer && phase === 'drawing' && (
            <div className="bg-[#2D1B69]/95 backdrop-blur-sm px-2 py-2 flex flex-wrap gap-2 md:gap-3 w-full justify-center items-center border-t border-white/10 shadow-xl shrink-0">
              {/* Tool toggle */}
              <div className="flex bg-[#1a0533] p-1 rounded-lg gap-1 shrink-0">
                <button onClick={() => setTool('pen')} className={`p-1.5 rounded-md transition-all ${tool === 'pen' ? 'bg-[#FFD700] text-[#1a0533] shadow-md scale-105' : 'text-white hover:bg-white/10'}`}>
                  <Pencil size={18} strokeWidth={2.5} />
                </button>
                <button onClick={() => setTool('eraser')} className={`p-1.5 rounded-md transition-all ${tool === 'eraser' ? 'bg-[#FFD700] text-[#1a0533] shadow-md scale-105' : 'text-white hover:bg-white/10'}`}>
                  <Eraser size={18} strokeWidth={2.5} />
                </button>
                <button onClick={() => setTool('bucket')} className={`p-1.5 rounded-md transition-all ${tool === 'bucket' ? 'bg-[#FFD700] text-[#1a0533] shadow-md scale-105' : 'text-white hover:bg-white/10'}`} title="Balde de Tinta">
                  <PaintBucket size={18} strokeWidth={2.5} />
                </button>
              </div>


              {/* Color palette */}
              <div className="flex flex-wrap gap-1 bg-[#1a0533] p-1 rounded-lg px-2 max-w-[180px] md:max-w-[210px] shrink-0 justify-center">
                {colors.map(c => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); if(tool === 'eraser') setTool('pen'); }}
                    className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 transition-all ${color === c && (tool === 'pen' || tool === 'bucket') ? 'border-[#FFD700] scale-125 shadow-[0_0_8px_rgba(255,215,0,0.8)] z-10' : 'border-white/20 hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}

              </div>

              {/* Brush size */}
              <div className="flex bg-[#1a0533] p-1 rounded-lg gap-1.5 items-center px-2 shrink-0">
                <span className="hidden sm:block text-[9px] font-black uppercase opacity-40 mr-1">Tam</span>
                {[2, 5, 10, 20].map(s => (
                  <button key={s} onClick={() => setBrushSize(s)} className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${brushSize === s ? 'bg-[#FFD700]/20 ring-2 ring-[#FFD700]' : 'hover:bg-white/10'}`}>
                    <div className="bg-white rounded-full shadow-sm" style={{ width: Math.max(3, s / 1.5), height: Math.max(3, s / 1.5) }} />
                  </button>
                ))}
              </div>

              {/* Undo/Redo buttons */}
              <div className="flex bg-[#1a0533] p-1 rounded-lg gap-1 shrink-0">
                <button
                  onClick={handleUndo}
                  disabled={!canUndoState}
                  className={`p-1.5 rounded-md transition-all ${canUndoState ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
                  title="Desfazer"
                >
                  <Undo2 size={18} />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedoState}
                  className={`p-1.5 rounded-md transition-all ${canRedoState ? 'text-white hover:bg-white/10 active:scale-95' : 'text-white/20 cursor-not-allowed'}`}
                  title="Refazer"
                >
                  <Redo2 size={18} />
                </button>
              </div>

              <div className="flex gap-2 ml-auto sm:ml-0 shrink-0">
                {/* Hint button (drawer gives hints) */}
                <button
                  type="button"
                  onClick={useHint}
                  disabled={hintsUsed >= MAX_HINTS}
                  className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all ${hintsUsed >= MAX_HINTS
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-yellow-500 text-[#1a0533] hover:bg-yellow-400 active:scale-95 shadow-lg'
                    }`}
                  title={`Dar dica (${MAX_HINTS - hintsUsed} restantes)`}
                >
                  <Lightbulb size={16} strokeWidth={3} />
                  <span className="hidden sm:inline">Dica</span>
                  <span className="sm:hidden">{MAX_HINTS - hintsUsed}</span>
                </button>

                {/* Clear button */}
                <button onClick={handleClearCanvas} className="bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white p-1.5 rounded-lg transition-all">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ Sidebar (Players & Chat) ═══════════ */}
        <div className="w-full md:w-80 bg-[#1a0533]/90 md:bg-[#1a0533] flex flex-col md:border-l border-white/10 shrink-0 max-h-[28vh] md:max-h-none md:flex-none shadow-2xl relative z-10">

          {/* Players (Desktop: List, Mobile: Horizontal Row) */}
          <div className="p-2 md:p-4 border-b border-white/10 shrink-0 md:max-h-[35%] md:overflow-y-auto flex md:flex-col overflow-x-auto no-scrollbar gap-2 md:gap-3 bg-[#2D1B69]/30 md:bg-transparent">
            <h3 className="hidden md:block text-xs font-black text-[#FFD700] uppercase tracking-[0.2em] opacity-80">Jogadores</h3>
            {localPlayers.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-white/5 md:bg-white/10 px-3 md:px-4 py-2 rounded-xl text-sm border border-white/5 shrink-0 min-w-[120px] md:min-w-0 transition-all hover:bg-white/10">
                <div className="flex items-center gap-2 truncate">
                  {p.id === drawerId && <div className="bg-[#FFD700]/20 p-1 rounded-md"><Pencil size={12} className="text-[#FFD700]" /></div>}
                  {p.hasGuessed && <div className="bg-green-500/20 p-1 rounded-md"><Check size={12} className="text-green-400" /></div>}
                  <span className="truncate font-bold md:font-semibold">{p.nickname}</span>
                </div>
                <span className="font-black text-[#FFD700] ml-3 md:ml-2 bg-[#1a0533] px-2 py-0.5 rounded-md text-xs">{p.score || 0}</span>
              </div>
            ))}
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-2.5 min-h-0 relative" ref={chatRef}>
            <div className="text-center text-xs font-bold opacity-40 my-3 uppercase tracking-widest bg-white/5 py-1 rounded-full mx-8">Bem-vindo ao chat!</div>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`p-2.5 rounded-xl text-sm break-words shadow-sm ${msg.isCorrect ? 'bg-green-500/20 text-green-300 font-bold border border-green-500/30' : msg.text.startsWith('💡') ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30' : 'bg-white/10 border border-white/5'}`}>
                <span className={`font-black mr-2 drop-shadow-md ${msg.isCorrect ? 'text-green-400' : msg.text.startsWith('💡') ? 'text-yellow-400' : 'text-[#FFD700]'}`}>{msg.sender}:</span>
                <span className="opacity-90">{msg.text}</span>
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
                className="px-3 py-2 bg-orange-500/20 border-t border-orange-500/30 text-orange-300 text-sm font-bold text-center"
              >
                {almostMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Guess input */}
          <form onSubmit={handleSendChat} className="p-3 md:p-4 bg-[#2D1B69] shrink-0 border-t border-white/10 relative">
            <div className="relative">
              <input
                type="text"
                value={guess}
                onChange={e => setGuess(e.target.value)}
                placeholder={isDrawer ? "Você está desenhando..." : hasGuessedCorrectly ? "Você já acertou!" : "Digite seu palpite..."}
                disabled={isDrawer || hasGuessedCorrectly || phase !== 'drawing'}
                className="w-full bg-[#1a0533] border-2 border-white/10 focus:border-[#FFD700] rounded-2xl px-5 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-4 focus:ring-[#FFD700]/20 disabled:opacity-50 transition-all font-semibold shadow-inner pr-12"
                maxLength={50}
              />
              {!isDrawer && !hasGuessedCorrectly && phase === 'drawing' && (
                <button type="submit" disabled={!guess.trim()} className="absolute right-2 top-2 bottom-2 bg-[#FFD700] text-[#1a0533] w-10 rounded-xl flex items-center justify-center hover:bg-white active:scale-95 transition-all disabled:opacity-0">
                  <ArrowRight size={20} strokeWidth={3} />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const Loader = ({ className }: { className?: string }) => <RefreshCw className={`animate-spin ${className}`} />;
