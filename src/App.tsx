import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, ChevronRight, ArrowLeft, ArrowRight, Play, Trophy, Timer, Loader2, RefreshCw } from "lucide-react";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { fetchHymns, generateQuestions, type Hymn, type Question } from "./services/hymnService";
import { multiplayerService, type Room, type Player as DBPlayer } from "./services/multiplayerService";

type ViewState = "home" | "multiplayer_setup" | "lobby" | "game" | "ranking" | "hymn_list";

interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  score: number;
  hasAnswered: boolean;
  lastAnswerTime: number;
  isReady?: boolean;
}

const ROUNDS_COUNT = 5;
const ROUND_TIME = 10; // seconds

export default function App() {
  const [view, setView] = useState<ViewState>("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [nickname, setNickname] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME * 1000);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; option: string } | null>(null);
  
  const [showResult, setShowResult] = useState(false);
  const [isSolo, setIsSolo] = useState(true);
  const [botCount, setBotCount] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastHitTimeRef = useRef<number>(0);

  // Refs for reliable socket callbacks
  const isGameActiveRef = useRef(isGameActive);
  const showResultRef = useRef(showResult);
  const currentRoundRef = useRef(currentRound);
  const questionsRef = useRef(questions);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);

  useEffect(() => {
    isGameActiveRef.current = isGameActive;
    showResultRef.current = showResult;
    currentRoundRef.current = currentRound;
    questionsRef.current = questions;
    feedbackRef.current = feedback;
    selectedOptionRef.current = selectedOption;
  });

  // Check for room in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setIsSolo(false);
      setView("multiplayer_setup");
    }
  }, []);

  // Handle Multiplayer Subscriptions
  useEffect(() => {
    if (!roomId || isSolo) return;

    const unsubscribe = multiplayerService.subscribeToRoom(
      roomId,
      (dbPlayers) => {
        setPlayers(prev => {
          return dbPlayers.map(dbp => {
            const existing = prev.find(p => p.id === dbp.id);
            return {
              id: dbp.id,
              nickname: dbp.nickname,
              isHost: dbp.isHost,
              isReady: dbp.isReady,
              score: dbp.score || 0,
              hasAnswered: dbp.hasAnswered || false,
              lastAnswerTime: existing?.lastAnswerTime || 0
            };
          });
        });
      },
      (room) => {
        if (room.gameStarted && view !== "game" && room.questions) {
          setQuestions(room.questions);
          setCurrentRound(0);
          startRound(0);
          setView("game");
        } else if (!room.gameStarted && (view === "game" || view === "ranking")) {
          setView("lobby");
        }
      },
      () => {
        // onRoundEnd
        if (isGameActiveRef.current && !showResultRef.current) {
          handleRoundEnd();
        }
      },
      () => {
        // onNextRound
        if (currentRoundRef.current + 1 < ROUNDS_COUNT) {
          startRound(currentRoundRef.current + 1);
        } else {
          setView("ranking");
        }
      },
      () => {
        // onGameReset
        setView("lobby");
      }
    );

    return () => unsubscribe();
  }, [roomId, isSolo, view]);

  // Load all hymns
  const loadHymns = async () => {
    setIsLoading(true);
    try {
      const loadedHymns = await fetchHymns();
      setHymns(loadedHymns);
    } catch (error) {
      console.error("Error loading hymns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHymns();

    // Subscribe to hymn changes to keep syncing always
    const hymnSubscription = supabase
      .channel("hymn_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hymn_snippets",
        },
        () => {
          loadHymns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hymnSubscription);
    };
  }, []);

  // Check if all players answered
  useEffect(() => {
    if (isGameActive && !showResult) {
      const allAnswered = players.every(p => p.hasAnswered);
      if (allAnswered) {
        // Accelerate timer to end in 100ms
        setTimeout(() => {
          handleRoundEnd();
        }, 100);
      }
    }
  }, [players, isGameActive, showResult]);

  // Timer logic
  useEffect(() => {
    if (isGameActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        const remaining = Math.max(0, ROUND_TIME * 1000 - elapsed);
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          handleRoundEnd();
        }
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameActive, timeLeft]);

  const handleJoinGame = async () => {
    if (!nickname.trim()) return;
    setIsLoading(true);

    if (isSolo) {
      const newPlayer: Player = {
        id: crypto.randomUUID(),
        nickname: nickname.trim(),
        isHost: true,
        score: 0,
        hasAnswered: false,
        lastAnswerTime: 0,
        isReady: true
      };
      
      const botNames = ["Irmão João", "Irmã Maria", "Irmão Lucas", "Irmã Sarah", "Irmão Davi"];
      const activeBots = Array.from({ length: botCount }, (_, i) => ({
        id: `bot_${i + 1}`,
        nickname: botNames[i % botNames.length],
        isHost: false,
        score: 0,
        hasAnswered: false,
        lastAnswerTime: 0,
        isReady: true
      }));
      
      setPlayers([newPlayer, ...activeBots]);
      setLocalPlayerId(newPlayer.id);
      setIsLoading(false);
      setView("lobby");
    } else {
      // Real Multiplayer
      try {
        if (roomId) {
          // Join existing
          const player = await multiplayerService.joinRoom(roomId, nickname.trim());
          if (player) {
            setLocalPlayerId(player.id);
            // Add immediately to local state for faster Lobby transition
            setPlayers(prev => {
              if (prev.some(p => p.id === player.id)) return prev;
              return [...prev, {
                id: player.id,
                nickname: player.nickname,
                isHost: player.isHost,
                isReady: player.isReady,
                score: player.score || 0,
                hasAnswered: player.hasAnswered || false,
                lastAnswerTime: 0
              }];
            });
            setView("lobby");
          } else {
            alert("Sala não encontrada ou erro ao entrar. Verifique o código.");
          }
        } else {
          // Create new
          const result = await multiplayerService.createRoom(nickname.trim());
          if (result) {
            setRoomId(result.room.id);
            setLocalPlayerId(result.player.id);
            // Add immediately
            setPlayers([{
              id: result.player.id,
              nickname: result.player.nickname,
              isHost: result.player.isHost,
              isReady: result.player.isReady,
              score: 0,
              hasAnswered: false,
              lastAnswerTime: 0
            }]);
            setView("lobby");
          } else {
            alert("Erro ao criar sala. Verifique sua conexão ou as permissões do banco.");
          }
        }
      } catch (err) {
        console.error(err);
        alert("Erro na conexão multiplayer.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleReady = async () => {
    if (!localPlayerId || isSolo || !roomId) return;
    const me = players.find(p => p.id === localPlayerId);
    if (me) {
      // Optimistic update for UI feel
      setPlayers(prev => prev.map(p => p.id === localPlayerId ? { ...p, isReady: !p.isReady } : p));
      multiplayerService.toggleReady(roomId, !me.isReady);
    }
  };

  const copyRoomLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGameClick = async () => {
    if (isSolo) {
      const q = await prepareQuestions();
      if (q) {
        setQuestions(q);
        setCurrentRound(0);
        startRound(0);
        setView("game");
      }
    } else {
      const me = players.find(p => p.id === localPlayerId);
      if (!me?.isHost) return;

      const allReady = players.every(p => p.isReady);
      if (!allReady) {
        alert("Todos os jogadores precisam estar prontos!");
        return;
      }

      const q = await prepareQuestions();
      if (q && roomId) {
        setIsLoading(true);
        multiplayerService.startGameWithQuestions(roomId, q);
        setIsLoading(false);
      }
    }
  };

  const prepareQuestions = async () => {
    setIsLoading(true);
    let currentHymns = hymns;
    if (currentHymns.length === 0) {
      currentHymns = await fetchHymns();
      setHymns(currentHymns);
    }
    
    if (currentHymns.length < 4) {
      alert("Adicione pelo menos 4 hinos no Supabase para jogar.");
      setIsLoading(false);
      return null;
    }

    const shuffledForGame = [...currentHymns].sort(() => 0.5 - Math.random());
    const roundHymns = shuffledForGame.slice(0, ROUNDS_COUNT);
    const q = generateQuestions(roundHymns, currentHymns);
    setIsLoading(false);
    return q;
  };

  const startGame = async () => {
    // This is now handled by handleStartGameClick or real-time room updates
  };

  const startRound = (roundIndex: number) => {
    setCurrentRound(roundIndex);
    setTimeLeft(ROUND_TIME * 1000);
    setIsGameActive(true);
    setSelectedOption(null);
    setFeedback(null);
    setShowResult(false);
    startTimeRef.current = Date.now();
    
    // Reset players for the round
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));
    
    // Simulate bots answering after some time
    players.filter(p => p.id.startsWith("bot")).forEach(bot => {
      const delay = Math.random() * 5000 + 1000; // 1-6 seconds
      setTimeout(() => {
        setPlayers(current => current.map(p => {
          if (p.id === bot.id) {
            const isCorrect = Math.random() > 0.3;
            const points = isCorrect ? Math.floor((ROUND_TIME - delay/1000) * 10) : 0;
            return { ...p, hasAnswered: true, score: p.score + points };
          }
          return p;
        }));
      }, delay);
    });
  };

  const handleAnswer = (option: string) => {
    if (!isGameActive || selectedOption) return; // Prevent multiple answers
    
    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    lastHitTimeRef.current = timeSpent;
    
    setSelectedOption(option);
    
    const currentQuestion = questions[currentRound];
    const isUserCorrect = option.trim().toLowerCase() === currentQuestion.options[currentQuestion.correct].trim().toLowerCase();
    const pointsToAdd = isUserCorrect ? Math.max(0, Math.floor((ROUND_TIME - timeSpent) * 10)) : 0;

    // Set feedback immediately for local individual experience
    setFeedback({ correct: isUserCorrect, option: option });

    if (!isSolo && localPlayerId && roomId) {
      multiplayerService.updateScore(roomId, isUserCorrect, pointsToAdd);
    }

    // Local state update for immediate feedback in the UI
    setPlayers(prev => prev.map(p => {
      if (p.id === localPlayerId) {
        return { ...p, hasAnswered: true, score: p.score + pointsToAdd };
      }
      return p;
    }));
  };

  const handleRoundEnd = () => {
    if (showResultRef.current) return;
    setIsGameActive(false);
    setShowResult(true);

    // Ensure feedback is set even if user didn't answer (timeout)
    if (!feedbackRef.current) {
      const currentQuestion = questionsRef.current[currentRoundRef.current];
      const currentSelected = selectedOptionRef.current;
      const isUserCorrect = currentSelected 
        ? currentSelected.trim().toLowerCase() === currentQuestion.options[currentQuestion.correct].trim().toLowerCase()
        : false;
      
      setFeedback({ 
        correct: isUserCorrect, 
        option: currentSelected || "Tempo Esgotado" 
      });
    }

    if (isSolo) {
      setTimeout(() => {
        if (currentRoundRef.current < ROUNDS_COUNT - 1) {
          startRound(currentRoundRef.current + 1);
        } else {
          setView("ranking");
        }
      }, 3000);
    }
  };

  const nextRound = () => {
    if (isSolo) {
      if (currentRound + 1 < ROUNDS_COUNT) {
        startRound(currentRound + 1);
      } else {
        setView("ranking");
      }
    } else if (roomId) {
      multiplayerService.nextRound(roomId);
    }
  };

  const resetGame = async () => {
    if (isSolo) {
      setPlayers(prev => prev.map(p => ({ ...p, score: 0, hasAnswered: false, isReady: true })));
      setView("lobby");
    } else if (roomId) {
      const me = players.find(p => p.id === localPlayerId);
      if (me?.isHost) {
        multiplayerService.resetRoom(roomId);
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg-page text-text-primary font-sans selection:bg-accent-gold/20 overflow-x-hidden relative">
      {/* Delicate Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent-gold/5 blur-[100px] rounded-full animate-pulse opacity-70"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-accent-gold/10 blur-[120px] rounded-full opacity-60"></div>
        <div className="absolute top-[20%] right-[10%] w-[30vw] h-[30vw] bg-success/5 blur-[100px] rounded-full opacity-40"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 min-h-screen flex flex-col relative z-10">
        
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-grow flex flex-col items-center justify-center text-center gap-10"
            >
              <div className="relative">
                <div className="absolute -inset-8 bg-white/40 blur-2xl rounded-full"></div>
                <h1 className="text-5xl md:text-7xl font-serif text-text-primary relative leading-tight">
                  <span className="italic font-medium text-accent-gold">Desafio</span><br/>
                  <span className="font-semibold tracking-wide">Hinos CCB</span>
                </h1>
              </div>
              
              <p className="text-lg text-text-secondary max-w-md font-light leading-relaxed">
                Um momento de meditação e alegria. Teste seus conhecimentos sobre os hinos sacros de forma delicada e envolvente.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mt-4">
                <button
                  onClick={() => {
                    setIsSolo(true);
                    setRoomId(null);
                    setView("multiplayer_setup");
                  }}
                  className="flex-1 px-6 py-4 bg-accent-gold text-white font-medium rounded-full hover:bg-btn-hover transition-all active:scale-95 shadow-[0_4px_20px_var(--color-accent-gold-glow)] tracking-wide"
                >
                  Jogar Solo
                </button>
                <button
                  onClick={() => {
                    setIsSolo(false);
                    setRoomId(null);
                    setView("multiplayer_setup");
                  }}
                  className="flex-1 px-6 py-4 bg-transparent border border-accent-gold text-accent-gold font-medium rounded-full hover:bg-accent-gold/5 transition-all tracking-wide"
                >
                  Multiplayer
                </button>
              </div>

              <button
                onClick={() => setView("hymn_list")}
                className="mt-6 w-full max-w-sm py-3 text-text-secondary hover:text-accent-gold transition-colors text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                <span className="underline decoration-border-soft underline-offset-4">Visualizar coleção de hinos</span>
              </button>
              
              {isLoading && (
                <div className="flex items-center gap-2 text-accent-gold animate-pulse mt-4">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium tracking-wide">Despertando melodias...</span>
                </div>
              )}
            </motion.div>
          )}

          {view === "hymn_list" && (
            <motion.div
              key="hymn_list"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-grow flex flex-col gap-6 max-w-3xl w-full mx-auto"
            >
              <div className="bg-bg-card border border-border-soft p-6 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <button onClick={() => setView("home")} className="flex items-center text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                  </button>
                  <h2 className="text-2xl font-serif italic text-accent-gold">Nossos Hinos</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {hymns.length > 0 ? (
                    (() => {
                      const uniqueHymnsMap = new Map<number, Hymn>();
                      hymns.forEach(h => {
                        if (!uniqueHymnsMap.has(h.id)) {
                          uniqueHymnsMap.set(h.id, h);
                        }
                      });
                      
                      const uniqueHymns = Array.from(uniqueHymnsMap.values())
                        .sort((a, b) => a.id - b.id);
                      
                      return uniqueHymns.map((h) => (
                        <div key={h.id} className="p-4 bg-bg-page border border-border-soft rounded-2xl flex items-center justify-between group hover:border-accent-gold/40 transition-colors shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-text-primary font-medium group-hover:text-accent-gold transition-colors">
                              {h.title.replace(/^\d+[\s.-]*/, '')}
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white border border-border-soft flex items-center justify-center text-accent-gold text-xs font-medium shadow-sm">
                            {h.id}
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="col-span-full py-16 text-center text-text-secondary">
                      <p className="font-serif italic text-lg">Nenhum hino encontrado em nossa coleção.</p>
                      <p className="text-sm mt-3 font-light">A base de dados parece estar vazia.</p>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={loadHymns}
                  className="w-full py-4 bg-bg-page border border-border-soft text-text-secondary rounded-full hover:text-accent-gold hover:border-accent-gold/30 transition-all text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                  Sincronizar acervo
                </button>
              </div>
            </motion.div>
          )}

          {view === "multiplayer_setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-grow flex flex-col items-center justify-center gap-8"
            >
              <div className="w-full max-w-md bg-bg-card border border-border-soft p-8 md:p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <button onClick={() => setView("home")} className="mb-8 flex items-center text-text-secondary hover:text-accent-gold transition-colors text-sm font-medium tracking-wide">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retornar
                </button>
                
                <h2 className="text-3xl md:text-4xl font-serif text-accent-gold mb-8 leading-tight">
                  <span className="italic">{isSolo ? "Sua identificação" : (roomId ? `Sala ${roomId}` : "Nova Sala")}</span>
                </h2>
                
                <div className="space-y-8">
                  {!isSolo && !roomId && (
                    <div className="p-4 bg-accent-gold/5 border border-accent-gold/20 rounded-2xl">
                      <p className="text-sm text-center text-accent-gold/80 italic">Você será o guia desta sala</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-text-secondary mb-3 tracking-wide">Como deseja ser chamado?</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Ex: Irmão Lucas"
                      className="w-full p-4 bg-bg-page border border-border-soft rounded-2xl text-text-primary outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all text-lg font-medium shadow-inner"
                      autoFocus
                    />
                  </div>

                  {/* Pre-lobby players list if joining via link */}
                  {roomId && !localPlayerId && players.length > 0 && (
                    <div className="p-5 bg-bg-page rounded-2xl border border-border-soft shadow-sm">
                      <p className="text-xs text-text-secondary mb-3 flex items-center gap-2 tracking-wide">
                        <Users className="w-4 h-4" /> Presentes na sala:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {players.map(p => (
                          <span key={p.id} className="px-3 py-1.5 bg-white border border-border-soft shadow-sm rounded-full text-xs font-medium text-text-primary">
                            {p.nickname}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {isSolo && (
                    <div className="pt-6 border-t border-border-soft">
                      <label className="block text-sm text-text-secondary mb-4 tracking-wide">Participantes Virtuais (Opcional)</label>
                      <div className="flex items-center justify-between gap-2">
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            onClick={() => setBotCount(num)}
                            className={cn(
                              "w-10 h-10 rounded-full font-medium transition-all shadow-sm",
                              botCount === num 
                                ? "bg-accent-gold text-white" 
                                : "bg-white text-text-secondary border border-border-soft hover:border-accent-gold/50 hover:text-accent-gold"
                            )}
                          >
                            {num === 0 ? "0" : num}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-text-secondary mt-4 italic text-center">
                        {botCount === 0 ? "Você meditará sozinho." : `Você estará acompanhado de ${botCount} irmãos virtuais.`}
                      </p>
                    </div>
                  )}
                  
                  <button
                    onClick={handleJoinGame}
                    disabled={isLoading || !nickname.trim()}
                    className="w-full py-4 bg-accent-gold text-white font-medium rounded-full shadow-[0_4px_20px_var(--color-accent-gold-glow)] hover:bg-btn-hover hover:-translate-y-0.5 transition-all tracking-wide disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isSolo ? "Iniciar Preparação" : (roomId ? "Ingressar na Sala" : "Estabelecer Sala"))}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

           {view === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 max-w-6xl w-full mx-auto"
            >
              <div className="flex flex-col gap-6">
                <div className="bg-bg-card border border-border-soft p-8 md:p-10 rounded-[2.5rem] flex-grow relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-accent-gold">
                    <Users className="w-48 h-48" />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 relative z-10">
                    <h2 className="text-4xl md:text-5xl font-serif text-text-primary">
                      Lobby <span className="italic text-accent-gold">da Sala</span>
                    </h2>
                    {!isSolo && roomId && (
                      <div className="sm:text-right bg-bg-page px-6 py-4 rounded-2xl border border-border-soft shadow-sm">
                        <p className="text-xs text-text-secondary uppercase tracking-widest mb-1 font-medium">Passaporte</p>
                        <p className="text-2xl font-mono text-accent-gold">{roomId}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4 relative z-10">
                    {players.map((p) => (
                      <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-page border border-border-soft rounded-2xl shadow-sm gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm border",
                            p.isReady ? "bg-success/10 text-success border-success/30" : "bg-white text-text-secondary border-border-soft"
                          )}>
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-lg text-text-primary">{p.nickname}</p>
                              {p.isHost && <Trophy className="w-4 h-4 text-accent-gold" />}
                            </div>
                            <div className="flex items-center">
                              {p.isReady ? (
                                <span className="text-xs text-success tracking-wide">Alma Preparada</span>
                              ) : (
                                <span className="text-xs text-text-secondary tracking-wide">Em reflexão...</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.id === localPlayerId && !isSolo && (
                            <button 
                              onClick={toggleReady}
                              className={cn(
                                "px-5 py-2.5 rounded-full text-xs font-medium transition-all shadow-sm",
                                p.isReady ? "bg-success text-white shadow-[0_4px_15px_rgba(139,168,146,0.3)]" : "bg-white border border-border-soft text-text-primary hover:border-accent-gold hover:text-accent-gold"
                              )}
                            >
                              {p.isReady ? "Pronto" : "Sinalizar Prontidão"}
                            </button>
                          )}
                          {p.isHost && <span className="px-4 py-1.5 bg-accent-gold/10 text-accent-gold text-xs font-medium rounded-full border border-accent-gold/20">Guia</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={async () => {
                      if (localPlayerId && !isSolo) await multiplayerService.leaveRoom();
                      setView("home");
                      setRoomId(null);
                    }} 
                    className="py-4 px-8 bg-bg-card text-text-secondary font-medium rounded-full border border-border-soft hover:border-danger hover:text-danger hover:bg-danger/5 transition-all shadow-sm tracking-wide flex-1 sm:flex-none"
                  >
                    Retirar-se
                  </button>
                  {(!isSolo && players.find(p => p.id === localPlayerId)?.isHost) || isSolo ? (
                    <button
                      onClick={handleStartGameClick}
                      disabled={isLoading || (!isSolo && !players.every(p => p.isReady))}
                      className="py-4 px-8 bg-accent-gold text-white font-medium rounded-full hover:-translate-y-0.5 transition-all shadow-[0_4px_20px_var(--color-accent-gold-glow)] tracking-wide disabled:opacity-50 disabled:hover:translate-y-0 flex-1 flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Preparando...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 fill-current" /> Começar Hinos
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 py-4 bg-bg-card border border-border-soft rounded-full flex items-center justify-center text-text-secondary text-sm shadow-sm gap-2">
                       <Loader2 className="w-4 h-4 animate-spin text-accent-gold" />
                       Aguardando o Guia
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-bg-card border border-border-soft p-8 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-6">
                <h3 className="text-xl font-serif text-text-primary text-center">Reunião Fraternal</h3>
                
                {!isSolo && roomId && (
                  <button
                    onClick={copyRoomLink}
                    className="w-full p-6 bg-bg-page border border-border-soft rounded-2xl flex flex-col items-center gap-2 group hover:border-accent-gold/40 transition-all relative overflow-hidden shadow-sm"
                  >
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="copied"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="flex flex-col items-center gap-2"
                        >
                          <Trophy className="w-8 h-8 text-success mb-2" />
                          <span className="font-medium text-success text-sm">Copiado!</span>
                          <span className="text-[10px] text-success/60 uppercase tracking-widest">Link em mãos</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="invite"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="flex flex-col items-center gap-2"
                        >
                          <Users className="w-8 h-8 text-accent-gold mb-2 group-hover:scale-110 transition-transform" />
                          <span className="font-medium text-accent-gold text-sm tracking-wide">Convidar Irmãos</span>
                          <span className="text-[10px] text-text-secondary uppercase tracking-widest group-hover:text-accent-gold/80">Copiar Link</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )}

                <div className="p-6 bg-bg-page border border-border-soft rounded-2xl shadow-sm mt-auto">
                  <h4 className="font-serif italic text-accent-gold text-lg mb-4 text-center">Harmonia do Jogo</h4>
                  <ul className="space-y-4 text-sm text-text-secondary font-light">
                    <li className="flex gap-3">
                      <div className="w-1 h-1 rounded-full bg-accent-gold shrink-0 mt-2"></div>
                      Todos devem sinalizar que estão com a alma preparada.
                    </li>
                    <li className="flex gap-3">
                      <div className="w-1 h-1 rounded-full bg-accent-gold shrink-0 mt-2"></div>
                      Medite na letra para acumular conhecimento e pontos simultaneamente.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {view === "game" && questions.length > 0 && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8 max-w-7xl w-full mx-auto"
            >
              <div className="flex flex-col gap-8">
                {/* Round Header */}
                <div className="flex items-center justify-between bg-bg-card border border-border-soft p-6 md:p-8 rounded-[2rem] shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-[3rem] h-[3rem] rounded-full border border-border-soft flex items-center justify-center text-accent-gold font-medium text-xl shadow-inner">
                      {currentRound + 1}
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary tracking-widest uppercase">Estrofe</p>
                      <p className="font-medium text-lg text-text-primary">de {ROUNDS_COUNT}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Timer className="w-5 h-5 text-accent-gold" />
                      <span className="font-mono text-2xl font-medium tracking-tighter">
                        {(timeLeft / 1000).toFixed(2)}s
                      </span>
                    </div>
                    <div className="w-40 h-1 bg-border-soft rounded-full mt-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-accent-gold"
                        initial={{ width: "100%" }}
                        animate={{ width: `${(timeLeft / (ROUND_TIME * 1000)) * 100}%` }}
                        transition={{ duration: 0.01 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Question Area */}
                <div className="bg-bg-card border border-border-soft p-10 md:p-14 rounded-[2.5rem] flex-grow flex flex-col items-center justify-center text-center gap-10 relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent"></div>
                  
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-xs uppercase tracking-[0.3em] text-accent-gold font-medium">Lembrança do Hino</span>
                    <div className="w-8 h-px bg-accent-gold/40"></div>
                  </div>
                  
                  <div className="max-w-3xl">
                    <p className="text-4xl md:text-5xl lg:text-6xl font-serif italic text-text-primary leading-tight font-medium">
                      "{questions[currentRound].snippet}"
                    </p>
                  </div>

                  <AnimatePresence>
                    {showResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-white/70 rounded-[2.5rem]"
                      >
                        <div className={cn(
                          "text-center p-10 md:p-12 bg-white border rounded-[3rem] shadow-xl mb-8 transition-colors",
                          feedback?.correct ? "border-success/30 shadow-[0_10px_40px_rgba(139,168,146,0.15)]" : "border-danger/20 shadow-[0_10px_40px_rgba(199,139,139,0.1)]"
                        )}>
                          <h2 className={cn(
                            "text-4xl md:text-6xl font-serif italic mb-4",
                            feedback?.correct ? "text-success" : "text-danger"
                          )}>
                            {feedback?.correct ? "Harmonia Perfeita" : (selectedOption ? "Nota Dissonante" : "Tempo Esgotado")}
                          </h2>
                          <p className="text-lg text-text-secondary font-light">
                            {feedback?.correct ? "Sua memória e coração estão afinados!" : "Continue ouvindo e meditando para acertar na próxima."}
                          </p>
                        </div>
                        
                        {!isSolo && players.find(p => p.id === localPlayerId)?.isHost && (
                          <button
                            onClick={nextRound}
                            className="px-8 py-4 bg-accent-gold text-white font-medium rounded-full hover:-translate-y-0.5 transition-all shadow-md flex items-center gap-3 tracking-wide"
                          >
                            <span>Próxima Estrofe</span>
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full max-w-sm h-px bg-gradient-to-r from-transparent via-border-soft to-transparent my-2"></div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-4xl">
                    {questions[currentRound].options.map((option, idx) => (
                      <button
                        key={idx}
                        disabled={!isGameActive && !showResult}
                        onClick={() => handleAnswer(option)}
                        className={cn(
                          "p-6 md:p-8 rounded-[2rem] border transition-all duration-300 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between group shadow-sm bg-white",
                          !showResult && !selectedOption && "border-border-soft hover:border-accent-gold/40 hover:shadow-md",
                          !showResult && selectedOption === option && "border-accent-gold bg-accent-gold/5 shadow-md",
                          !showResult && selectedOption && selectedOption !== option && "border-border-soft opacity-60",
                          showResult && option === questions[currentRound].options[questions[currentRound].correct] && "border-success bg-success/10 shadow-md ring-1 ring-success/50 z-10",
                          showResult && selectedOption === option && option !== questions[currentRound].options[questions[currentRound].correct] && "border-danger bg-danger/5 text-danger opacity-90",
                          showResult && option !== questions[currentRound].options[questions[currentRound].correct] && selectedOption !== option && "opacity-40 border-border-soft grayscale"
                        )
                      }
                    >
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[10px] uppercase tracking-widest mb-1.5 transition-opacity",
                            showResult && option === questions[currentRound].options[questions[currentRound].correct] ? "text-success" : "text-text-secondary"
                          )}>Hino {idx + 1}</span>
                          <span className={cn(
                            "text-lg sm:text-xl font-medium tracking-tight",
                            showResult && option === questions[currentRound].options[questions[currentRound].correct] ? "text-success" : "text-text-primary"
                          )}>{option}</span>
                        </div>
                        <div className={cn(
                          "w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 mt-4 sm:mt-0 ml-0 sm:ml-4",
                          selectedOption === option ? "border-accent-gold scale-110" : "border-border-soft group-hover:border-accent-gold/40",
                          showResult && option === questions[currentRound].options[questions[currentRound].correct] && "border-success"
                        )}>
                          {selectedOption === option && <div className={cn("w-4 h-4 rounded-full", showResult && option === questions[currentRound].options[questions[currentRound].correct] ? "bg-success" : "bg-accent-gold")} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar: Players Score */}
              <div className="bg-bg-card border border-border-soft p-8 rounded-[2rem] flex flex-col gap-6 shadow-sm">
                <h3 className="text-xl font-serif text-accent-gold italic border-b border-border-soft pb-4">Confraternização</h3>
                <div className="space-y-4">
                  {players.sort((a, b) => b.score - a.score).map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-bg-page transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          p.hasAnswered ? "bg-success shadow-[0_0_8px_rgba(139,168,146,0.6)]" : "bg-border-soft/60"
                        )}></div>
                        <span className={cn("font-medium text-sm", p.id.startsWith("bot") ? "text-text-secondary" : "text-text-primary")}>
                          {p.nickname}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-accent-gold">{p.score}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-auto pt-6 border-t border-border-soft">
                  <div className="flex items-center justify-between text-[10px] text-text-secondary uppercase tracking-widest mb-3 font-medium">
                    <span>Acompanhamento</span>
                    <span>{players.filter(p => p.hasAnswered).length} / {players.length} concluídos</span>
                  </div>
                  <div className="flex gap-1.5">
                    {players.map(p => (
                      <div key={p.id} className={cn("h-1 flex-1 rounded-full", p.hasAnswered ? "bg-success/60" : "bg-border-soft")}></div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "ranking" && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-grow flex flex-col items-center justify-center gap-10 w-full max-w-4xl mx-auto"
            >
              <div className="text-center">
                <Trophy className="w-16 h-16 text-accent-gold mx-auto mb-6 opacity-80" />
                <h2 className="text-5xl md:text-6xl font-serif text-accent-gold italic tracking-tight mb-2">Fim de Jogo</h2>
                <p className="text-text-secondary text-lg font-light">Uma linda jornada de lembranças concluída.</p>
              </div>

              <div className="w-full space-y-4">
                {players.sort((a, b) => b.score - a.score).map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "flex items-center justify-between p-6 md:p-8 rounded-[2rem] border transition-all bg-bg-card shadow-sm",
                      idx === 0 ? "border-accent-gold/40 shadow-md ring-1 ring-accent-gold/10" : "border-border-soft"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <span className={cn(
                        "text-3xl font-serif italic opacity-70",
                        idx === 0 ? "text-accent-gold" : "text-text-secondary"
                      )}>
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xl font-medium text-text-primary">{p.nickname}</p>
                        <p className="text-xs text-text-secondary tracking-wide uppercase mt-1">{p.id.startsWith("bot") ? "Virtuais" : "Irmandade"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-mono text-accent-gold">{p.score}</p>
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-1">Pontos Finais</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full mt-4 max-w-lg mx-auto">
                <button
                  onClick={resetGame}
                  className="flex-1 py-4 px-6 bg-accent-gold text-white font-medium rounded-full hover:-translate-y-0.5 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Meditar Novamente
                </button>
                <button
                  onClick={() => setView("home")}
                  className="flex-1 py-4 px-6 bg-bg-page border border-border-soft text-text-primary rounded-full hover:border-accent-gold/40 hover:text-accent-gold transition-colors text-sm font-medium"
                >
                  Voltar ao Início
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
