import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, ChevronRight, ArrowLeft, ArrowRight, Play, Trophy, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { fetchHymns, generateQuestions, type Hymn, type Question } from "./services/hymnService";
import { multiplayerService, type Room, type Player as DBPlayer } from "./services/multiplayerService";
import { soundService } from "./lib/soundService";

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

const MusicalNotesBackground = () => {
  const notes = ["♪", "♫", "♬", "♩", "♭", "♮", "♯"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-20">
      {[...Array(15)].map((_, i) => {
        const note = notes[Math.floor(Math.random() * notes.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 20;
        const duration = 15 + Math.random() * 20;
        const size = 20 + Math.random() * 40;
        return (
          <div
            key={i}
            className="absolute bottom-[-100px] animate-float-note text-game-primary font-bold"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              fontSize: `${size}px`,
            }}
          >
            {note}
          </div>
        );
      })}
    </div>
  );
};

type Difficulty = 'facil' | 'medio' | 'dificil';

export default function App() {
  const [view, setView] = useState<ViewState>("home");
  const [players, setPlayers] = useState<Player[]>([]);
  const [nickname, setNickname] = useState("");
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundCount, setRoundCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('facil');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
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
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showUnreadyConfirm, setShowUnreadyConfirm] = useState(false);
  
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

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
      setPlatform("ios");
      document.documentElement.setAttribute("data-os", "ios");
    } else if (ua.includes("android")) {
      setPlatform("android");
      document.documentElement.setAttribute("data-os", "android");
    } else {
      setPlatform("other");
      document.documentElement.removeAttribute("data-os");
    }
  }, []);

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
        if (isGameActiveRef.current) {
          handleRoundEnd();
        }
      },
      () => {
        // onNextRound
        if (currentRoundRef.current + 1 < roundCount) {
          startRound(currentRoundRef.current + 1);
        } else {
          setView("ranking");
        }
      },
      () => {
        // onGameReset
        setView("lobby");
      },
      (data) => {
        // onGameStarted
        setQuestions(data.questions);
        setRoundCount(data.roundCount);
        if (data.difficulty) {
          setDifficulty(data.difficulty as Difficulty);
        }
        setCurrentRound(0);
        startRound(0);
        setView("game");
      }
    );

    return () => unsubscribe();
  }, [roomId, isSolo, view]);

  // Check if all players answered (Critical for Solo with Bots)
  useEffect(() => {
    if (isSolo && isGameActive && !showResult) {
      const allAnswered = players.every(p => p.hasAnswered);
      if (allAnswered) {
        setTimeout(() => {
          handleRoundEnd();
        }, 1000);
      }
    }
  }, [players, isGameActive, showResult, isSolo, roundCount]);

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
    soundService.playClick();
    if (!localPlayerId || isSolo || !roomId) return;
    const me = players.find(p => p.id === localPlayerId);
    if (me) {
      // Optimistic update for UI feel
      setPlayers(prev => prev.map(p => p.id === localPlayerId ? { ...p, isReady: !p.isReady } : p));
      multiplayerService.toggleReady(roomId, !me.isReady);
    }
  };

  const copyRoomLink = () => {
    soundService.playClick();
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGameClick = async (forceStart: boolean = false) => {
    soundService.playClick();
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

      const allOthersReady = players.filter(p => !p.isHost).every(p => p.isReady);
      if (!allOthersReady && !forceStart) {
        setShowUnreadyConfirm(true);
        return;
      }

      const q = await prepareQuestions();
      if (q && roomId) {
        setIsLoading(true);
        multiplayerService.startGameWithQuestions(roomId, q, roundCount, difficulty);
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
    const roundHymns = shuffledForGame.slice(0, roundCount);
    const q = generateQuestions(roundHymns, currentHymns);
    setIsLoading(false);
    return q;
  };

  const startGame = async () => {
    // This is now handled by handleStartGameClick or real-time room updates
  };

  // Time limits mapping
  const timeLimitMap = {
    facil: Infinity,
    medio: 20,
    dificil: 10
  };

  const startRound = (roundIndex: number) => {
    setCurrentRound(roundIndex);
    setIsGameActive(true);
    setSelectedOption(null);
    setFeedback(null);
    setShowResult(false);
    setTimeLeft(difficulty === 'facil' ? null : timeLimitMap[difficulty]);
    startTimeRef.current = Date.now();
    
    // Reset players for the round
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));
    
    // Simulate bots answering after some time (adjust for difficulty)
    players.filter(p => p.id.startsWith("bot")).forEach(bot => {
      const isHard = difficulty === 'dificil';
      const delay = isHard ? Math.random() * 3000 + 1000 : Math.random() * 5000 + 1000;
      setTimeout(() => {
        if (!isGameActiveRef.current) return;
        setPlayers(current => current.map(p => {
          if (p.id === bot.id) {
            const isCorrect = Math.random() > 0.3;
            let points = 0;
            if (isCorrect) {
              const timeSpentBot = delay / 1000;
              if (difficulty === 'facil') {
                points = Math.max(100, Math.floor(1000 - (timeSpentBot * 20)));
              } else if (difficulty === 'medio') {
                points = Math.max(100, Math.floor(((20 - timeSpentBot) / 20) * 1000));
              } else {
                points = Math.max(100, Math.floor(((10 - timeSpentBot) / 10) * 1000));
              }
            }
            return { ...p, hasAnswered: true, score: p.score + points };
          }
          return p;
        }));
      }, delay);
    });
  };

  const handleAnswer = (option: string | null) => {
    if (!isGameActive || selectedOption) return; // Prevent multiple answers
    
    // Play click sound if manual answer
    if (option) {
       soundService.playClick();
    }

    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    lastHitTimeRef.current = timeSpent;
    
    setSelectedOption(option || "Tempo Esgotado");
    
    const currentQuestion = questions[currentRound];
    const isUserCorrect = option ? option.trim().toLowerCase() === currentQuestion.options[currentQuestion.correct].trim().toLowerCase() : false;
    
    let pointsToAdd = 0;
    if (isUserCorrect) {
      if (difficulty === 'facil') {
        pointsToAdd = Math.max(100, Math.floor(1000 - (timeSpent * 20)));
      } else if (difficulty === 'medio') {
        pointsToAdd = Math.max(100, Math.floor(((20 - timeSpent) / 20) * 1000));
      } else {
        pointsToAdd = Math.max(100, Math.floor(((10 - timeSpent) / 10) * 1000));
      }
    }

    setFeedback({ correct: isUserCorrect, option: option || "Tempo Esgotado" });

    if (!isSolo && localPlayerId && roomId) {
      multiplayerService.updateScore(roomId, isUserCorrect, pointsToAdd);
    }

    setPlayers(prev => prev.map(p => {
      if (p.id === localPlayerId) {
        return { ...p, hasAnswered: true, score: p.score + pointsToAdd };
      }
      return p;
    }));
  };

  const lastTickTimeRef = useRef<number>(0);
  const hasRungBellRef = useRef<boolean>(false);

  // Timer Tick
  useEffect(() => {
    if (!isGameActive || difficulty === 'facil' || showResult) return;
    
    hasRungBellRef.current = false;
    lastTickTimeRef.current = 0;

    const interval = setInterval(() => {
      const timeSpent = (Date.now() - startTimeRef.current) / 1000;
      const limit = timeLimitMap[difficulty];
      const remaining = Math.max(0, limit - timeSpent);
      
      setTimeLeft(remaining);
      
      // Tension tick sound
      if (remaining <= 3 && remaining > 0) {
        const now = Date.now();
        if (now - lastTickTimeRef.current > 200) {
          soundService.playTick();
          lastTickTimeRef.current = now;
        }
      }

      if (remaining <= 0) {
         if (!hasRungBellRef.current) {
            hasRungBellRef.current = true;
            soundService.playBell();
         }
         handleAnswer(null); // Time out
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isGameActive, difficulty, showResult]);

  const handleRoundEnd = () => {
    if (!isGameActiveRef.current) return;
    setIsGameActive(false);
    setShowResult(true);

    let finalIsCorrect = false;

    // Ensure feedback is set even if user didn't answer
    if (!feedbackRef.current) {
      const currentQuestion = questionsRef.current[currentRoundRef.current];
      const currentSelected = selectedOptionRef.current;
      const isUserCorrect = currentSelected 
        ? currentSelected.trim().toLowerCase() === currentQuestion.options[currentQuestion.correct].trim().toLowerCase()
        : false;
      
      finalIsCorrect = isUserCorrect;
      setFeedback({ 
        correct: isUserCorrect, 
        option: currentSelected || "Não Respondido" 
      });
    } else {
      finalIsCorrect = feedbackRef.current.correct;
    }

    // Play result sound
    if (finalIsCorrect) {
      soundService.playCorrect();
    } else {
      soundService.playWrong();
    }

    // Auto-advance to next round
    const isHost = isSolo || players.find(p => p.id === localPlayerId)?.isHost;
    
    if (isHost) {
      setTimeout(() => {
        nextRound();
      }, 2000);
    }
  };

  const nextRound = () => {
    const nextIdx = currentRoundRef.current + 1;
    if (isSolo) {
      if (nextIdx < roundCount) {
        startRound(nextIdx);
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
    <div className={cn(
      "min-h-dynamic text-game-border font-sans selection:bg-game-primary/30 overflow-x-hidden relative pt-safe pb-safe italic-none transition-colors duration-500",
      view === "game" && isGameActive && difficulty !== 'facil' && timeLeft !== null && timeLeft <= 3 && timeLeft > 0 ? "bg-red-50" : "bg-game-bg"
    )}>
      <MusicalNotesBackground />

      <AnimatePresence>
        {view === "game" && isGameActive && difficulty !== 'facil' && timeLeft !== null && timeLeft <= 3 && timeLeft > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none bg-red-500/10 z-[1] mix-blend-multiply" 
          />
        )}
        
        {showUnreadyConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-game-border/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-4 border-game-border p-8 rounded-[2rem] max-w-sm w-full game-shadow text-center space-y-6"
            >
              <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-3xl mx-auto flex items-center justify-center">
                <Users className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-game-border uppercase tracking-tight">Forçar Início?</h3>
                <p className="text-game-border/60 font-medium leading-snug">Nem todos os jogadores estão prontos, deseja começar mesmo assim?</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    soundService.playClick();
                    setShowUnreadyConfirm(false);
                  }}
                  className="flex-1 p-4 bg-gray-100 text-game-border font-black rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-widest text-sm"
                >
                  Esperar
                </button>
                <button
                  onClick={() => {
                    soundService.playClick();
                    setShowUnreadyConfirm(false);
                    handleStartGameClick(true);
                  }}
                  className="flex-1 p-4 bg-game-primary text-white font-black rounded-xl hover:bg-game-primary/90 transition-colors uppercase tracking-widest text-sm"
                >
                  Começar!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-game-border/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-4 border-game-border p-8 rounded-[2rem] max-w-sm w-full game-shadow text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-100 text-game-danger rounded-3xl mx-auto flex items-center justify-center">
                <X className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-game-border uppercase tracking-tight">Sair do Jogo?</h3>
                <p className="text-game-border/60 font-medium">Seu progresso nesta partida solo será perdido. Tem certeza?</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    soundService.playClick();
                    setShowExitConfirm(false);
                  }}
                  className="flex-1 p-4 bg-gray-100 text-game-border font-black rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={() => {
                    soundService.playClick();
                    setShowExitConfirm(false);
                    setView("home");
                    setIsGameActive(false);
                  }}
                  className="flex-1 p-4 bg-game-danger text-white font-black rounded-xl hover:bg-red-600 transition-colors shadow-[4px_4px_0px_#450a0a]"
                >
                  Sair
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-12 min-h-dynamic flex flex-col relative z-10 box-border">
        
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-grow flex flex-col items-center justify-center text-center gap-8"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-white/30 blur-3xl rounded-full"></div>
                <motion.h1 
                  animate={{ 
                    rotate: [0, -1, 1, -1, 1, 0],
                    scale: [1, 1.02, 1, 1.02, 1]
                  }}
                  transition={{ 
                    duration: 5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="text-fluid-large font-black tracking-tighter text-game-primary uppercase relative drop-shadow-[4px_4px_0px_#1A1A1A] md:drop-shadow-[6px_6px_0px_#1A1A1A]"
                >
                  CCB QUIZ<br/>GAME
                </motion.h1>
              </div>
              
              <p className="text-lg md:text-2xl text-game-border font-bold max-w-lg bg-white/80 p-4 md:p-6 rounded-2xl game-border">
                O desafio definitivo para testar seus conhecimentos sobre os hinos da CCB.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
                <motion.button
                  whileHover={{ scale: 1.05, rotate: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    soundService.playClick();
                    setIsSolo(true);
                    setRoomId(null);
                    setView("multiplayer_setup");
                  }}
                  className="flex-1 p-6 bg-game-primary text-white font-black rounded-3xl game-border game-shadow-hover uppercase tracking-wider text-xl"
                >
                  Jogar Solo
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    soundService.playClick();
                    setIsSolo(false);
                    setRoomId(null);
                    setView("multiplayer_setup");
                  }}
                  className="flex-1 p-6 bg-game-secondary text-game-border font-black rounded-3xl game-border game-shadow-hover uppercase tracking-wider text-xl"
                >
                  Multiplayer
                </motion.button>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  soundService.playClick();
                  setView("hymn_list");
                }}
                className="w-full max-w-md p-4 bg-white text-game-border game-border rounded-2xl hover:bg-gray-50 transition-all game-shadow-hover uppercase tracking-widest text-sm font-black flex items-center justify-center gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                Lista de Hinos
              </motion.button>
              
              {isLoading && (
                <div className="flex items-center gap-2 text-game-primary animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-black uppercase tracking-widest">Carregando Hinos...</span>
                </div>
              )}
            </motion.div>
          )}

          {view === "hymn_list" && (
            <motion.div
              key="hymn_list"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-grow flex flex-col gap-6 max-w-4xl w-full mx-auto"
            >
              <div className="bg-game-card game-border game-shadow p-8 rounded-[2rem] flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <motion.button 
                    whileHover={{ x: -5 }}
                    onClick={() => {
                      soundService.playClick();
                      setView("home");
                    }} 
                    className="flex items-center text-game-border hover:text-game-primary transition-colors text-sm font-black uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                  </motion.button>
                  <h2 className="text-2xl font-black text-game-primary uppercase tracking-widest">Hinos no Supabase</h2>
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
                        <div key={h.id} className="p-4 bg-gray-50 border-2 border-game-border rounded-2xl flex items-center justify-between group hover:border-game-primary transition-colors">
                          <div className="flex flex-col">
                            <span className="text-game-border font-black text-lg">
                              {h.title.replace(/^\d+[\s.-]*/, '')}
                            </span>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-game-secondary border-2 border-game-border flex items-center justify-center text-game-border text-sm font-black">
                            {h.id}
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="col-span-full py-12 text-center text-game-border">
                      <p className="font-bold">Nenhum hino encontrado no Supabase.</p>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    soundService.playClick();
                    loadHymns();
                  }}
                  className="w-full p-4 bg-game-secondary text-game-border game-border rounded-2xl hover:bg-game-secondary/80 transition-all font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 game-shadow-hover"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                  Sincronizar com Supabase
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
              <div className="w-full max-w-md bg-game-card border-4 border-game-border p-8 rounded-[2rem] shadow-2xl game-shadow">
                <button onClick={() => {
                  soundService.playClick();
                  setView("home");
                }} className="mb-6 flex items-center text-game-border hover:text-game-primary transition-colors text-sm font-black uppercase tracking-widest">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </button>
                
                <h2 className="text-3xl font-black text-game-primary mb-6 uppercase">
                  {isSolo ? "Quem está jogando?" : (roomId ? `Entrar na Sala ${roomId}` : "Criar Nova Sala")}
                </h2>
                
                <div className="space-y-6">
                  {!isSolo && !roomId && (
                    <div className="p-4 bg-game-primary/10 border-2 border-game-primary rounded-2xl">
                      <p className="text-xs text-game-primary uppercase font-black tracking-widest text-center">Você será o Host desta sala</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs uppercase text-game-border font-black tracking-widest mb-2">Seu Nickname</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Ex: Irmão Lucas"
                      className="w-full p-4 bg-gray-50 border-3 border-game-border rounded-2xl text-game-border outline-none focus:bg-white transition-colors text-lg font-bold"
                      autoFocus
                    />
                  </div>

                  {/* Round Selection */}
                  {(isSolo || (!roomId && !localPlayerId)) && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="block text-xs uppercase text-game-border font-black tracking-widest mb-2">Quantidade de Rodadas</label>
                        <div className="grid grid-cols-4 gap-3">
                          {[5, 10, 15, 20].map((num) => (
                            <button
                              key={num}
                              onClick={() => {
                                soundService.playClick();
                                setRoundCount(num);
                              }}
                              className={cn(
                                "p-3 rounded-2xl text-sm font-black transition-all border-3",
                                roundCount === num 
                                  ? "bg-game-secondary text-game-border border-game-border shadow-[2px_2px_0px_#1A1A1A]" 
                                  : "bg-white border-game-border text-game-border opacity-50 hover:opacity-100"
                              )}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Difficulty Selection */}
                      <div className="space-y-3">
                        <label className="block text-xs uppercase text-game-border font-black tracking-widest mb-2">Dificuldade</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'facil', label: 'Fácil', colorClass: 'bg-game-success text-white' },
                            { id: 'medio', label: 'Médio', colorClass: 'bg-yellow-500 text-white' },
                            { id: 'dificil', label: 'Difícil', colorClass: 'bg-game-danger text-white' }
                          ].map((diff) => (
                            <button
                              key={diff.id}
                              onClick={() => {
                                soundService.playClick();
                                setDifficulty(diff.id as Difficulty);
                              }}
                              className={cn(
                                "p-3 rounded-2xl text-sm font-black transition-all border-3 uppercase tracking-widest",
                                difficulty === diff.id 
                                  ? `${diff.colorClass} border-game-border shadow-[2px_2px_0px_#1A1A1A]` 
                                  : "bg-white border-game-border text-game-border opacity-50 hover:opacity-100 shadow-none"
                              )}
                            >
                              {diff.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-game-border mt-3 uppercase font-bold leading-tight bg-game-primary/10 p-3 rounded-xl border-2 border-game-primary/20">
                          {difficulty === 'facil' && "Sem tempo limite. Pontos baseados em quem acerta e em quem é o mais rápido."}
                          {difficulty === 'medio' && "20 segundos para responder. Menos tempo = menos pontos. Fique atento!"}
                          {difficulty === 'dificil' && "Apenas 10 segundos! Um verdadeiro desafio para quem conhece o hinário."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pre-lobby players list if joining via link */}
                  {roomId && !localPlayerId && players.length > 0 && (
                    <div className="p-4 bg-game-primary/5 rounded-2xl border-2 border-game-primary/20">
                      <p className="text-[10px] text-game-primary mb-3 flex items-center gap-2 uppercase tracking-widest font-black">
                        <Users className="w-3 h-3" /> Já na sala:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {players.map(p => (
                          <span key={p.id} className="px-3 py-1 bg-white border-2 border-game-border rounded-full text-[10px] font-black text-game-border uppercase tracking-tight">
                            {p.nickname}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {isSolo && (
                    <div className="pt-4 border-t-4 border-game-border">
                      <label className="block text-xs uppercase text-game-border font-black tracking-widest mb-4">Adicionar Bots (Opcional)</label>
                      <div className="flex items-center justify-between gap-2">
                        {[0, 1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            onClick={() => {
                              soundService.playClick();
                              setBotCount(num);
                            }}
                            className={cn(
                              "w-12 h-12 rounded-xl font-black transition-all border-3",
                              botCount === num 
                                ? "bg-game-primary text-white border-game-border shadow-[2px_2px_0px_#1A1A1A]" 
                                : "bg-white text-game-border border-game-border opacity-50 hover:opacity-100"
                            )}
                          >
                            {num === 0 ? "Off" : num}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-game-border mt-3 uppercase tracking-wider font-bold">
                        {botCount === 0 ? "Você jogará sozinho." : `Você jogará contra ${botCount} bots.`}
                      </p>
                    </div>
                  )}
                  
                  <motion.button
                    whileHover={{ scale: 1.05, rotate: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      soundService.playClick();
                      handleJoinGame();
                    }}
                    disabled={isLoading || !nickname.trim()}
                    className="w-full p-5 bg-game-primary text-white font-black rounded-2xl hover:bg-game-primary/90 transition-colors uppercase tracking-widest disabled:opacity-50 game-border game-shadow-hover text-xl"
                  >
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (isSolo ? "Bora jogar!" : (roomId ? "Entrar na Sala" : "Criar Sala"))}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

           {view === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-grow flex flex-col lg:grid lg:grid-cols-[1fr_400px] gap-6 md:gap-8"
            >
              <div className="flex flex-col gap-6">
                <div className="bg-game-card border-4 border-game-border p-8 rounded-[2rem] flex-grow relative overflow-hidden game-shadow">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Users className="w-48 h-48" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-5xl font-black text-game-primary uppercase drop-shadow-md">Lobby</h2>
                    {!isSolo && roomId && (
                      <div className="text-right bg-game-secondary p-3 rounded-2xl border-2 border-game-border shadow-[3px_3px_0px_#1A1A1A]">
                        <p className="text-[10px] text-game-border uppercase font-black tracking-widest">Código</p>
                        <p className="text-3xl font-black text-game-border tracking-widest leading-none">{roomId}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 border-3 border-game-border rounded-[1.5rem]">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full border-2 border-game-border flex items-center justify-center transition-colors shadow-[2px_2px_0px_#1A1A1A]",
                            p.isReady ? "bg-game-success text-white" : "bg-white text-game-border"
                          )}>
                            <User className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-xl">{p.nickname}</p>
                              {p.isHost && <Trophy className="w-5 h-5 text-game-secondary drop-shadow-sm" />}
                            </div>
                            <div className="flex items-center gap-2">
                              {!p.isHost && (p.isReady ? (
                                <span className="text-xs text-game-success font-black uppercase tracking-widest">Pronto!</span>
                              ) : (
                                <span className="text-xs text-game-border/30 font-black uppercase tracking-widest">Aguardando...</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {p.id === localPlayerId && !isSolo && !p.isHost && (
                            <button 
                              onClick={() => {
                                soundService.playClick();
                                toggleReady();
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border-2 border-game-border game-shadow-hover",
                                p.isReady ? "bg-game-success text-white" : "bg-white text-game-border"
                              )}
                            >
                              {p.isReady ? "Tô Pronto!" : "Tô Pronto?"}
                            </button>
                          )}
                          {p.isHost && <span className="px-3 py-1 bg-game-primary text-white text-xs font-black rounded-full uppercase border-2 border-game-border shadow-[2px_2px_0px_#1A1A1A]">Host</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      soundService.playClick();
                      if (localPlayerId && !isSolo) await multiplayerService.leaveRoom();
                      setView("home");
                      setRoomId(null);
                    }} 
                    className="p-5 bg-white text-game-border font-black rounded-[1.5rem] border-3 border-game-border hover:bg-gray-50 transition-colors uppercase tracking-widest flex-1 game-shadow-hover"
                  >
                    Sair
                  </motion.button>
                  {(!isSolo && players.find(p => p.id === localPlayerId)?.isHost) || isSolo ? (
                    <motion.button
                      whileHover={{ scale: 1.05, rotate: 2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        soundService.playClick();
                        handleStartGameClick(false);
                      }}
                      disabled={isLoading}
                      className="p-5 bg-game-primary text-white font-black rounded-[1.5rem] transition-transform flex-1 uppercase tracking-widest game-shadow-hover game-border disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xl"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        "Bora Começar!"
                      )}
                    </motion.button>
                  ) : (
                    <div className="flex-1 p-5 bg-white border-3 border-game-border rounded-[1.5rem] flex items-center justify-center text-game-border/50 font-black uppercase tracking-widest text-sm">
                      Esperando o Host...
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-game-card border-4 border-game-border p-8 rounded-[2rem] flex flex-col gap-6 game-shadow">
                <h3 className="text-2xl font-black text-game-primary uppercase tracking-widest">Sala Permanente</h3>
                
                {!isSolo && roomId && (
                  <button
                    onClick={() => {
                      soundService.playClick();
                      copyRoomLink();
                    }}
                    className="w-full p-6 bg-game-secondary/10 border-3 border-game-border rounded-[1.5rem] flex flex-col items-center gap-2 group hover:bg-game-secondary/20 transition-all relative overflow-hidden"
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
                          <Trophy className="w-10 h-10 text-game-success mb-2" />
                          <span className="font-black text-game-success uppercase tracking-widest text-sm">Copiado!</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="invite"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="flex flex-col items-center gap-2"
                        >
                          <Users className="w-10 h-10 text-game-primary mb-2 group-hover:scale-110 transition-transform" />
                          <span className="font-black text-game-border uppercase tracking-widest text-sm text-center leading-tight">Mandar pra Galera</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )}

                <div className="p-6 bg-gray-50 border-3 border-game-border rounded-[1.5rem]">
                  <h4 className="font-black text-game-primary uppercase tracking-widest text-sm mb-4">Regras do Multiplayer</h4>
                  <ul className="space-y-4 text-sm text-game-border font-bold">
                    <li className="flex gap-3">
                      <div className="w-4 h-4 rounded-full bg-game-secondary border-2 border-game-border shrink-0 mt-0.5"></div>
                      Todos os jogadores devem marcar <strong className="text-game-primary">Estou Pronto</strong> para o Host iniciar.
                    </li>
                    <li className="flex gap-3">
                      <div className="w-4 h-4 rounded-full bg-game-primary border-2 border-game-border shrink-0 mt-0.5"></div>
                      A pontuação é real e atualizada para todos ao final de cada rodada.
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
              className="flex-grow flex flex-col lg:grid lg:grid-cols-[1fr_350px] gap-6 md:gap-8"
            >
              <div className="flex flex-col gap-6 md:gap-8">
                {/* Round Header */}
                <div className="flex items-center justify-between bg-game-card border-4 border-game-border p-3 md:p-6 rounded-[1.5rem] md:rounded-[2rem] game-shadow">
                  <div className="flex items-center gap-3 md:gap-4 shrink-0 z-10 relative">
                    <div className="w-8 h-8 md:w-14 md:h-14 bg-game-secondary border-2 border-game-border rounded-xl md:rounded-2xl flex items-center justify-center text-game-border font-black text-sm md:text-2xl shadow-[2px_2px_0px_#1A1A1A]">
                      {currentRound + 1}
                    </div>
                    <div>
                      <p className="text-[8px] md:text-xs text-game-border font-black uppercase tracking-widest">Rodada</p>
                      <p className="font-black text-xs md:text-xl text-game-primary leading-none">de {roundCount}</p>
                    </div>
                  </div>

                  {difficulty !== 'facil' && timeLeft !== null && (
                    <div className="flex flex-col flex-1 mx-4 lg:mx-8 z-10 relative">
                      <div className="w-full bg-white/50 backdrop-blur-sm rounded-full h-3 md:h-5 overflow-hidden border-2 border-game-border shadow-[inset_0px_2px_4px_rgba(0,0,0,0.1)]">
                        <div 
                          className={cn(
                            "h-full linear", 
                            timeLeft <= 3 ? "bg-game-danger" : "bg-game-primary"
                          )} 
                          style={{ width: `${Math.max(0, (timeLeft / timeLimitMap[difficulty]) * 100)}%` }}
                        />
                      </div>
                      <div className={cn(
                          "text-right font-black uppercase text-xl md:text-2xl mt-1 tracking-tighter tabular-nums",
                          timeLeft <= 3 ? "text-game-danger animate-pulse" : "text-game-border"
                      )}>
                        {timeLeft.toFixed(2)}s
                      </div>
                    </div>
                  )}

                  {isSolo && (
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        soundService.playClick();
                        setShowExitConfirm(true);
                      }}
                      className="w-10 h-10 md:w-12 md:h-12 bg-white border-3 border-game-border rounded-xl flex items-center justify-center text-game-danger shadow-[2px_2px_0px_#1A1A1A] hover:bg-red-50 transition-colors shrink-0 z-10 relative"
                    >
                      <X className="w-6 h-6 md:w-8 md:h-8" />
                    </motion.button>
                  )}
                </div>

                {/* Question Area */}
                <div className="bg-game-card game-border p-4 md:p-12 rounded-[1.5rem] md:rounded-[3rem] flex-grow flex flex-col items-center justify-center text-center gap-4 md:gap-10 relative overflow-hidden game-shadow min-h-[150px] md:min-h-[300px]">
                  <div className="absolute top-0 left-0 w-full h-1 md:h-2 bg-game-secondary"></div>
                  
                  <div className="flex flex-col items-center gap-1 md:gap-2">
                    <span className="text-[8px] md:text-xs uppercase tracking-[0.4em] text-game-primary font-black">Qual é o hino?</span>
                    <div className="w-8 md:w-16 h-0.5 md:h-1 bg-game-border/10 rounded-full"></div>
                  </div>
                  
                  <div className="max-w-3xl">
                    <p className="text-xl md:text-5xl font-black text-game-border leading-tight line-clamp-4 md:line-clamp-none">
                       "{questions[currentRound].snippet}"
                    </p>
                  </div>

                  <AnimatePresence>
                    {!showResult && selectedOption && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-game-primary/30 backdrop-blur-sm rounded-[2.5rem]"
                      >
                        <motion.div 
                          initial={{ scale: 0.9, y: 10 }}
                          animate={{ scale: 1, y: 0 }}
                          className="bg-white border-4 border-game-border p-10 rounded-[3rem] shadow-2xl flex flex-col items-center gap-8 max-w-sm w-full game-shadow"
                        >
                          <div className="relative">
                            <motion.div
                              animate={{ 
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.1, 0.3]
                              }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute inset-[-10px] border-4 border-game-primary rounded-full"
                            />
                            
                            <svg className="w-24 h-24 transform -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r="44"
                                className="stroke-gray-100 fill-none"
                                strokeWidth="10"
                              />
                              <motion.circle
                                cx="48"
                                cy="48"
                                r="44"
                                className="stroke-game-primary fill-none"
                                strokeWidth="10"
                                strokeLinecap="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              />
                            </svg>
                            
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="w-10 h-10 text-game-primary animate-spin" />
                            </div>
                          </div>

                          <div className="text-center space-y-2">
                            <motion.h3 
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="text-3xl font-black text-game-border"
                            >
                              Esperando...
                            </motion.h3>
                            <p className="text-game-border/50 font-black uppercase text-xs tracking-widest">Geral tá decidindo!</p>
                          </div>
                          
                          <div className="w-full flex flex-col gap-4 bg-gray-50 p-6 rounded-2xl border-2 border-game-border">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-game-primary font-black text-center">Status</p>
                            <div className="flex flex-wrap justify-center gap-3">
                              {players.map(p => (
                                <div 
                                  key={p.id} 
                                  className="flex flex-col items-center gap-1"
                                >
                                  <div className={cn(
                                    "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-500",
                                    p.hasAnswered 
                                      ? "bg-game-success border-game-border text-white shadow-[2px_2px_0px_#1A1A1A]" 
                                      : "bg-white border-game-border text-game-border opacity-20"
                                  )}>
                                    <User className="w-4 h-4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}

                    {showResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className={cn(
                          "absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md rounded-[2.5rem]",
                          feedback?.correct ? "bg-game-success/20" : "bg-game-danger/20"
                        )}
                      >
                        <div className={cn(
                          "text-center p-12 bg-white border-4 border-game-border rounded-[3rem] shadow-2xl scale-110 mb-8 game-shadow",
                          feedback?.correct ? "text-game-success" : "text-game-danger"
                        )}>
                          <h2 className="text-4xl md:text-7xl font-black uppercase tracking-tighter mb-2 italic">
                            {feedback?.correct ? "Boa!" : (selectedOption === "Tempo Esgotado" ? "Passou do tempo!" : (selectedOption ? "Putz!" : "Pulou!"))}
                          </h2>
                          <p className="text-base md:text-xl text-game-border font-black uppercase tracking-widest">
                            {feedback?.correct ? "+ pontos na conta!" : "Quase lá, hein?"}
                          </p>
                        </div>
                        
                        {!isSolo && players.find(p => p.id === localPlayerId)?.isHost && players.every(p => p.hasAnswered) && (
                          <button
                            onClick={() => {
                              soundService.playClick();
                              nextRound();
                            }}
                            className="p-6 bg-game-primary text-white font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-transform game-border game-shadow flex items-center gap-3 text-xl"
                          >
                            <span>Bora pra Proxima!</span>
                            <ArrowRight className="w-8 h-8" />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full max-w-sm h-1 bg-game-border/5 rounded-full"></div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6 w-full max-w-5xl">
                    {questions[currentRound].options.map((option, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={(!isGameActive && !showResult) ? {} : { scale: 1.03, rotate: idx % 2 === 0 ? 0.5 : -0.5 }}
                        whileTap={(!isGameActive && !showResult) ? {} : { scale: 0.98 }}
                        disabled={!isGameActive && !showResult}
                        onClick={() => handleAnswer(option)}
                        className={cn(
                          "p-4 md:p-8 rounded-[1rem] md:rounded-[2rem] border-3 text-sm md:text-xl font-black transition-all duration-300 text-left flex items-center justify-between group relative overflow-hidden focus:outline-none",
                          !showResult && !selectedOption && "border-game-border bg-white hover:bg-gray-50 game-shadow-hover",
                          !showResult && selectedOption === option && "border-game-border bg-game-primary text-white shadow-[4px_4px_0px_#1A1A1A]",
                          !showResult && selectedOption && selectedOption !== option && "border-game-border bg-white opacity-50",
                          showResult && option === questions[currentRound].options[questions[currentRound].correct] && "border-game-border bg-game-success text-white shadow-[6px_6px_0px_#1A1A1A] scale-[1.02] md:scale-[1.05] z-10",
                          showResult && selectedOption === option && option !== questions[currentRound].options[questions[currentRound].correct] && "border-game-border bg-game-danger text-white shadow-[4px_4px_0px_#1A1A1A]",
                          showResult && option !== questions[currentRound].options[questions[currentRound].correct] && selectedOption !== option && "opacity-20 border-game-border bg-white scale-95"
                        )}
                      >
                        <div className="flex flex-col relative z-10">
                          <span className="text-[8px] md:text-[11px] uppercase tracking-widest opacity-30 mb-1 group-hover:opacity-100 transition-opacity">Opção {idx + 1}</span>
                          <span className="leading-tight line-clamp-1 md:line-clamp-none">{option}</span>
                        </div>
                        <div className={cn(
                          "w-6 h-6 md:w-10 md:h-10 rounded-full border-2 md:border-3 border-game-border flex items-center justify-center transition-all duration-300 shrink-0 ml-2 md:ml-4 bg-white shadow-[1px_1px_0px_#1A1A1A] md:shadow-[2px_2px_0px_#1A1A1A] relative z-10",
                          selectedOption === option ? "bg-game-secondary" : ""
                        )}>
                          {selectedOption === option && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-2 h-2 md:w-4 md:h-4 bg-game-border rounded-full" />}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar: Players Score */}
              <div className="bg-game-card border-4 border-game-border p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] flex flex-col gap-4 md:gap-6 game-shadow h-fit">
                <h3 className="text-xl md:text-2xl font-black text-game-primary uppercase tracking-widest border-b-4 border-game-border pb-4 italic">Placar</h3>
                <div className="space-y-3">
                  {players.sort((a, b) => b.score - a.score).map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-game-border",
                          p.hasAnswered ? "bg-game-success shadow-[1px_1px_0px_#1A1A1A]" : "bg-white"
                        )}></div>
                        <span className={cn("font-black text-sm md:text-lg", p.id.startsWith("bot") ? "opacity-50" : "text-game-border")}>
                          {p.nickname}
                        </span>
                      </div>
                      <span className="font-black text-base md:text-xl text-game-primary bg-game-secondary px-2 md:px-3 py-0.5 md:py-1 rounded-xl border-2 border-game-border shadow-[2px_2px_0px_#1A1A1A]">{p.score}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-auto pt-4 md:pt-6 border-t-4 border-game-border">
                  <div className="flex items-center justify-between text-[8px] md:text-[10px] text-game-border uppercase font-black tracking-widest mb-2">
                    <span>Respondendo...</span>
                    <span>{players.filter(p => p.hasAnswered).length} / {players.length}</span>
                  </div>
                  <div className="flex gap-1">
                    {players.map(p => (
                      <div key={p.id} className={cn("h-2 md:h-3 flex-1 rounded-full border-2 border-game-border", p.hasAnswered ? "bg-game-success" : "bg-white")}></div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "ranking" && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-grow flex flex-col items-center justify-center gap-12"
            >
              <div className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute -inset-4 bg-white/50 blur-2xl rounded-full"></div>
                  <Trophy className="w-28 h-28 text-game-secondary mx-auto relative drop-shadow-[4px_4px_0px_#1A1A1A] animate-bounce" />
                </div>
                <h2 className="text-7xl font-black text-game-primary uppercase tracking-tighter drop-shadow-[4px_4px_0px_#1A1A1A]">Fim de Jogo!</h2>
                <div className="bg-game-secondary inline-block px-6 py-2 rounded-2xl border-3 border-game-border game-shadow mt-4">
                  <p className="text-game-border text-xl uppercase tracking-widest font-black">Resultados Finais</p>
                </div>
              </div>

              <div className="w-full max-w-2xl space-y-5">
                {players.sort((a, b) => b.score - a.score).map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "flex items-center justify-between p-6 rounded-[2rem] border-4 transition-all game-shadow",
                      idx === 0 ? "bg-white border-game-border scale-110 z-10" : "bg-white border-game-border/10 opacity-70"
                    )}
                  >
                    <div className="flex items-center gap-4 md:gap-6">
                      <span className={cn(
                        "text-2xl md:text-4xl font-black italic",
                        idx === 0 ? "text-game-primary" : "text-game-border/30"
                      )}>
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xl md:text-3xl font-black text-game-border line-clamp-1">{p.nickname}</p>
                        <p className="text-[8px] md:text-xs text-game-primary uppercase tracking-widest font-black">{p.id.startsWith("bot") ? "SIMULADO" : "VOCÊ"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl md:text-4xl font-black text-game-primary bg-game-secondary px-3 md:px-4 py-1 md:py-2 rounded-xl md:rounded-2xl border-2 md:border-3 border-game-border shadow-[2px_2px_0px_#1A1A1A] md:shadow-[3px_3px_0px_#1A1A1A]">{p.score}</p>
                      <p className="text-[8px] md:text-[10px] text-game-border/50 uppercase font-black tracking-widest mt-1">Pontos</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
                <motion.button
                  whileHover={{ scale: 1.05, rotate: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    soundService.playClick();
                    resetGame();
                  }}
                  className="flex-1 p-6 bg-game-primary text-white font-black rounded-[2rem] uppercase tracking-widest text-xl game-border game-shadow-hover"
                >
                  Jogar Denovo!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    soundService.playClick();
                    setView("home");
                  }}
                  className="flex-1 p-6 bg-white text-game-border font-black rounded-[2rem] hover:bg-gray-50 transition-colors uppercase tracking-widest text-xl game-border game-shadow-hover"
                >
                  Cansei...
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
