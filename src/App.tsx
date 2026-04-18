import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, ChevronRight, ArrowLeft, ArrowRight, Play, Trophy, Loader2, RefreshCw, X, Wifi, Search, Globe, Signal, Music, Settings, Info, Check, AlertCircle, Star, Sparkles, Plus, Key, MonitorSpeaker } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { fetchHymns, generateQuestions, type Hymn, type Question } from "./services/hymnService";
import { multiplayerService, type Room, type Player as DBPlayer } from "./services/multiplayerService";
import { soundService } from "./lib/soundService";
import { ProfileCreator, AvatarConfig, Avatar } from "./components/ProfileCreator";
import { Edit2 } from "lucide-react";
type ViewState = "home" | "multiplayer_menu" | "multiplayer_join" | "multiplayer_setup" | "lobby" | "game" | "ranking" | "hymn_list";

interface Player {
  id: string;
  nickname: string;
  avatar?: AvatarConfig;
  isHost: boolean;
  score: number;
  hasAnswered: boolean;
  lastAnswerTime: number;
  isReady?: boolean;
  round?: number;
}

const ROUNDS_COUNT = 5;

// Church instrument SVG components (cartoon style)
const ViolinSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="55" rx="14" ry="18" fill="#C87941" stroke="#1a0533" strokeWidth="3" />
    <ellipse cx="30" cy="25" rx="9" ry="13" fill="#C87941" stroke="#1a0533" strokeWidth="3" />
    <rect x="27" y="36" width="6" height="10" fill="#A0522D" stroke="#1a0533" strokeWidth="2" />
    <line x1="30" y1="4" x2="30" y2="72" stroke="#1a0533" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="18" cy="50" rx="3" ry="5" fill="none" stroke="#1a0533" strokeWidth="2" />
    <ellipse cx="42" cy="50" rx="3" ry="5" fill="none" stroke="#1a0533" strokeWidth="2" />
    <path d="M24 38 Q30 33 36 38" stroke="#1a0533" strokeWidth="2" fill="none" />
    <circle cx="30" cy="4" r="4" fill="#8B4513" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const TrumpetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 25 Q20 15 35 20 L55 22" stroke="#FFD700" strokeWidth="6" strokeLinecap="round" fill="none" />
    <circle cx="55" cy="22" r="12" fill="#FFD700" stroke="#1a0533" strokeWidth="3" />
    <circle cx="55" cy="22" r="7" fill="#FFC200" stroke="#1a0533" strokeWidth="2" />
    <rect x="6" y="22" width="10" height="6" rx="3" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
    <circle cx="30" cy="15" r="5" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
    <circle cx="38" cy="14" r="5" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
    <circle cx="46" cy="15" r="5" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const SaxophoneSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 55 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 5 Q38 5 38 15 L38 55 Q38 70 22 70 Q10 70 10 58" stroke="#C87941" strokeWidth="7" strokeLinecap="round" fill="none" />
    <ellipse cx="12" cy="58" rx="9" ry="6" fill="#A0522D" stroke="#1a0533" strokeWidth="2.5" />
    <circle cx="30" cy="5" r="5" fill="#8B4513" stroke="#1a0533" strokeWidth="2" />
    <circle cx="38" cy="25" r="3.5" fill="#FFD700" stroke="#1a0533" strokeWidth="1.5" />
    <circle cx="38" cy="35" r="3.5" fill="#FFD700" stroke="#1a0533" strokeWidth="1.5" />
    <circle cx="38" cy="45" r="3.5" fill="#FFD700" stroke="#1a0533" strokeWidth="1.5" />
    <circle cx="32" cy="30" r="3" fill="#FFD700" stroke="#1a0533" strokeWidth="1.5" />
    <circle cx="32" cy="40" r="3" fill="#FFD700" stroke="#1a0533" strokeWidth="1.5" />
  </svg>
);

const TubaSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 70 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M35 8 Q50 8 50 25 L50 55 Q50 68 35 68 L20 68 Q8 68 8 55 L8 42" stroke="#B8860B" strokeWidth="8" strokeLinecap="round" fill="none" />
    <ellipse cx="8" cy="38" rx="10" ry="7" fill="#DAA520" stroke="#1a0533" strokeWidth="2.5" />
    <circle cx="35" cy="8" r="6" fill="#8B6914" stroke="#1a0533" strokeWidth="2" />
    <circle cx="50" cy="30" r="4" fill="#DAA520" stroke="#1a0533" strokeWidth="2" />
    <circle cx="50" cy="42" r="4" fill="#DAA520" stroke="#1a0533" strokeWidth="2" />
    <circle cx="35" cy="68" r="4" fill="#DAA520" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const ClarinetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="11" y="5" width="8" height="70" rx="4" fill="#1a0533" stroke="#1a0533" strokeWidth="2" />
    <rect x="12" y="5" width="6" height="70" rx="3" fill="#2D1B69" />
    <circle cx="15" cy="25" r="2.5" fill="#9B59F5" stroke="#fff" strokeWidth="1" />
    <circle cx="15" cy="35" r="2.5" fill="#9B59F5" stroke="#fff" strokeWidth="1" />
    <circle cx="15" cy="45" r="2.5" fill="#9B59F5" stroke="#fff" strokeWidth="1" />
    <circle cx="15" cy="55" r="2.5" fill="#9B59F5" stroke="#fff" strokeWidth="1" />
    <ellipse cx="15" cy="74" rx="7" ry="5" fill="#1a0533" stroke="#1a0533" strokeWidth="2" />
    <rect x="12" y="4" width="6" height="6" rx="2" fill="#8B4513" stroke="#1a0533" strokeWidth="1.5" />
  </svg>
);

const INSTRUMENTS = [
  { Component: ViolinSVG, label: 'violin' },
  { Component: TrumpetSVG, label: 'trumpet' },
  { Component: SaxophoneSVG, label: 'saxophone' },
  { Component: TubaSVG, label: 'tuba' },
  { Component: ClarinetSVG, label: 'clarinet' },
];

const INSTRUMENT_POSITIONS = [
  { top: '8%', left: '3%', rot: -15, dur: 3.2, delay: 0 },
  { top: '12%', right: '4%', rot: 18, dur: 4.0, delay: 0.7 },
  { top: '55%', left: '2%', rot: -8, dur: 3.6, delay: 1.4 },
  { top: '60%', right: '3%', rot: 12, dur: 4.4, delay: 0.3 },
  { top: '35%', left: '1%', rot: 5, dur: 3.9, delay: 1.8 },
];

const MusicalNotesBackground = () => {
  const notes = ["♪", "♫", "♬", "♩", "♭", "♮", "♯", "𝄞", "𝄢"];
  const noteColors = ["#FFD700", "#FF5A95", "#9B59F5", "#4ECB71", "#fff", "#f97316"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Floating musical notes */}
      {[...Array(22)].map((_, i) => {
        const note = notes[i % notes.length];
        const color = noteColors[i % noteColors.length];
        const left = (i * 4.7 + 2) % 97;
        const delay = (i * 1.37) % 18;
        const duration = 14 + (i * 1.1) % 16;
        const size = 18 + (i * 3) % 32;
        return (
          <div
            key={`note-${i}`}
            className="absolute bottom-[-80px] animate-float-note font-black select-none"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              fontSize: `${size}px`,
              color,
              WebkitTextStroke: '1.5px #1a0533',
              paintOrder: 'stroke fill',
              filter: 'drop-shadow(2px 2px 0px #1a0533)',
              opacity: 0,
            }}
          >
            {note}
          </div>
        );
      })}

      {/* Floating instruments - fixed positions, gentle bob */}
      {INSTRUMENT_POSITIONS.map((pos, i) => {
        const { Component } = INSTRUMENTS[i % INSTRUMENTS.length];
        const style: React.CSSProperties = {
          position: 'absolute',
          transform: `rotate(${pos.rot}deg)`,
          animationDuration: `${pos.dur}s`,
          animationDelay: `${pos.delay}s`,
          opacity: 0.22,
          filter: 'drop-shadow(3px 3px 0px rgba(26,5,51,0.6))',
        };
        if (pos.top) style.top = pos.top;
        if (pos.left) style.left = pos.left;
        if ((pos as any).right) style.right = (pos as any).right;
        return (
          <div key={`inst-${i}`} className="animate-float-instrument" style={style}>
            <Component size={62} />
          </div>
        );
      })}
    </div>
  );
};

type Difficulty = 'facil' | 'medio' | 'dificil';

export default function App() {
  const [view, setView] = useState<ViewState>("home");
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [nearbyRooms, setNearbyRooms] = useState<{ id: string; hostName: string }[]>([]);
  const [gameCountdown, setGameCountdown] = useState<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [profile, setProfile] = useState<{ nickname: string; config: AvatarConfig } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isManualJoin, setIsManualJoin] = useState(false);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);

  const startTimeRef = useRef<number>(0);
  const lastHitTimeRef = useRef<number>(0);
  const lastHandledRoundRef = useRef<number>(-1);
  const botTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

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

  // Clean up and leave room when going home
  useEffect(() => {
    if (view === "home") {
      multiplayerService.leaveRoom();
      setRoomId(null);
      setLocalPlayerId(null);
      setIsSolo(true);
      setPlayers([]);
      setQuestions([]);
      setCurrentRound(0);
      setIsGameActive(false);
      setShowResult(false);
    }
  }, [view]);

  // Check for room in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setIsSolo(false);
      setIsManualJoin(false); // They already have the link, no need to show code input
      setView("multiplayer_join");
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
            const isLocal = dbp.id === localPlayerId;
            
            // Only count as answered if the DB says they are on the current (or future) round
            // OR if it's the local player and we have it marked as answered locally for the current round index
            const dbHasAnswered = dbp.hasAnswered && dbp.round >= currentRoundRef.current;
            const localHasAnswered = isLocal && existing?.hasAnswered && currentRoundRef.current === dbp.round;
            const hasAnswered = dbHasAnswered || localHasAnswered;

            return {
              id: dbp.id,
              nickname: dbp.nickname,
              avatar: dbp.avatar,
              isHost: dbp.isHost,
              isReady: dbp.isReady,
              score: dbp.score || 0,
              hasAnswered: !!hasAnswered,
              round: dbp.round,
              lastAnswerTime: existing?.lastAnswerTime || 0
            };
          });
        });

        // Fallback sync: If we are a guest and we see the host is on a newer round, jump to it
        const hostPlayer = dbPlayers.find(p => p.isHost);
        if (hostPlayer && hostPlayer.id !== localPlayerId) {
          if (hostPlayer.round > currentRoundRef.current && hostPlayer.round < roundCountRef.current) {
            startRound(hostPlayer.round);
          } else if (hostPlayer.round >= roundCountRef.current && viewRef.current === "game") {
            setView("ranking");
          }
        }
      },
      (room) => {
        if (room.gameStarted && viewRef.current !== "game" && room.questions) {
          setQuestions(room.questions);
        } else if (!room.gameStarted && (viewRef.current === "game" || viewRef.current === "ranking")) {
          setView("lobby");
          setIsPreparing(false);
          setGameCountdown(null);
        }
      },
      () => {
        // onRoundEnd - we handle this via useEffect now
      },
      (roundIndex) => {
        // onNextRound
        if (roundIndex < roundCountRef.current) {
          startRound(roundIndex);
        } else {
          setView("ranking");
        }
      },
      () => {
        // onGameReset
        setView("lobby");
        setIsPreparing(false);
        setGameCountdown(null);
      },
      (data) => {
        // onGameStarted
        setQuestions(data.questions);
        setRoundCount(data.roundCount);
        if (data.difficulty) {
          setDifficulty(data.difficulty as Difficulty);
        }

        // Start Countdown
        setIsPreparing(true);
        setView("game");
        setGameCountdown(3);
      },
      (data) => {
        // onPlayerAnswered
        setPlayers(prev => prev.map(p => (p.id === data.playerId && data.round === currentRoundRef.current) ? { ...p, hasAnswered: true } : p));
      }
    );

    return () => unsubscribe();
  }, [roomId, isSolo, view]);

  // Check if all players answered (Unified for Solo and Multi)
  useEffect(() => {
    if (isGameActive && !showResult && players.length > 0) {
      const allAnswered = players.every(p => p.hasAnswered);
      if (allAnswered) {
        // Debounce slightly to allow UI to show final answer states
        const timer = setTimeout(() => {
          if (isGameActiveRef.current && !showResultRef.current) {
            handleRoundEnd();
          }
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [players, isGameActive, showResult]);

  // Discovery listener
  useEffect(() => {
    if (view === "multiplayer_join") {
      multiplayerService.startDiscoveryListener((rooms) => {
        setNearbyRooms(rooms);
      });
      return () => {
        multiplayerService.stopDiscoveryListener();
      };
    }
  }, [view]);

  // Countdown Timer
  useEffect(() => {
    if (gameCountdown !== null && gameCountdown > 0) {
      const timer = setTimeout(() => {
        setGameCountdown(gameCountdown - 1);
        soundService.playTick();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameCountdown === 0) {
      setIsPreparing(false);
      setGameCountdown(null);
      startRound(0);
    }
  }, [gameCountdown]);

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
    if (!profile) {
      setIsEditingProfile(true);
      return;
    }
    setIsLoading(true);
    soundService.playClick();

    if (isSolo) {
      const newPlayer: Player = {
        id: crypto.randomUUID(),
        nickname: profile.nickname,
        avatar: profile.config,
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
        avatar: { skinColor: "#FFC0CB", hairStyle: "short", hairColor: "#4a3018", clothing: "casual", clothingColor: "#4287f5", gender: "M" as 'M', instrument: "none" },
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
          const player = await multiplayerService.joinRoom(roomId, profile.nickname, profile.config);
          if (player) {
            setLocalPlayerId(player.id);
            setPlayers(prev => {
              if (prev.some(p => p.id === player.id)) return prev;
              return [...prev, {
                id: player.id,
                nickname: player.nickname,
                avatar: player.avatar,
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
          const result = await multiplayerService.createRoom(profile.nickname, profile.config);
          if (result) {
            setRoomId(result.room.id);
            setLocalPlayerId(result.player.id);
            setPlayers([{
              id: result.player.id,
              nickname: result.player.nickname,
              avatar: result.player.avatar,
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
        
        // Local start for host (since self-broadcast is now disabled)
        setQuestions(q);
        setRoundCount(roundCount);
        setDifficulty(difficulty);
        setIsPreparing(true);
        setView("game");
        setGameCountdown(3);
        
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
    // Avoid double-starting the same round (can happen with both broadcast and fallback presence)
    if (currentRoundRef.current === roundIndex && isGameActiveRef.current && !showResultRef.current) {
      return;
    }

    setCurrentRound(roundIndex);
    setIsGameActive(true);
    setSelectedOption(null);
    setFeedback(null);
    setShowResult(false);
    setResultCountdown(null);
    setTimeLeft(difficulty === 'facil' ? null : timeLimitMap[difficulty]);
    startTimeRef.current = Date.now();

    // Reset players for the round
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));

    if (!isSolo && roomId) {
      multiplayerService.resetPlayerRoundState(roundIndex);
    }

    // Clear any pending bot timeouts from previous rounds
    botTimeoutsRef.current.forEach(clearTimeout);
    botTimeoutsRef.current = [];

    // Simulate bots answering after some time (adjust for difficulty)
    players.filter(p => p.id.startsWith("bot")).forEach(bot => {
      const isHard = difficulty === 'dificil';
      const delay = isHard ? Math.random() * 3000 + 1000 : Math.random() * 5000 + 1000;
      const timeoutId = setTimeout(() => {
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
      botTimeoutsRef.current.push(timeoutId);
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
      multiplayerService.updateScore(roomId, isUserCorrect, pointsToAdd, currentRound);
    }

    setPlayers(prev => prev.map(p => {
      if (p.id === localPlayerId) {
        return { ...p, hasAnswered: true, score: p.score + pointsToAdd };
      }
      return p;
    }));

    // In Solo mode, we can advance faster if no bots, or wait for bots
    if (isSolo && botCount === 0) {
      setTimeout(() => {
        if (isGameActiveRef.current) handleRoundEnd();
      }, 800);
    }
  };

  const lastTickTimeRef = useRef<number>(0);
  const hasRungBellRef = useRef<boolean>(false);
  const roundCountRef = useRef<number>(roundCount);
  useEffect(() => { roundCountRef.current = roundCount; }, [roundCount]);

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
        
        // Prevent stale closure from overwriting if the user already answered
        if (!selectedOptionRef.current) {
          handleAnswer(null); // Mark this local player as timed out
        }
        
        // Force the round to end immediately for this client!
        if (isGameActiveRef.current && !showResultRef.current) {
          handleRoundEnd();
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isGameActive, difficulty, showResult]);

  const handleRoundEnd = () => {
    if (!isGameActiveRef.current || lastHandledRoundRef.current === currentRoundRef.current) return;
    lastHandledRoundRef.current = currentRoundRef.current;

    setIsGameActive(false);
    setShowResult(true);

    // Stop and clear the timer immediately
    setTimeLeft(null);

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

    // Play result sound and show effects
    if (finalIsCorrect) {
      soundService.playCorrect();
      triggerConfetti();
    } else {
      soundService.playWrong();
      // Add a screen shake or similar indicator for wrong answer
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.classList.add('animate-shake');
        setTimeout(() => gameContainer.classList.remove('animate-shake'), 500);
      }
    }

    // Auto-advance to next round after a delay
    const isHost = isSolo || players.find(p => p.id === localPlayerId)?.isHost;
    if (isHost) {
      setResultCountdown(3);
      const countdownInterval = setInterval(() => {
        setResultCountdown(prev => (prev !== null && prev > 1) ? prev - 1 : 0);
      }, 1000);

      setTimeout(() => {
        clearInterval(countdownInterval);
        setResultCountdown(null);
        // Only advance if we are still looking at the results of the SAME round
        if (viewRef.current === "game" && showResultRef.current) {
          nextRoundLocal();
        }
      }, 3000);
    }
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const nextRoundLocal = () => {
    const nextIdx = currentRoundRef.current + 1;
    
    if (!isSolo && roomId) {
      multiplayerService.nextRound(roomId, nextIdx);
    }
    
    if (nextIdx < roundCount) {
      startRound(nextIdx);
    } else {
      setView("ranking");
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
        // Local reset for host
        setView("lobby");
        setIsPreparing(false);
        setGameCountdown(null);
      }
    }
  };

  return (
    <div className="h-[100dvh] w-full text-game-border font-sans selection:bg-game-primary/30 overflow-hidden relative flex flex-col bg-transparent">
      <MusicalNotesBackground />

      {/* Screen-wide Time Tension Overlay */}
      <div 
        className={cn(
          "fixed inset-0 pointer-events-none z-[1] transition-colors duration-1000 mix-blend-multiply",
          view === "game" && isGameActive && difficulty !== 'facil' && timeLeft !== null
            ? (timeLeft <= 3 && timeLeft > 0 ? "bg-[#FF4757]/40" : timeLeft <= 5 && timeLeft > 0 ? "bg-[#FF9F43]/40" : "bg-transparent")
            : "bg-transparent"
        )}
      />

      <AnimatePresence>
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

      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 py-3 flex flex-col items-center justify-center relative z-10">

        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="w-full max-w-lg flex flex-col items-center justify-center gap-[2vh] px-4"
            >
              {/* PROFILE DISPLAY */}
              <div className="w-full flex flex-col items-center gap-4 bg-white/10 p-6 rounded-[2.5rem] border-4 border-[#1a0533]/20 relative group">
                {profile ? (
                  <div className="flex items-center gap-6 w-full">
                    <div className="relative">
                      <Avatar config={profile.config} size={80} />
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="absolute -bottom-1 -right-1 bg-[#9B59F5] p-2 rounded-full border-2 border-[#1a0533] text-white shadow-md hover:scale-110 transition-transform"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Seu Perfil</p>
                      <h3 className="text-3xl font-black text-white italic truncate drop-shadow-sm">{profile.nickname}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-[#4ECB71] rounded-full text-[8px] font-black uppercase text-white border border-white/20">Online</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="flex flex-col items-center gap-3 py-4 group"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-white border-4 border-[#1a0533] flex items-center justify-center game-shadow group-hover:scale-110 transition-transform">
                      <Plus className="w-8 h-8 text-[#9B59F5]" />
                    </div>
                    <span className="text-white font-black italic uppercase tracking-tighter text-xl drop-shadow-sm">Criar Avatar</span>
                  </button>
                )}
              </div>

              {/* MAIN BUTTONS */}
              <div className="w-full flex flex-col gap-[1.5vh]">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { soundService.playClick(); setIsSolo(true); setView("multiplayer_setup"); }}
                  className="btn-cartoon btn-purple w-full py-[2vh] gap-3"
                  style={{ borderRadius: '1.5rem', fontSize: 'clamp(1rem, 3.5vw, 1.5rem)' }}
                >
                  <div className="w-10 h-10 bg-white/20 border-2 border-white/40 rounded-xl flex items-center justify-center shrink-0">
                    <Play className="w-6 h-6 fill-white text-white" />
                  </div>
                  <span className="font-black uppercase italic tracking-wide cartoon-text-white">TREINO SOLO</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { soundService.playClick(); setIsSolo(false); setView("multiplayer_menu"); }}
                  className="btn-cartoon btn-yellow w-full py-[2vh] gap-3"
                  style={{ borderRadius: '1.5rem', fontSize: 'clamp(1rem, 3.5vw, 1.5rem)' }}
                >
                  <div className="w-10 h-10 bg-black/10 border-2 border-[#1a0533]/30 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-[#1a0533]" />
                  </div>
                  <span className="font-black uppercase italic tracking-wide" style={{ WebkitTextStroke: '1px #1a0533', paintOrder: 'stroke fill', color: '#1a0533' }}>CONJUNTO</span>
                </motion.button>
              </div>

              {/* BOTTOM ICON BUTTONS */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.12, rotate: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setView("hymn_list")}
                  className="w-11 h-11 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer"
                >
                  <Music className="w-5 h-5 text-[#9B59F5]" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.12, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-11 h-11 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer"
                >
                  <Settings className="w-5 h-5 text-[#9B59F5]" />
                </motion.button>
              </div>

              {/* Instrument decoration strip */}
              <div className="flex gap-4 opacity-40">
                <ViolinSVG size={28} />
                <SaxophoneSVG size={28} />
                <TubaSVG size={28} />
                <ClarinetSVG size={28} />
              </div>
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
              <div className="cartoon-panel bg-white p-8 md:p-10 flex flex-col gap-6 max-h-[80vh]">
                <div className="flex items-center justify-between shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      soundService.playClick();
                      setView("home");
                    }}
                    className="w-14 h-14 bg-gray-100 border-4 border-[#1a0533] rounded-2xl flex items-center justify-center game-shadow cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-8 h-8 text-[#1a0533]" />
                  </motion.button>
                  <h2 className="text-3xl font-black text-[#1a0533] italic uppercase cartoon-text text-right drop-shadow-[3px_3px_0px_rgba(26,5,51,0.2)]">Hinos no Supabase</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto no-scrollbar pr-2 pb-4">
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
                        <div key={h.id} className="p-4 bg-gray-50 border-4 border-[#1a0533] rounded-2xl flex items-center justify-between group hover:bg-[#FFD700]/20 transition-colors shadow-[4px_4px_0px_rgba(26,5,51,0.1)]">
                          <div className="flex flex-col">
                            <span className="text-[#1a0533] font-black text-xl italic">
                              {h.title.replace(/^\d+[\s.-]*/, '')}
                            </span>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-[#9B59F5] border-4 border-[#1a0533] flex items-center justify-center text-white text-xl font-black shadow-[3px_3px_0px_#1a0533] shrink-0">
                            {h.id}
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4 text-[#1a0533] opacity-50">
                      <Music className="w-16 h-16" />
                      <p className="font-black text-xl italic">Nenhum hino encontrado no Supabase.</p>
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    soundService.playClick();
                    loadHymns();
                  }}
                  className="btn-cartoon btn-yellow w-full p-5 flex items-center justify-center gap-3 shrink-0"
                >
                  <RefreshCw className={cn("w-6 h-6", isLoading && "animate-spin")} />
                  SINCRONIZAR COM SUPABASE
                </motion.button>
              </div>
            </motion.div>
          )}

          {view === "multiplayer_menu" && (
            <motion.div
              key="multiplayer_menu"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="w-full max-w-lg flex flex-col gap-3 mx-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-2 shrink-0">
                <button onClick={() => setView("home")} className="w-10 h-10 bg-white border-4 border-[#1a0533] rounded-lg flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform">
                  <ArrowLeft className="w-5 h-5 text-[#1a0533]" />
                </button>
                <h2 className="text-2xl md:text-3xl font-black italic uppercase cartoon-text-white drop-shadow-[3px_3px_0px_#1a0533]">CONJUNTO</h2>
                <div className="w-10 h-10" />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { soundService.playClick(); setView("multiplayer_setup"); }}
                  className="btn-cartoon btn-purple py-5 flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <div className="w-12 h-12 bg-white/20 border-3 border-white/40 rounded-xl flex items-center justify-center text-white">
                    <Plus className="w-7 h-7" />
                  </div>
                  <span className="text-base font-black italic uppercase cartoon-text-white tracking-wider">Criar Sala</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    soundService.playClick();
                    setIsManualJoin(true);
                    setRoomId(null);
                    setJoinRoomCode("");
                    setView("multiplayer_join");
                  }}
                  className="btn-cartoon btn-yellow py-5 flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <div className="w-12 h-12 bg-black/10 border-3 border-[#1a0533]/20 rounded-xl flex items-center justify-center text-[#1a0533]">
                    <Key className="w-7 h-7" />
                  </div>
                  <span className="text-base font-black italic uppercase tracking-wider text-[#1a0533]">Usar Código</span>
                </motion.button>
              </div>

              {/* Rooms Panel */}
              <div className="cartoon-panel bg-white p-4 flex flex-col overflow-hidden" style={{ maxHeight: '35vh' }}>
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <div className="w-8 h-8 bg-[#4ECB71] border-4 border-[#1a0533] rounded-lg flex items-center justify-center text-white game-shadow">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-black italic uppercase cartoon-text text-[#1a0533]">Salas Amigas</h3>
                </div>

                <div className="flex-grow overflow-y-auto no-scrollbar space-y-2">
                  {nearbyRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-30 gap-2 py-6">
                      <MonitorSpeaker className="w-14 h-14 animate-wiggle text-[#1a0533]" />
                      <p className="font-black uppercase tracking-widest text-center text-[10px]">Buscando na rede...</p>
                    </div>
                  ) : (
                    nearbyRooms.map((game, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          soundService.playClick();
                          setIsManualJoin(false);
                          setRoomId(game.id);
                          setView("multiplayer_join");
                        }}
                        className="w-full p-3 bg-gray-50 border-4 border-[#1a0533] rounded-xl flex items-center justify-between game-shadow-hover"
                      >
                        <div className="text-left">
                          <p className="font-black text-sm text-[#1a0533]">{game.hostName || "Sala Musical"}</p>
                          <p className="text-[9px] text-[#9B59F5] font-black uppercase opacity-70">ID: {game.id}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#1a0533]" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {(view === "multiplayer_setup" || view === "multiplayer_join") && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="w-full max-w-md cartoon-panel p-5 flex flex-col gap-3 mx-auto"
            >
              {/* Header */}
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => setView(view === "multiplayer_setup" && isSolo ? "home" : "multiplayer_menu")} className="w-10 h-10 bg-white border-4 border-[#1a0533] rounded-lg flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                  <ArrowLeft className="w-5 h-5 text-[#1a0533]" />
                </button>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter cartoon-text text-white drop-shadow-[3px_3px_0px_#1a0533]">
                  {view === "multiplayer_join" ? "Entrar na Sala" : (isSolo ? "SOLO" : "Nova Sala")}
                </h2>
              </div>

              {/* Nickname removed, using Profile */}

              {/* Room code for join - only if manual */}
              {view === "multiplayer_join" && isManualJoin && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block ml-1 text-[#1a0533] opacity-70">Código da Sala</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ABC123"
                    value={joinRoomCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setJoinRoomCode(code);
                      setRoomId(code);
                    }}
                    className="input-cartoon text-center tracking-[0.5em] text-xl uppercase !py-2.5"
                  />
                </div>
              )}

              {/* Setup options (only for creating games) */}
              {view === "multiplayer_setup" && (
                <div className="space-y-3">
                  {/* Rounds + Difficulty row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Rounds */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block ml-1 text-[#1a0533] opacity-70">Rodadas</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[5, 10, 15, 20].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setRoundCount(n); }}
                            className={cn(
                              "py-2 rounded-lg border-4 border-[#1a0533] font-black text-base transition-all",
                              roundCount === n
                                ? "bg-[#FFD700] text-[#1a0533] shadow-[3px_3px_0px_#1a0533] scale-105"
                                : "bg-gray-100 text-[#1a0533]/50 hover:bg-gray-200"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block ml-1 text-[#1a0533] opacity-70">Nível</label>
                      <div className="flex flex-col gap-1.5">
                        {([
                          { value: 'facil' as Difficulty, label: 'LENTO', color: 'bg-[#4ECB71]', textColor: 'text-white' },
                          { value: 'medio' as Difficulty, label: 'MÉDIO', color: 'bg-[#FFD700]', textColor: 'text-[#1a0533]' },
                          { value: 'dificil' as Difficulty, label: 'RÁPIDO', color: 'bg-[#FF4757]', textColor: 'text-white' },
                        ]).map(d => (
                          <button
                            key={d.value}
                            onClick={() => { soundService.playClick(); setDifficulty(d.value); }}
                            className={cn(
                              "py-1.5 rounded-lg border-4 border-[#1a0533] font-black text-sm uppercase tracking-wider transition-all",
                              difficulty === d.value
                                ? `${d.color} ${d.textColor} shadow-[3px_3px_0px_#1a0533] scale-105`
                                : "bg-gray-100 text-[#1a0533]/50 hover:bg-gray-200"
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bot count (solo only) */}
                  {isSolo && (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block ml-1 text-[#1a0533] opacity-70">Rivais Simulados</label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setBotCount(n); }}
                            className={cn(
                              "py-2 rounded-lg border-4 border-[#1a0533] font-black text-base transition-all",
                              botCount === n
                                ? "bg-[#9B59F5] text-white shadow-[3px_3px_0px_#1a0533] scale-105"
                                : "bg-gray-100 text-[#1a0533]/50 hover:bg-gray-200"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Go button */}
              <motion.button
                whileHover={(!profile || (view === "multiplayer_join" && isManualJoin && joinRoomCode.length < 4) || isLoading) ? {} : { scale: 1.03 }}
                whileTap={(!profile || (view === "multiplayer_join" && isManualJoin && joinRoomCode.length < 4) || isLoading) ? {} : { scale: 0.97 }}
                disabled={!profile || (view === "multiplayer_join" && isManualJoin && joinRoomCode.length < 4) || isLoading}
                onClick={handleJoinGame}
                className="btn-cartoon btn-green w-full p-3 text-xl tracking-widest gap-2 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                {view === "multiplayer_join" ? "ENTRAR" : "VAI!"}
              </motion.button>
            </motion.div>
          )}

          {view === "lobby" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex-1 min-h-0 max-w-5xl flex flex-col gap-3"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-2 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView("home")} className="w-11 h-11 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                    <ArrowLeft className="w-5 h-5 text-[#1a0533]" />
                  </button>
                  <div className="bg-white border-4 border-[#1a0533] px-4 py-1.5 rounded-xl game-shadow">
                    <span className="text-base font-black italic uppercase tracking-tighter cartoon-text text-[#1a0533]">SALA: <span className="text-[#9B59F5]">{roomId || "SOLO"}</span></span>
                  </div>
                </div>

                {!isSolo && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={copyRoomLink}
                    className="btn-cartoon btn-yellow px-4 py-1.5 text-xs gap-2 whitespace-nowrap"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {copied ? "Link Copiado!" : "Convidar Amigos"}
                  </motion.button>
                )}
              </div>

              <div className="flex-1 min-h-0 cartoon-panel p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* Players section */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-9 h-9 bg-[#9B59F5] border-4 border-[#1a0533] rounded-lg flex items-center justify-center text-white game-shadow">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter cartoon-text text-[#1a0533]">Jogadores ({players.length})</h3>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {players.map((p) => (
                        <div key={p.id} className={cn(
                          "relative p-2.5 border-4 border-[#1a0533] rounded-xl flex flex-col items-center gap-1.5 transition-all",
                          p.isReady ? "bg-[#d1fae5] shadow-[3px_3px_0px_#1a0533]" : "bg-gray-100 opacity-80"
                        )}>
                          {p.isHost && <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#FFD700] border-2 border-[#1a0533] rounded-full flex items-center justify-center text-[8px] font-black z-10">👑</div>}
                          {p.avatar ? (
                            <div className="mb-1 pointer-events-none">
                              <Avatar config={p.avatar} size={48} />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-10 h-10 rounded-lg border-4 border-[#1a0533] flex items-center justify-center text-xl font-black",
                              p.isReady ? "bg-[#4ECB71] text-white" : "bg-white text-[#1a0533]"
                            )}>
                              {p.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="font-black text-[10px] truncate w-full text-center text-[#1a0533]">{p.nickname}</p>
                          <div className={cn(
                            "px-2 py-0.5 rounded-full border-2 border-[#1a0533] text-[7px] font-black uppercase tracking-wider",
                            p.isReady ? "bg-[#4ECB71] text-white" : "bg-white text-gray-500"
                          )}>
                            {p.isReady ? "Pronto!" : "Esperando"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar config */}
                <div className="w-full md:w-64 flex flex-col gap-2.5 shrink-0">
                  <div className="bg-gray-100 border-4 border-[#1a0533] rounded-xl p-3 space-y-2">
                    <h4 className="font-black uppercase text-[9px] tracking-widest text-center border-b-2 border-gray-300 pb-1.5 text-[#1a0533]">Configurações da Partida</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-[#1a0533]">
                        <span>RODADAS:</span>
                        <span className="bg-[#9B59F5] text-white border-2 border-[#1a0533] px-2 py-0.5 rounded-md text-[9px] shadow-[1px_1px_0px_#1a0533]">{roundCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-[#1a0533]">
                        <span>NÍVEL:</span>
                        <span className="bg-[#FFD700] text-[#1a0533] border-2 border-[#1a0533] px-2 py-0.5 rounded-md uppercase text-[9px] shadow-[1px_1px_0px_#1a0533]">{difficulty}</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const me = players.find(p => p.id === localPlayerId);
                    if (isSolo || me?.isHost) {
                      return (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleStartGameClick(false)}
                          className="btn-cartoon btn-green w-full py-3 text-lg tracking-widest"
                        >
                          {isSolo ? "COMEÇAR!" : "COMEÇAR PARTIDA"}
                        </motion.button>
                      );
                    } else {
                      return (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={toggleReady}
                          className={cn(
                            "btn-cartoon w-full py-3 text-lg tracking-widest",
                            me?.isReady ? "btn-green" : "btn-purple"
                          )}
                        >
                          {me?.isReady ? "PRONTO!" : "ESTOU PRONTO"}
                        </motion.button>
                      );
                    }
                  })()}
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
              className="w-full flex-1 min-h-0 max-w-6xl flex flex-col gap-2 overflow-hidden relative"
            >
              {/* Overlay de Countdown */}
              <AnimatePresence>
                {isPreparing && gameCountdown !== null && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-game-primary/95 backdrop-blur-xl"
                  >
                    <motion.div
                      key={gameCountdown}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 2, rotate: 20 }}
                      className="text-[150px] md:text-[300px] font-black text-white italic drop-shadow-[10px_10px_0px_#1A1A1A]"
                    >
                      {gameCountdown === 0 ? "VAI!" : gameCountdown}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between px-2 md:px-4 gap-2 md:gap-3 h-14 shrink-0 pt-1">
                <div className="cartoon-panel bg-white px-3 md:px-5 py-1 md:py-2 flex items-center gap-1 md:gap-2">
                  <span className="hidden md:block text-[10px] font-black opacity-40 uppercase tracking-widest text-[#1a0533]">Round</span>
                  <span className="text-lg md:text-2xl font-black italic text-[#9B59F5]">{currentRound + 1}<span className="text-sm md:text-lg opacity-50">/{roundCount}</span></span>
                </div>

                <div className="flex-grow max-w-md h-7 md:h-8 bg-white border-[3px] md:border-4 border-[#1a0533] rounded-full overflow-hidden relative game-shadow shadow-[3px_3px_0px_#1a0533]">
                  <motion.div
                    initial={false}
                    animate={{ width: `${Math.max(0, (timeLeft || 0) / (timeLimitMap[difficulty] || 1)) * 100}%` }}
                    className={cn(
                      "h-full transition-colors duration-300",
                      (timeLeft === null || timeLeft === Infinity) ? "bg-[#4ECB71]" : 
                      timeLeft <= 3 ? "bg-[#FF4757]" : 
                      timeLeft <= 5 ? "bg-[#FF9F43]" : "bg-[#4ECB71]"
                    )}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] md:text-[11px] font-black text-[#1a0533] tracking-widest uppercase">
                      <span className="hidden md:inline">TEMPO: </span>{timeLeft === null || timeLeft === Infinity ? "∞" : `${timeLeft.toFixed(1)}s`}
                    </span>
                  </div>
                </div>

                <div className="cartoon-panel bg-white px-3 md:px-5 py-1 md:py-2 flex items-center gap-1 md:gap-2">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-[#FFD700] drop-shadow-sm" />
                  <span className="text-lg md:text-2xl font-black italic text-[#1a0533]">{players.find(p => p.id === localPlayerId)?.score || 0}</span>
                </div>
              </div>

              <div className="flex-grow cartoon-panel p-4 flex flex-col items-center justify-start gap-2 relative overflow-hidden min-h-0">
                <div className="absolute top-0 left-0 w-full h-3 bg-[#FFD700] opacity-40" />

                <div className="flex flex-col items-center text-center gap-1 max-w-4xl w-full flex-shrink">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-[#9B59F5] border-4 border-[#1a0533] rounded-full flex items-center justify-center text-white shadow-[3px_3px_0px_#1a0533] mt-2 animate-bounce-subtle shrink-0">
                    <Music className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-black italic uppercase leading-none cartoon-text text-[#FFD700] shrink-0">Qual é o hino?</h2>
                  <div className="bg-gray-50 border-4 border-[#1a0533] p-3 md:p-5 rounded-2xl shadow-[4px_4px_0px_#1a0533] relative my-1 w-full shrink">
                    <p className="text-base md:text-2xl font-black text-[#1a0533] italic leading-tight px-2 py-1 line-clamp-3">
                      "{questions[currentRound].snippet}"
                    </p>
                  </div>
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 max-w-4xl px-2 mt-auto shrink-0">
                  {questions[currentRound].options.map((option, idx) => (
                    <button
                      key={idx}
                      disabled={!isGameActive || !!selectedOption}
                      onClick={() => handleAnswer(option)}
                      className={cn(
                        "btn-cartoon p-2 md:p-3 text-left flex items-center gap-2 relative overflow-hidden",
                        // Default state (no answer yet)
                        !selectedOption ? "bg-white text-[#1a0533]" : "",
                        // Waiting for others (answered, but no result yet)
                        selectedOption === option && !showResult ? "bg-[#9B59F5] text-white" : "",
                        selectedOption && selectedOption !== option && !showResult ? "bg-white text-[#1a0533] opacity-50 grayscale" : "",
                        // Result revealed
                        showResult && option === questions[currentRound].options[questions[currentRound].correct] ? "bg-[#4ECB71] text-white scale-105 z-10 animate-pop-in shadow-[8px_8px_0px_#1a0533]" : "",
                        showResult && selectedOption === option && option !== questions[currentRound].options[questions[currentRound].correct] ? "bg-[#FF4757] text-white animate-shake" : "",
                        showResult && option !== questions[currentRound].options[questions[currentRound].correct] ? "bg-white text-[#1a0533] opacity-30 grayscale" : ""
                      )}
                    >
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-black/10 border-2 border-[#1a0533]/20 flex items-center justify-center shrink-0 text-lg md:text-xl">
                        {idx + 1}
                      </div>
                      <span className="truncate text-base md:text-xl leading-none">{option}</span>
                      {showResult && option === questions[currentRound].options[questions[currentRound].correct] && <Check className="absolute right-4 w-6 h-6 drop-shadow-md" />}
                    </button>
                  ))}
                </div>

                {showResult && (
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center z-50 p-4 md:p-10 text-center glass-panel",
                        feedback?.correct ? "bg-[#4ECB71]/40" : "bg-[#FF4757]/40"
                      )}
                    >
                      <div className="bg-white border-4 md:border-8 border-[#1a0533] p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] shadow-[8px_8px_0px_#1a0533] md:shadow-[12px_12px_0px_#1a0533] flex flex-col items-center gap-4 md:gap-6 animate-pop-in max-w-[90%]">
                        <h3 className={cn("text-5xl md:text-9xl font-black italic uppercase cartoon-text", feedback?.correct ? "text-[#4ECB71]" : "text-[#FF4757]")}>
                          {feedback?.correct ? "BOA!" : "QUASE!"}
                        </h3>
                        <div className="bg-[#1a0533] text-white px-5 py-2 rounded-full font-black text-xs md:text-base uppercase tracking-[0.3em] md:tracking-[0.5em] animate-pulse">
                          Próximo em {resultCountdown ?? 3}s...
                        </div>
                      </div>
                    </motion.div>
                )}
              </div>

              {/* Mini Placar fixo no rodapé para mobile, lateral para desktop */}
              <div className="w-full h-16 shrink-0 bg-white border-4 border-[#1a0533] rounded-[2rem] p-3 flex items-center justify-center gap-4 overflow-x-auto no-scrollbar shadow-[0px_4px_0px_rgba(26,5,51,0.2)]">
                {players.sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 shrink-0 bg-gray-100 px-4 py-2 rounded-2xl border-2 border-[#1a0533]">
                    <div className={cn("w-3 h-3 rounded-full border-2 border-[#1a0533]", p.hasAnswered ? "bg-[#4ECB71]" : "bg-white")} />
                    <span className="text-xs font-black uppercase italic text-[#1a0533]">{i + 1}. {p.nickname}</span>
                    <span className="bg-[#9B59F5] text-white text-xs font-black px-3 py-1 rounded-xl border-2 border-[#1a0533]">{p.score}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === "ranking" && (
            <motion.div
              key="ranking"
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-full flex-1 min-h-0 max-w-4xl flex flex-col items-center gap-[1.5vh] overflow-hidden px-4 py-2"
            >
              {/* Trophy + Title row */}
              <div className="flex flex-col items-center gap-[1vh] shrink-0">
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3.5 }}
                    className="w-[14vh] h-[14vh] max-w-32 max-h-32 bg-[#FFD700] border-[6px] border-[#1a0533] rounded-[2rem] flex items-center justify-center shadow-[6px_6px_0px_#1a0533] relative z-10 animate-pop-in"
                  >
                    <Trophy className="w-[7vh] h-[7vh] max-w-16 max-h-16 text-white drop-shadow-[3px_3px_0px_#1a0533]" />
                  </motion.div>
                </div>

                <h2 style={{ fontSize: 'clamp(2rem, 8vh, 5rem)' }} className="font-black italic uppercase tracking-tighter cartoon-text-white drop-shadow-[6px_6px_0px_#1a0533] leading-none">VITÓRIA!</h2>
                <p className="text-[#FFD700] font-black uppercase tracking-[0.3em] text-sm cartoon-text">O coro cantou bonito!</p>
              </div>

              {/* Player list */}
              <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2">
                {players.sort((a, b) => b.score - a.score).map((p, idx) => (
                  <motion.div
                    key={p.id}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "p-3 border-4 border-[#1a0533] rounded-2xl flex items-center justify-between transition-all",
                      idx === 0 ? "bg-[#FFD700] shadow-[5px_5px_0px_#1a0533] relative z-10" : "bg-white/90 shadow-[3px_3px_0px_#1a0533] opacity-90"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 flex items-center justify-center rounded-xl border-4 border-[#1a0533] font-black text-base", idx === 0 ? "bg-white text-[#1a0533]" : "bg-gray-100 text-[#1a0533]")}>
                        #{idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-black italic uppercase tracking-tighter leading-none text-[#1a0533]">{p.nickname}</span>
                        <span className="text-[9px] font-black uppercase opacity-50 text-[#1a0533]">{p.id.startsWith("bot") ? "BOT" : "JOGADOR"}</span>
                      </div>
                    </div>
                    <div className="bg-[#9B59F5] text-white border-4 border-[#1a0533] px-4 py-1.5 rounded-xl font-black text-xl italic shadow-[3px_3px_0px_#1a0533]">
                      {p.score}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Buttons */}
              <div className="w-full grid grid-cols-2 gap-3 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetGame}
                  className="btn-cartoon btn-purple py-3 text-lg italic tracking-widest"
                >
                  DE NOVO!
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setView("home")}
                  className="btn-cartoon btn-white py-3 text-lg italic tracking-widest"
                >
                  SAIR
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Profile Creator Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <ProfileCreator 
              initialNickname={profile?.nickname}
              initialConfig={profile?.config}
              onSave={(nick, config) => {
                setProfile({ nickname: nick, config });
                setIsEditingProfile(false);
                soundService.playClick();
              }}
              onCancel={() => setIsEditingProfile(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
