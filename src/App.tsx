import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, ChevronRight, ArrowLeft, ArrowRight, Play, Trophy, Loader2, RefreshCw, X, Wifi, Search, Globe, Signal, Music, Settings, Info, Check, AlertCircle, Star, Sparkles, Plus, Key, MonitorSpeaker } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { fetchHymns, generateQuestions, type Hymn, type Question } from "./services/hymnService";
import { multiplayerService, type Room, type Player as DBPlayer } from "./services/multiplayerService";
import { soundService } from "./lib/soundService";
import { ProfileCreator, Avatar } from "./components/ProfileCreator";
import { Edit2 } from "lucide-react";
type ViewState = "home" | "multiplayer_menu" | "multiplayer_join" | "multiplayer_setup" | "lobby" | "game" | "ranking" | "hymn_list" | "mode_selection";

interface Player {
  id: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
  score: number;
  hasAnswered: boolean;
  lastAnswerTime: number;
  isReady?: boolean;
  round?: number;
}

const ROUNDS_COUNT = 5;

// Church instrument SVG components (Premium cartoon style)
const ViolinSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="violinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#D2691E" />
        <stop offset="50%" stopColor="#C87941" />
        <stop offset="100%" stopColor="#8B4513" />
      </linearGradient>
    </defs>
    <path d="M30 75 C15 75 8 65 8 52 C8 42 18 38 18 35 C18 32 12 28 12 20 C12 10 20 5 30 5 C40 5 48 10 48 20 C48 28 42 32 42 35 C42 38 52 42 52 52 C52 65 45 75 30 75Z" fill="url(#violinGrad)" stroke="#1a0533" strokeWidth="3" />
    <path d="M22 45 Q30 40 38 45" stroke="#1a0533" strokeWidth="2.5" fill="none" />
    <rect x="28" y="2" width="4" height="74" rx="2" fill="#1a0533" />
    <circle cx="20" cy="55" r="3" fill="#1a0533" />
    <circle cx="40" cy="55" r="3" fill="#1a0533" />
    <path d="M20 52 Q20 58 23 58" stroke="#1a0533" strokeWidth="1.5" fill="none" />
    <path d="M40 52 Q40 58 37 58" stroke="#1a0533" strokeWidth="1.5" fill="none" />
    <circle cx="30" cy="2" r="5" fill="#5D2E17" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const TrumpetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 1.4} height={size} viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFF2A7" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
    </defs>
    <path d="M10 35 L50 35 L50 25 L10 25 Q5 25 5 30 Q5 35 10 35Z" fill="url(#goldGrad)" stroke="#1a0533" strokeWidth="3" />
    <path d="M50 30 L85 30 L95 15 L95 45 L85 30" fill="url(#goldGrad)" stroke="#1a0533" strokeWidth="3" strokeLinejoin="round" />
    <rect x="25" y="15" width="6" height="20" rx="3" fill="url(#goldGrad)" stroke="#1a0533" strokeWidth="2.5" />
    <rect x="35" y="12" width="6" height="23" rx="3" fill="url(#goldGrad)" stroke="#1a0533" strokeWidth="2.5" />
    <rect x="45" y="15" width="6" height="20" rx="3" fill="url(#goldGrad)" stroke="#1a0533" strokeWidth="2.5" />
    <circle cx="28" cy="12" r="4" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
    <circle cx="38" cy="9" r="4" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
    <circle cx="48" cy="12" r="4" fill="#FFD700" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const SaxophoneSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M35 10 Q45 10 45 25 L45 65 Q45 80 30 80 Q15 80 15 65 L15 55" stroke="#FFD700" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M45 20 L45 60 Q45 75 30 75 Q15 75 15 60 L15 50" stroke="#B8860B" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.4" />
    <ellipse cx="15" cy="55" rx="12" ry="8" fill="#FFD700" stroke="#1a0533" strokeWidth="3" />
    <circle cx="35" cy="10" r="6" fill="#8B4513" stroke="#1a0533" strokeWidth="2.5" />
    <circle cx="45" cy="30" r="4" fill="#EAD196" stroke="#1a0533" strokeWidth="2" />
    <circle cx="45" cy="40" r="4" fill="#EAD196" stroke="#1a0533" strokeWidth="2" />
    <circle cx="45" cy="50" r="4" fill="#EAD196" stroke="#1a0533" strokeWidth="2" />
    <path d="M48 30 L53 30" stroke="#1a0533" strokeWidth="2" />
    <path d="M48 40 L53 40" stroke="#1a0533" strokeWidth="2" />
    <path d="M48 50 L53 50" stroke="#1a0533" strokeWidth="2" />
  </svg>
);

const TubaSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 1.2} height={size * 1.3} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 15 Q65 15 65 40 L65 60 Q65 75 40 75 L30 75 Q10 75 10 60 L10 50" stroke="#B8860B" strokeWidth="12" strokeLinecap="round" fill="none" />
    <ellipse cx="10" cy="45" rx="15" ry="10" fill="#DAA520" stroke="#1a0533" strokeWidth="3.5" />
    <circle cx="40" cy="15" r="8" fill="#8B6914" stroke="#1a0533" strokeWidth="3" />
    <rect x="55" y="35" width="10" height="25" rx="4" fill="#B8860B" stroke="#1a0533" strokeWidth="2.5" />
    <circle cx="60" cy="40" r="3" fill="#FFE400" />
    <circle cx="60" cy="50" r="3" fill="#FFE400" />
  </svg>
);

const ClarinetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 0.5} height={size * 1.5} viewBox="0 0 30 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="5" width="14" height="80" rx="2" fill="#1a0533" stroke="#2D1B69" strokeWidth="1" />
    <rect x="11" y="5" width="8" height="80" fill="#2D1B69" />
    <path d="M8 85 L22 85 L28 98 L2 98 L8 85" fill="#1a0533" stroke="#1a0533" strokeWidth="2" />
    {[20, 30, 40, 50, 60, 70].map(y => (
      <React.Fragment key={y}>
        <circle cx="15" cy={y} r="3" fill="#9B59F5" stroke="#fff" strokeWidth="1" />
        <path d={`M19 ${y} L23 ${y}`} stroke="#fff" strokeWidth="1" />
      </React.Fragment>
    ))}
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

const MusicalNotesBackground = ({ reducedMotion }: { reducedMotion?: boolean }) => {
  const notes = ["♪", "♫", "♬", "♩", "♭", "♮", "♯", "𝄞", "𝄢", "𝄪", "𝆓"];
  const noteColors = ["#FFD700", "#FF5A95", "#9B59F5", "#4ECB71", "#fff", "#f97316", "#38bdf8", "#fbbf24"];
  const noteCount = reducedMotion ? 8 : 40;
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Reduced notes for slow devices */}
      {[...Array(noteCount)].map((_, i) => {
        const note = notes[i % notes.length];
        const color = noteColors[i % noteColors.length];
        const spawnFromLeft = i % 2 === 0;
        const startX = spawnFromLeft ? -10 : 110;
        const startY = (i * 2.5) % 100;
        const delay = (i * 0.7) % 20;
        const duration = 15 + (i * 2) % 30;
        const size = 15 + (i * 3) % 40;

        return (
          <motion.div
            key={`note-${i}`}
            initial={{ x: `${startX}vw`, y: `${startY}vh`, opacity: 0, rotate: 0 }}
            animate={{
              x: spawnFromLeft ? "110vw" : "-10vw",
              y: [`${startY}vh`, `${(startY + 20) % 100}vh`, `${startY}vh`],
              opacity: [0, 0.7, 0.7, 0],
              rotate: 360
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute font-black select-none pointer-events-none"
            style={{
              fontSize: `${size}px`,
              color,
              WebkitTextStroke: '1.5px #1a0533',
              paintOrder: 'stroke fill',
              filter: 'drop-shadow(3px 3px 0px rgba(26,5,51,0.3))',
              zIndex: 0
            }}
          >
            {note}
          </motion.div>
        );
      })}

      {/* Floating instruments - hide on reduced motion */}
      {!reducedMotion && INSTRUMENT_POSITIONS.map((pos, i) => {
        const { Component } = INSTRUMENTS[i % INSTRUMENTS.length];
        const style: React.CSSProperties = {
          position: 'absolute',
          transform: `rotate(${pos.rot}deg)`,
          animationDuration: `${pos.dur}s`,
          animationDelay: `${pos.delay}s`,
          opacity: 0.25,
          filter: 'drop-shadow(5px 5px 0px rgba(26,5,51,0.4))',
        };
        if (pos.top) style.top = pos.top;
        if (pos.left) style.left = pos.left;
        if ((pos as any).right) style.right = (pos as any).right;
        return (
          <div key={`inst-${i}`} className="animate-float-instrument" style={style}>
            <Component size={70} />
          </div>
        );
      })}
    </div>
  );
};


type Difficulty = 'facil' | 'medio' | 'dificil';

const TIME_LIMITS = {
  facil: Infinity,
  medio: 20,
  dificil: 10
};

export default function App() {
  const [view, setView] = useState<ViewState>("home");
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [nearbyRooms, setNearbyRooms] = useState<{ id: string; hostName: string; hostAvatar?: string; difficulty: string; roundCount: number }[]>([]);
  const [gameCountdown, setGameCountdown] = useState<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [leftPlayerName, setLeftPlayerName] = useState<string | null>(null);
  const [hostLeft, setHostLeft] = useState(false);
  const [testStatus, setTestStatus] = useState({
    supabase: 'idle',
    hymns: 'idle',
    multiplayer: 'idle'
  });
  
  const startTimeRef = useRef<number>(0);
  const lastHitTimeRef = useRef<number>(0);
  const lastHandledRoundRef = useRef<number>(-1);
  const botTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const lastBotRoundRef = useRef<number>(-1);

  // Refs for reliable socket callbacks
  const isGameActiveRef = useRef(isGameActive);
  const showResultRef = useRef(showResult);
  const currentRoundRef = useRef(currentRound);
  const difficultyRef = useRef(difficulty);
  const roomDeadlineRef = useRef<number | null>(null);
  const questionsRef = useRef(questions);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const playersRef = useRef<Player[]>(players);
  const prevPlayersRef = useRef<Player[]>([]);

  useEffect(() => {
    isGameActiveRef.current = isGameActive;
    showResultRef.current = showResult;
    currentRoundRef.current = currentRound;
    difficultyRef.current = difficulty;
    questionsRef.current = questions;
    feedbackRef.current = feedback;
    selectedOptionRef.current = selectedOption;
    playersRef.current = players;
  }, [isGameActive, showResult, currentRound, difficulty, questions, feedback, selectedOption, players]);

  const [reducedMotion, setReducedMotion] = useState(false);

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

    // Detect low-end devices based on hardware
    const isLowEndDevice = async () => {
      try {
        const memory = (navigator as any).deviceMemory;
        const cores = navigator.hardwareConcurrency;
        // Low memory (< 3GB) or very few cores (< 4) likely slow device
        if (memory !== undefined && memory < 3) {
          setReducedMotion(true);
        } else if (cores !== undefined && cores < 4) {
          setReducedMotion(true);
        } else {
          // Check if prefers-reduced-motion is set
          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          setReducedMotion(prefersReduced);
        }
      } catch {
        setReducedMotion(false);
      }
    };
    isLowEndDevice();
  }, []);

  // Persistence for user profile
  const [profile, setProfile] = useState<{ nickname: string; avatarUrl: string }>(() => {
    const saved = localStorage.getItem("ccb_quiz_profile");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading profile", e);
      }
    }
    // Default guest profile
    return {
      nickname: "Maestro",
      avatarUrl: "1.png"
    };
  });

  const saveProfile = (nick: string, avatarUrl: string) => {
    const newProfile = { nickname: nick, avatarUrl };
    setProfile(newProfile);
    localStorage.setItem("ccb_quiz_profile", JSON.stringify(newProfile));
    setIsEditingProfile(false);
    soundService.playClick();
  };

  // Clean up and leave/delete room when game ends (ranking) or going home
  useEffect(() => {
    // Delete room when game ends (ranking) - host deletes the room
    if (view === "ranking" && !isSolo && roomId && localPlayerId) {
      const me = playersRef.current.find(p => p.id === localPlayerId);
      if (me?.isHost) {
        multiplayerService.deleteRoomWithKeepalive(roomId);
      }
    }

    // Clean up when going home
    if (view === "home") {
      // If host leaves, delete the room from Supabase
      if (!isSolo && roomId && localPlayerId) {
        const me = playersRef.current.find(p => p.id === localPlayerId);
        if (me?.isHost) {
          multiplayerService.deleteRoomWithKeepalive(roomId);
        } else {
          multiplayerService.leaveRoom();
        }
      } else {
        multiplayerService.leaveRoom();
      }
      setRoomId(null);
      setLocalPlayerId(null);
      setIsSolo(true);
      setPlayers([]);
      setQuestions([]);
      setCurrentRound(0);
      setIsGameActive(false);
      setShowResult(false);
      lastBotRoundRef.current = -1;
      botTimeoutsRef.current.forEach(clearTimeout);
      botTimeoutsRef.current = [];
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

  // Delete room when host closes tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSolo && roomId && localPlayerId) {
        const me = playersRef.current.find(p => p.id === localPlayerId);
        if (me?.isHost) {
          multiplayerService.deleteRoomWithKeepalive(roomId);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSolo, roomId, localPlayerId]);

  // Sync prevPlayersRef whenever players changes
  useEffect(() => {
    prevPlayersRef.current = players;
  }, [players]);

  // Fallback: Poll players every 3 seconds to ensure sync
  useEffect(() => {
    if (!roomId || isSolo) return;
    
    const pollInterval = setInterval(async () => {
      if (!roomId) return;
      const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('joined_at', { ascending: true });
      if (data) {
        const dbPlayers = data.map((row: any) => ({
          id: row.id,
          nickname: row.nickname,
          avatar: row.avatar,
          isHost: row.is_host,
          isReady: row.is_ready,
          score: row.score || 0,
          hasAnswered: row.has_answered || false,
          lastAnswerTime: 0,
          joinedAt: row.joined_at ? Number(row.joined_at) : 0
        }));
        
        // Force update with server data
        const currentIds = new Set(dbPlayers.map(p => p.id));
        const prev = prevPlayersRef.current;
        
        // Check for departures or empty room (but not if we're in ranking - game ended)
        if (dbPlayers.length === 0 && prev.length > 0 && view !== 'ranking') {
          setHostLeft(true);
          setRoomId(null);
          setLocalPlayerId(null);
          setPlayers([]);
          setTimeout(() => {
            setHostLeft(false);
            setView("home");
          }, 3000);
          return;
        }
        
        for (const p of prev) {
          if (!currentIds.has(p.id) && p.id !== localPlayerId) {
            setLeftPlayerName(p.nickname);
            setTimeout(() => setLeftPlayerName(null), 4000);
            break;
          }
        }
        
        prevPlayersRef.current = dbPlayers;
        
        setPlayers(prev => dbPlayers.map(dbp => {
          const existing = prev.find(player => player.id === dbp.id);
          return { ...dbp, lastAnswerTime: existing?.lastAnswerTime || 0 };
        }));
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [roomId, isSolo]);

  // Handle Multiplayer Subscriptions
  useEffect(() => {
    if (!roomId || isSolo) return;

    const unsubscribe = multiplayerService.subscribeToRoom(
      roomId,
      (dbPlayers) => {
        // If room is empty, host left - show message and go home
        // BUT don't trigger if we're in ranking phase (game ended normally)
        if (dbPlayers.length === 0 && prevPlayersRef.current.length > 0 && view !== 'ranking') {
          setHostLeft(true);
          setRoomId(null);
          setLocalPlayerId(null);
          setPlayers([]);
          setTimeout(() => {
            setHostLeft(false);
            setView("home");
          }, 3000);
          return;
        }
        
        // Detect players who left (in prev but not in current server response)
        const currentIds = new Set(dbPlayers.map(p => p.id));
        const prev = prevPlayersRef.current;
        
        // Check each previous player
        for (const p of prev) {
          if (!currentIds.has(p.id) && p.id !== localPlayerId) {
            // This player left the room
            setLeftPlayerName(p.nickname);
            setTimeout(() => setLeftPlayerName(null), 4000);
            break; // Only notify once
          }
        }
        
        // Update ref for next comparison
        prevPlayersRef.current = dbPlayers;
        
        // Update state - keep lastAnswerTime
        setPlayers(prev => dbPlayers.map(dbp => {
          const existing = prev.find(p => p.id === dbp.id);
          return { ...dbp, lastAnswerTime: existing?.lastAnswerTime || 0 };
        }));
      },
      (room) => {
        if (!room) {
          // Room was deleted - host left
          setHostLeft(true);
          setRoomId(null);
          setLocalPlayerId(null);
          setPlayers([]);
          setTimeout(() => {
            setHostLeft(false);
            setView("home");
          }, 3000);
          return;
        }
        
        setRoundCount(room.roundCount);
        setDifficulty(room.difficulty as Difficulty);
        difficultyRef.current = room.difficulty as Difficulty; // Update ref immediately, not waiting for next render
        if (room.questions) setQuestions(room.questions);

        // State Machine based on Phase
        if (room.phase === 'lobby') {
          if (viewRef.current !== 'lobby') setView('lobby');
          setIsPreparing(false);
          setIsGameActive(false);
          setShowResult(false);
        } else if (room.phase === 'preparing') {
          if (viewRef.current !== 'game') setView('game');
          setIsPreparing(true);
          setIsGameActive(false);
          setShowResult(false);
          
          // Use fixed local countdown to avoid network/device clock drift
          setGameCountdown(3);
        } else if (room.phase === 'answering') {
          if (viewRef.current !== 'game') setView('game');
          
          // Reset UI if entering a new round from the DB
          if (!isGameActiveRef.current || currentRoundRef.current !== room.currentRound) {
             setIsPreparing(false);
             setIsGameActive(true);
             setShowResult(false);
             setCurrentRound(room.currentRound);
             setSelectedOption(null);
             setFeedback(null);
             setResultCountdown(null);
             setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));
             
             // Start timer - use deadline from DB or calculate from current time
             if (room.deadlineAt) {
               roomDeadlineRef.current = room.deadlineAt;
             } else if (difficultyRef.current !== 'facil') {
               roomDeadlineRef.current = Date.now() + TIME_LIMITS[difficultyRef.current] * 1000;
             } else {
               roomDeadlineRef.current = null;
             }
             startTimeRef.current = Date.now();
          } else {
            // Update deadline if it changed
            roomDeadlineRef.current = room.deadlineAt;
          }
        } else if (room.phase === 'result') {
          setIsGameActive(false);
          setShowResult(true);
          setResultCountdown(3);
          
          // Host automatically schedules next round after 4s (matches endRound deadline)
          const me = playersRef.current.find(p => p.id === localPlayerId);
          if (me?.isHost && roomId) {
            setTimeout(() => {
              if (room.currentRound + 1 < room.roundCount) {
                const timeLimitSec = TIME_LIMITS[difficultyRef.current];
                if (timeLimitSec !== Infinity && timeLimitSec > 0) {
                  roomDeadlineRef.current = Date.now() + timeLimitSec * 1000;
                } else {
                  roomDeadlineRef.current = null;
                }
                multiplayerService.startRound(roomId, room.currentRound + 1, timeLimitSec);
              } else {
                multiplayerService.finishGame(roomId);
              }
            }, 4000);
          }
        } else if (room.phase === 'ranking') {
          if (viewRef.current !== 'ranking') setView('ranking');
        }
      }
    );

    return () => unsubscribe();
  }, [roomId, isSolo]);

  // Cleanup room when host leaves or reloads
  useEffect(() => {
    if (!roomId || isSolo) return;

    const handleUnload = () => {
      const me = playersRef.current.find(p => p.id === localPlayerId);
      if (me?.isHost) {
        multiplayerService.deleteRoomWithKeepalive(roomId);
      } else if (localPlayerId) {
        // Guest: just remove self via keepalive
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/players?id=eq.${localPlayerId}`;
        const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        if (apikey) fetch(url, { method: 'DELETE', headers: { 'apikey': apikey, 'Authorization': `Bearer ${apikey}` }, keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [roomId, isSolo, localPlayerId]);

  // Host heartbeat - updates room every 30s so we know it's alive
  useEffect(() => {
    if (!roomId || isSolo) return;
    const me = playersRef.current.find(p => p.id === localPlayerId);
    if (!me?.isHost) return;

    const interval = setInterval(async () => {
      // Just a lightweight touch to keep the room alive
      await multiplayerService.touchRoom(roomId);
    }, 30000);

    return () => clearInterval(interval);
  }, [roomId, isSolo, localPlayerId]);

  // Check if all players answered (Unified for Solo and Multi)
  useEffect(() => {
    // Only check if game is active, not showing results
    if (isGameActive && !showResult && players.length > 0) {
      const allAnswered = players.every(p => p.hasAnswered);
      if (allAnswered) {
        // Debounce slightly to allow UI to show final answer states
        const timer = setTimeout(() => {
          if (isGameActiveRef.current && !showResultRef.current) {
            if (isSolo) {
              handleRoundEnd();
            } else {
              // Show results immediately to avoid DB latency freeze
              showResultRef.current = true;
              setIsGameActive(false);
              setShowResult(true);
              
              const me = playersRef.current.find(p => p.id === localPlayerId);
              if (me?.isHost && roomId) {
                 multiplayerService.endRound(roomId);
              }
            }
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [players, isGameActive, showResult, isSolo, localPlayerId, roomId]);
 
  // Bot logic for Solo mode
  useEffect(() => {
    // Only trigger if we are in game, not preparing, and haven't triggered for THIS round yet
    if (isSolo && isGameActive && !showResult && !isPreparing && currentRound !== lastBotRoundRef.current && players.length > 1) {
      const bots = players.filter(p => p.id.includes("bot"));
      if (bots.length === 0) return;

      lastBotRoundRef.current = currentRound;
      
      // Clear any old timeouts just in case
      botTimeoutsRef.current.forEach(clearTimeout);
      botTimeoutsRef.current = [];

      bots.forEach(bot => {
        const isHard = difficultyRef.current === 'dificil';
        // Random delay: Hard (1.5s - 5s), Others (3s - 10s)
        const delay = isHard 
          ? Math.random() * 3500 + 1500 
          : Math.random() * 7000 + 3000;
        
        const timeoutId = setTimeout(() => {
          // Use the latest refs to check if round is still active
          if (!isGameActiveRef.current || showResultRef.current || currentRoundRef.current !== currentRound) return;
          
          setPlayers(current => current.map(p => {
            if (p.id === bot.id) {
              const isCorrect = Math.random() > 0.4;
              let points = 0;
              if (isCorrect) {
                const timeSpentBot = delay / 1000;
                const limit = TIME_LIMITS[difficultyRef.current] || 999;
                if (difficultyRef.current === 'facil') points = Math.max(100, Math.floor(1000 - (timeSpentBot * 20)));
                else points = Math.max(100, Math.floor(((limit - timeSpentBot) / limit) * 1000));
              }
              return { ...p, hasAnswered: true, score: p.score + points };
            }
            return p;
          }));
        }, delay);
        botTimeoutsRef.current.push(timeoutId);
      });
    }
  }, [isSolo, isGameActive, showResult, isPreparing, currentRound, players.length]);

  // Discovery listener - start in multiplayer_menu to find nearby rooms
  useEffect(() => {
    if (view === "multiplayer_menu" || view === "multiplayer_join") {
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
      if (isSolo) {
        startRound(0);
      } else {
        const me = players.find(p => p.id === localPlayerId);
        if (me?.isHost && roomId) {
          const timeLimitSec = TIME_LIMITS[difficultyRef.current];
          // Set deadline locally on host immediately so timer starts right away
          if (timeLimitSec !== Infinity && timeLimitSec > 0) {
            roomDeadlineRef.current = Date.now() + timeLimitSec * 1000;
          } else {
            roomDeadlineRef.current = null;
          }
          multiplayerService.startRound(roomId, 0, timeLimitSec);
        }
      }
      setGameCountdown(null);
    }
  }, [gameCountdown, isSolo]);

  // Result Timer effect
  useEffect(() => {
    if (showResult && resultCountdown !== null && resultCountdown > 0) {
      const timer = setTimeout(() => setResultCountdown(resultCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultCountdown]);

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

  const handlePlayClick = () => {
    soundService.playClick();
    setIsSolo(true);
    setView("mode_selection");
  };

  const handleCreateRoom = async () => {
    if (!profile) {
      setIsEditingProfile(true);
      return;
    }
    setIsLoading(true);
    soundService.playClick();
    try {
      const result = await multiplayerService.createRoom(profile.nickname, profile.avatarUrl);
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
        alert("Erro ao criar sala. Verifique sua conexão.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro na conexão multiplayer.");
    } finally {
      setIsLoading(false);
    }
  };

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
        avatar: profile.avatarUrl,
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
        avatar: `${(i % 24) + 1}.png`,
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
          const player = await multiplayerService.joinRoom(roomId, profile.nickname, profile.avatarUrl);
          if (player) {
            setLocalPlayerId(player.id);
            setIsSolo(false);
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
            setIsSolo(true);
            setRoomId(null);
            setLocalPlayerId(null);
            alert("Sala não encontrada ou erro ao entrar. Verifique o código.");
            setView("home");
          }
        } else {
          // Create new
          setIsSolo(false);
const result = await multiplayerService.createRoom(profile.nickname, profile.avatarUrl, difficulty);
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
        lastHandledRoundRef.current = -1;
        lastBotRoundRef.current = -1;
        botTimeoutsRef.current.forEach(clearTimeout);
        botTimeoutsRef.current = [];
        setSelectedOption(null);
        setFeedback(null);
        setIsPreparing(true);
        setGameCountdown(3);
        setView("game");
        setIsGameActive(false);
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
        // Start game in DB
        await multiplayerService.startGame(roomId, q, roundCount, difficulty);
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

  const startRound = (roundIndex: number) => {
    // Avoid double-starting the same round (can happen with both broadcast and fallback presence)
    if (currentRoundRef.current === roundIndex && isGameActiveRef.current && !showResultRef.current) {
      return;
    }

    setCurrentRound(roundIndex);
    if (roundIndex === 0) {
      setIsPreparing(false);
    }
    setIsGameActive(true);
    setSelectedOption(null);
    setShowResult(false);
    setResultCountdown(null);
    setTimeLeft(difficulty === 'facil' ? null : TIME_LIMITS[difficulty]);
    startTimeRef.current = Date.now();

    // Reset players for the round
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));

    // Clear any pending bot timeouts
    botTimeoutsRef.current.forEach(clearTimeout);
    botTimeoutsRef.current = [];
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
      if (difficultyRef.current === 'facil') {
        pointsToAdd = Math.max(100, Math.floor(1000 - (timeSpent * 20)));
      } else if (difficultyRef.current === 'medio') {
        pointsToAdd = Math.max(100, Math.floor(((20 - timeSpent) / 20) * 1000));
      } else {
        pointsToAdd = Math.max(100, Math.floor(((10 - timeSpent) / 10) * 1000));
      }
    }

    setFeedback({ correct: isUserCorrect, option: option || "Tempo Esgotado" });

    if (isSolo) {
      setPlayers(current => current.map(p => {
        if (p.id === localPlayerId) {
          return { ...p, hasAnswered: true, score: p.score + pointsToAdd };
        }
        return p;
      }));
    } else {
      if (localPlayerId && roomId) {
         multiplayerService.submitAnswer(roomId, isUserCorrect, pointsToAdd, currentRound);
      }
    }
  };

  const lastTickTimeRef = useRef<number>(0);
  const hasRungBellRef = useRef<boolean>(false);
  const roundCountRef = useRef<number>(roundCount);
  useEffect(() => { roundCountRef.current = roundCount; }, [roundCount]);

  // Timer Tick - runs every 100ms for smooth countdown
  useEffect(() => {
    const interval = setInterval(() => {
      // Check conditions
      if (!isGameActive || showResult || isPreparing) return;
      
      const currentDifficulty = difficultyRef.current;
      if (currentDifficulty === 'facil') return;
      
      const timeLimit = TIME_LIMITS[currentDifficulty];
      let remaining = 0;
      
      // For solo, use start time
      if (isSolo) {
        const timeSpent = (Date.now() - startTimeRef.current) / 1000;
        remaining = Math.max(0, timeLimit - timeSpent);
      } else if (roomDeadlineRef.current) {
        // Use deadline from host
        remaining = Math.max(0, (roomDeadlineRef.current - Date.now()) / 1000);
        
        // If deadline expired but we're still here, use start time as fallback
        if (remaining <= 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          remaining = Math.max(0, timeLimit - elapsed);
        }
      } else {
        // No deadline - use start time fallback
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        remaining = Math.max(0, timeLimit - elapsed);
      }

      setTimeLeft(remaining);

      // Tick sound when low time
      if (remaining <= 3 && remaining > 0) {
        const now = Date.now();
        if (now - lastTickTimeRef.current > 200) {
          soundService.playTick();
          lastTickTimeRef.current = now;
        }
      }

      // Time's up!
      if (remaining <= 0) {
        if (!hasRungBellRef.current) {
          hasRungBellRef.current = true;
          soundService.playBell();
        }

        if (!selectedOptionRef.current) {
          handleAnswer(null); 
        }

        if (isSolo) {
          handleRoundEnd();
        } else {
          showResultRef.current = true;
          setIsGameActive(false);
          setShowResult(true);
          
          const me = playersRef.current.find(p => p.id === localPlayerId);
          if (me?.isHost && roomId) {
             multiplayerService.endRound(roomId);
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isGameActive, showResult, isPreparing, difficulty, roomDeadlineRef.current, startTimeRef.current, selectedOptionRef.current]);

  const handleRoundEnd = () => {
    if (!isGameActiveRef.current || lastHandledRoundRef.current === currentRoundRef.current) return;
    lastHandledRoundRef.current = currentRoundRef.current;

    if (isSolo) {
      setIsGameActive(false);
      setShowResult(true);

      const timer = setTimeout(() => {
        nextRoundLocal();
      }, 3000);
      setResultCountdown(timer as any);
    } else {
      // For multiplayer, the Timer Tick interval already calls endRound when time is up or everyone answered.
      // So here we do nothing. The DB phase change will trigger UI update.
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
      setSelectedOption(null);
      setFeedback(null);
      setShowResult(false);
      lastHandledRoundRef.current = -1;
      lastBotRoundRef.current = -1;
      botTimeoutsRef.current.forEach(clearTimeout);
      botTimeoutsRef.current = [];
      setView("lobby");
    } else if (roomId) {
      const me = players.find(p => p.id === localPlayerId);
      if (me?.isHost) {
        multiplayerService.resetRoom(roomId);
      }
    }
  };

  return (
    <div className="h-screen h-[100dvh] w-full text-game-border font-sans selection:bg-game-primary/30 overflow-hidden relative flex flex-col bg-transparent" style={{ perspective: '1000px', transformStyle: 'preserve-3d', minHeight: '-webkit-fill-available' }}>
      <MusicalNotesBackground reducedMotion={reducedMotion} />

      {/* Screen-wide Time Tension Overlay */}
      <div
        className={cn(
          "fixed inset-0 pointer-events-none z-[1] transition-colors duration-1000 mix-blend-multiply",
          view === "game" && isGameActive && difficulty !== 'facil' && timeLeft !== null
            ? (timeLeft <= 3 && timeLeft > 0 ? "bg-[#FF4757]/40" : timeLeft <= 5 && timeLeft > 0 ? "bg-[#FF9F43]/40" : "bg-transparent")
            : "bg-transparent"
        )}
      />

      {/* Player Left Notification */}
      <AnimatePresence>
        {leftPlayerName && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] bg-red-500 text-white px-6 py-3 rounded-2xl border-4 border-white shadow-[4px_4px_0px_#1a0533]"
          >
            <p className="font-black text-sm uppercase whitespace-nowrap">
              ✨ {leftPlayerName} saiu da sala
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Host Left - Room Closed Notification */}
      <AnimatePresence>
        {hostLeft && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white border-4 border-[#1a0533] rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-[8px_8px_0px_#1a0533] max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl mx-auto flex items-center justify-center">
                <X className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black uppercase text-[#1a0533]">Sala Encerrada</h3>
              <p className="text-[#1a0533]/70 font-medium text-center">O host saiu da sala.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <p className="text-game-border/60 font-medium">{isSolo ? "Seu progresso nesta partida será perdido." : (!isSolo && roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost) ? "A sala será encerrada para todos os jogadores." : "Você sairá da sala e a partida continuará para os demais."} Tem certeza?</p>
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
                    if (!isSolo && roomId) {
                      const me = playersRef.current.find(p => p.id === localPlayerId);
                      if (me?.isHost) {
                        // Host: delete room and all players
                        multiplayerService.deleteRoomWithKeepalive(roomId);
                        // Clean up local state immediately
                        setPlayers([]);
                        setRoomId(null);
                        setLocalPlayerId(null);
                        setView("home");
                        setIsGameActive(false);
                        return;
                      } else {
                        multiplayerService.leaveRoom();
                      }
                    }
                    setView("home");
                    setIsGameActive(false);
                  }}
                  className="flex-1 p-4 bg-game-danger text-white font-black rounded-xl hover:bg-red-600 transition-colors shadow-[4px_4px_0px_#450a0a]"
                >
                  {(!isSolo && roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost) ? "Encerrar Sala" : "Sair"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center justify-center relative z-10 overflow-y-auto no-scrollbar">

        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="w-full flex-grow flex flex-col items-center justify-center gap-[1.5vh] px-4 py-2"
            >
              {/* GAME TITLE - CCB QUIZ */}
              <motion.div
                className="relative mb-4 flex flex-col items-center shrink-0"
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 120 }}
              >
                <div className="relative z-10 text-center">
                  <motion.h1
                    className="text-[45px] sm:text-[60px] md:text-[80px] font-black italic uppercase tracking-tighter leading-none m-0 p-0"
                    style={{
                      color: '#FFD700',
                      WebkitTextStroke: '4px #1a0533',
                      paintOrder: 'stroke fill',
                      filter: 'drop-shadow(6px 6px 0px #1a0533)',
                    }}
                    animate={reducedMotion ? {} : { rotate: [-1.5, 1.5, -1.5], scale: [1, 1.03, 1] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    CCB
                  </motion.h1>
                  <motion.div
                    className="bg-[#9B59F5] border-2 md:border-4 border-[#1a0533] px-4 md:px-6 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl shadow-[4px_4px_0px_#1a0533] mt-[-15px] md:mt-[-20px] relative z-20"
                    animate={reducedMotion ? {} : { rotate: [2, -2, 2], y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  >
                    <span className="text-xl sm:text-2xl md:text-3xl font-black italic uppercase text-white cartoon-text" style={{ WebkitTextStroke: '1px #1a0533' }}>QUIZ</span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/70 italic mt-3 md:mt-4"
                    style={{ filter: 'drop-shadow(1px 1px 0px rgba(26,5,51,0.5))' }}
                  >
                    Desenvolvido por Guilherme Alves
                  </motion.p>
                </div>

                <div className="absolute -top-6 -right-10 animate-pulse">
                  <Sparkles className="text-yellow-300 w-10 h-10 drop-shadow-md" />
                </div>
              </motion.div>
              {/* GARTIC STYLE CONTENT CONTAINER */}
              <div className="w-full flex-grow flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 py-2 px-4 max-w-6xl mx-auto">

                {/* LEFT SIDE: AVATAR PANEL */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative group p-6 md:p-10 bg-white/10 rounded-[4rem] border-4 border-[#1a0533]/20 shadow-2xl backdrop-blur-md relative transition-transform hover:scale-105">

                    {/* Floating Sparkles decoration */}
                    <div className="absolute -top-4 -left-4 animate-pulse">
                      <Star className="text-yellow-400 w-8 h-8 fill-yellow-400 drop-shadow-[2px_2px_0px_#1a0533]" />
                    </div>

                    <div className="relative mb-3 md:mb-4 group flex flex-col items-center">
                      <Avatar url={profile?.avatarUrl || "1.png"} size={window.innerWidth < 768 ? 110 : 140} className="shadow-[6px_6px_0px_#1a0533] md:shadow-[8px_8px_0px_#1a0533]" />

                      <div className="text-center transition-transform mt-4">
                        <div className="relative">
                          <input 
                            type="text" 
                            maxLength={15}
                            value={profile?.nickname}
                            onChange={(e) => {
                              const newNick = e.target.value;
                              setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "1.png" });
                              localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                            }}
                            className="bg-transparent text-lg md:text-2xl font-black text-white italic cartoon-text-white drop-shadow-md tracking-tight leading-tight text-center focus:outline-none border-b-2 border-white/20 focus:border-white/50 transition-colors w-full max-w-[150px] md:max-w-[200px]"
                          />
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsEditingProfile(true)}
                        className="mt-3 md:mt-4 bg-[#FFD700] p-2 md:p-2.5 rounded-lg md:rounded-xl border-[2px] md:border-[3px] border-[#1a0533] text-[#1a0533] shadow-[3px_3px_0px_#1a0533] md:shadow-[4px_4px_0px_#1a0533] hover:bg-yellow-400 transition-colors z-20"
                      >
                        <div className="flex items-center gap-1.5 md:gap-2 px-1">
                          <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4 stroke-[3px]" />
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Mudar Foto</span>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE: MAIN BUTTONS PANEL */}
                <div className="w-full md:w-[400px] flex flex-col gap-5 py-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlayClick}
                    className="btn-cartoon btn-purple w-full py-3 md:py-6 gap-2 md:gap-3"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 border-2 border-white/40 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                      <Play className="w-6 h-6 md:w-7 md:h-7 fill-white text-white translate-x-1" />
                    </div>
                    <span className="font-black uppercase italic tracking-wide cartoon-text-white drop-shadow-xl text-xl md:text-2xl">JOGAR</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { soundService.playClick(); setIsSolo(false); setView("multiplayer_menu"); }}
                    className="btn-cartoon btn-yellow w-full py-3 md:py-6 gap-2 md:gap-3"
                  >
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-black/10 border-2 border-[#1a0533]/30 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                      <Users className="w-6 h-6 md:w-8 md:h-8 text-[#1a0533]" />
                    </div>
                    <span className="font-black uppercase italic tracking-wide text-xl md:text-2xl" style={{ WebkitTextStroke: '2px #1a0533', paintOrder: 'stroke fill', color: '#1a0533' }}>GRUPO</span>
                  </motion.button>

                  {/* BOTTOM ROW ICONS */}
                  <div className="flex justify-between items-center px-4 mt-2">
                    <div className="flex gap-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { soundService.playClick(); setView("hymn_list"); }}
                        className="w-16 h-16 bg-white border-4 border-[#1a0533] rounded-2xl flex items-center justify-center game-shadow cursor-pointer hover:bg-purple-50 transition-colors"
                      >
                        <Music className="w-8 h-8 text-[#9B59F5]" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { soundService.playClick(); setShowSettings(true); }}
                        className="w-16 h-16 bg-white border-4 border-[#1a0533] rounded-2xl flex items-center justify-center game-shadow cursor-pointer hover:bg-purple-50 transition-colors"
                      >
                        <Settings className="w-8 h-8 text-[#9B59F5]" />
                      </motion.button>
                    </div>

                    <div className="flex flex-col items-end opacity-40">
                      <p className="text-[10px] font-black uppercase text-white cartoon-text tracking-widest leading-none">V0.2.5</p>
                      <p className="text-[10px] font-black uppercase text-white cartoon-text tracking-widest">BETA</p>
                    </div>
                  </div>
                </div>

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
                  onClick={() => { soundService.playClick(); setIsSolo(false); setView("mode_selection"); }}
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
                        className="w-full p-2 bg-white border-2 border-[#1a0533] rounded-lg flex flex-col gap-1 game-shadow-hover"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#1a0533]">{game.hostName || "Host"}</span>
                          <span className="font-black text-[10px] text-[#9B59F5]">#{game.id}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[9px] font-black px-2 py-0.5 rounded",
                            game.difficulty === 'facil' ? "bg-[#4ECB71] text-white" :
                            game.difficulty === 'medio' ? "bg-[#FFD700] text-[#1a0533]" :
                            "bg-[#FF4757] text-white"
                          )}>
                            {game.difficulty === 'facil' ? 'LENTO' : game.difficulty === 'medio' ? 'MÉDIO' : 'RÁPIDO'}
                          </span>
                          <span className="text-[9px] font-bold text-gray-600">{game.roundCount} RODADAS</span>
                          <span className="text-[9px] font-black text-[#1a0533]">Qual é o Hino?</span>
                        </div>
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
                <button onClick={() => setView("multiplayer_menu")} className="w-10 h-10 bg-white border-4 border-[#1a0533] rounded-lg flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
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

              {/* PROFILE SETUP SECTION */}
              <div className="bg-purple-50 rounded-2xl p-4 border-2 border-dashed border-[#9B59F5]/30 flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar url={profile?.avatarUrl || "1.png"} size={80} />
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="absolute -bottom-1 -right-1 bg-[#FFD700] p-1.5 rounded-lg border-2 border-[#1a0533] shadow-[2px_2px_0px_#1a0533]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input 
                  type="text" 
                  maxLength={15}
                  placeholder="Seu Nome"
                  value={profile?.nickname}
                  onChange={(e) => {
                    const newNick = e.target.value;
                    setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "1.png" });
                    localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                  }}
                  className="bg-white border-2 border-[#190c33] px-3 py-1.5 rounded-xl font-black text-center text-sm w-full focus:outline-none focus:border-[#9B59F5] shadow-sm"
                />
              </div>

              {/* Setup options (only for creating games) */}
              {(view === "setup" || view === "multiplayer_setup") && (
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
                          { value: 'facil' as Difficulty, label: 'LENTO', desc: 'Tempo ilimitado', color: 'bg-[#4ECB71]', textColor: 'text-white' },
                          { value: 'medio' as Difficulty, label: 'MÉDIO', desc: '20s para responder', color: 'bg-[#FFD700]', textColor: 'text-[#1a0533]' },
                          { value: 'dificil' as Difficulty, label: 'RÁPIDO', desc: '10s para responder', color: 'bg-[#FF4757]', textColor: 'text-white' },
                        ]).map(d => (
                          <button
                            key={d.value}
                            onClick={() => { soundService.playClick(); setDifficulty(d.value); }}
                            className={cn(
                              "py-1.5 px-2 flex flex-col items-center justify-center rounded-lg border-4 border-[#1a0533] transition-all",
                              difficulty === d.value
                                ? `${d.color} ${d.textColor} shadow-[3px_3px_0px_#1a0533] scale-[1.02]`
                                : "bg-gray-100 text-[#1a0533]/50 hover:bg-gray-200"
                            )}
                          >
                            <span className="font-black text-sm uppercase tracking-wider leading-none">{d.label}</span>
                            <span className={cn("text-[9px] font-bold uppercase mt-0.5", difficulty === d.value ? "opacity-90" : "opacity-60")}>{d.desc}</span>
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

          {view === "mode_selection" && (
            <motion.div
              key="mode_selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex-1 min-h-0 max-w-4xl flex flex-col gap-4 px-2"
            >
              <div className="flex items-center justify-between shrink-0">
                <button 
                  onClick={() => {
                    soundService.playClick();
                    setView(isSolo ? "home" : "multiplayer_menu");
                  }} 
                  className="w-10 h-10 md:w-12 md:h-12 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0"
                >
                  <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-[#1a0533]" />
                </button>
                <h2 className="text-2xl md:text-3xl font-black italic uppercase cartoon-text-white drop-shadow-[3px_3px_0px_#1a0533]">Modo de Jogo</h2>
                <div className="w-10 h-10 md:w-12 md:h-12 shrink-0" />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4 space-y-4">
                {/* Mode 1 - Unlocked */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    soundService.playClick();
                    setView("multiplayer_setup");
                  }}
                  className="w-full bg-[#4ECB71] border-4 border-[#1a0533] rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 text-left game-shadow relative overflow-hidden group cursor-pointer"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Music className="w-32 h-32" />
                  </div>
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center shrink-0 shadow-[4px_4px_0px_rgba(26,5,51,0.2)] z-10">
                    <Music className="w-8 h-8 md:w-10 md:h-10 text-[#4ECB71]" />
                  </div>
                  <div className="flex-1 z-10 flex flex-col items-center md:items-start text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-black italic uppercase text-white drop-shadow-[2px_2px_0px_#1a0533]">Qual é o Hino?</h3>
                    <p className="font-bold text-white/90 mt-1 text-sm md:text-base leading-tight">Ouça o trecho e adivinhe o número e título do hino. Seja rápido para ganhar mais pontos!</p>
                  </div>
                  <div className="bg-white text-[#1a0533] px-4 py-2 md:px-6 md:py-3 rounded-xl border-4 border-[#1a0533] font-black uppercase text-xs md:text-sm shrink-0 whitespace-nowrap shadow-[3px_3px_0px_#1a0533] hover:bg-[#FFD700] transition-colors mt-2 md:mt-0 z-10">
                    JOGAR AGORA
                  </div>
                </motion.button>

                {/* Locked Modes */}
                {[
                  { title: "Complete a Letra", desc: "Preencha a palavra que falta na estrofe do hino.", icon: <Check className="w-8 h-8 md:w-10 md:h-10 text-[#FF4757]" /> },
                  { title: "Qual a Voz?", desc: "Identifique se o trecho cantado é Soprano, Contralto, Tenor ou Baixo.", icon: <Users className="w-8 h-8 md:w-10 md:h-10 text-[#FFD700]" /> },
                  { title: "Soprando a Doutrina", desc: "Perguntas de conhecimentos bíblicos e pontos de doutrina.", icon: <MonitorSpeaker className="w-8 h-8 md:w-10 md:h-10 text-[#38bdf8]" /> },
                  { title: "Ritmo Certo", desc: "Aperte o botão no tempo exato do compasso do hino.", icon: <Play className="w-8 h-8 md:w-10 md:h-10 text-[#9B59F5]" /> },
                  { title: "Batalha Musical", desc: "Desafie outro jogador em um duelo de conhecimentos.", icon: <Trophy className="w-8 h-8 md:w-10 md:h-10 text-[#fbbf24]" /> }
                ].map((mode, idx) => (
                  <div
                    key={idx}
                    className="w-full bg-gray-200 border-4 border-[#1a0533] rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 text-left shadow-[4px_4px_0px_rgba(26,5,51,0.2)] relative overflow-hidden grayscale opacity-80"
                  >
                    <div className="absolute inset-0 bg-black/5 z-20 flex items-center justify-center pointer-events-none">
                      <div className="bg-[#1a0533] border-4 border-white px-5 py-2 md:px-8 md:py-3 rounded-2xl rotate-[-5deg] shadow-[4px_4px_0px_rgba(0,0,0,0.5)]">
                        <span className="text-white font-black italic uppercase tracking-widest text-lg md:text-2xl drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">Em Breve</span>
                      </div>
                    </div>
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center shrink-0 opacity-50 shadow-[4px_4px_0px_rgba(26,5,51,0.1)]">
                      {mode.icon}
                    </div>
                    <div className="flex-1 z-10 flex flex-col items-center md:items-start text-center md:text-left opacity-50">
                      <h3 className="text-xl md:text-2xl font-black italic uppercase text-[#1a0533]">{mode.title}</h3>
                      <p className="font-bold text-[#1a0533]/70 mt-1 text-sm md:text-base leading-tight">{mode.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                  {isSolo ? (
                    <button onClick={() => setView("home")} className="w-11 h-11 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                      <ArrowLeft className="w-5 h-5 text-[#1a0533]" />
                    </button>
                  ) : (
                    <button onClick={() => { soundService.playClick(); setShowExitConfirm(true); }} className="w-11 h-11 bg-red-500 border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                      <X className="w-5 h-5 text-white" />
                    </button>
                  )}
                  <div className="bg-white border-4 border-[#1a0533] px-4 py-1.5 rounded-xl game-shadow">
                    <span className="text-base font-black italic uppercase tracking-tighter cartoon-text text-[#1a0533]">SALA: <span className="text-[#9B59F5]">{roomId || "SOLO"}</span></span>
                  </div>
                </div>

                {!isSolo && roomId && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { soundService.playClick(); setShowQrModal(true); }}
                    className="btn-cartoon btn-yellow px-4 py-1.5 text-xs gap-2 whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Convidar
                  </motion.button>
                )}

                {/* Invite Modal */}
                {showQrModal && roomId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowQrModal(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.8, y: 30 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.8, y: 30 }}
                      onClick={e => e.stopPropagation()}
                      className="bg-white border-4 border-[#1a0533] rounded-[2rem] p-6 flex flex-col items-center gap-4 shadow-[8px_8px_0px_#1a0533] max-w-sm w-full"
                    >
                      <h3 className="text-xl font-black uppercase italic text-[#1a0533] cartoon-text">Convidar Amigos</h3>
                      
                      {showQrCode ? (
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="bg-white border-4 border-[#1a0533] rounded-2xl p-2 shadow-[4px_4px_0px_#1a0533]">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?room=' + roomId)}`}
                              alt="QR Code da sala"
                              className="w-36 h-36 rounded-xl"
                            />
                          </div>
                          <button
                            onClick={() => setShowQrCode(false)}
                            className="text-xs text-[#9B59F5] font-black uppercase hover:underline"
                          >
                            Voltar
                          </button>
                        </div>
                      ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowQrCode(true)}
                        className="w-full btn-cartoon btn-purple p-4 flex items-center justify-center gap-3"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/></svg>
                        <span className="font-black uppercase">QR Code</span>
                      </motion.button>
                      )}

                      {/* Copy Link Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          soundService.playClick();
                          const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
                          navigator.clipboard.writeText(link);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="w-full btn-cartoon btn-green p-4 flex items-center justify-center gap-3"
                      >
                        <Globe className="w-6 h-6" />
                        <span className="font-black uppercase">{copied ? "Link Copiado!" : "Copiar Link"}</span>
                      </motion.button>

                      {/* Room Code Display */}
                      <div className="w-full bg-[#FFD700] border-4 border-[#1a0533] rounded-xl p-4 flex flex-col items-center gap-2 shadow-[4px_4px_0px_#1a0533]">
                        <span className="text-xs font-black uppercase text-[#1a0533]/70">Código da Sala</span>
                        <div className="text-3xl font-black italic tracking-widest text-[#1a0533]">{roomId}</div>
                      </div>

                      <button
                        onClick={() => setShowQrModal(false)}
                        className="w-full py-2 bg-gray-100 border-4 border-[#1a0533] rounded-xl font-black uppercase text-sm hover:bg-gray-200 transition-colors cursor-pointer shadow-[3px_3px_0px_#1a0533]"
                      >
                        Fechar
                      </button>
                    </motion.div>
                  </motion.div>
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
                            <div className="mb-2 pointer-events-none">
                              <Avatar url={p.avatar} size={100} className="rounded-2xl" />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-20 h-20 rounded-2xl border-4 border-[#1a0533] flex items-center justify-center text-3xl font-black",
                              p.isReady ? "bg-[#4ECB71] text-white" : "bg-white text-[#1a0533]"
                            )}>
                              {p.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="font-black text-xs truncate w-full text-center text-[#1a0533]">{p.nickname}</p>
                          <div className={cn(
                            "px-3 py-1 rounded-full border-2 border-[#1a0533] text-[9px] font-black uppercase tracking-wider mt-1",
                            p.isReady ? "bg-[#4ECB71] text-white shadow-[2px_2px_0px_#1a0533]" : "bg-white text-gray-500"
                          )}>
                            {p.isReady ? "Pronto!" : "Aguardando"}
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
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { soundService.playClick(); setShowExitConfirm(true); }}
                  className="w-10 h-10 md:w-11 md:h-11 bg-white border-4 border-[#1a0533] rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:bg-red-50 transition-colors shrink-0"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6 text-[#1a0533]" />
                </motion.button>

                <div className="cartoon-panel bg-white px-3 md:px-5 py-1 md:py-2 flex items-center gap-1 md:gap-2">
                  <span className="hidden md:block text-[10px] font-black opacity-40 uppercase tracking-widest text-[#1a0533]">Round</span>
                  <span className="text-lg md:text-2xl font-black italic text-[#9B59F5]">{currentRound + 1}<span className="text-sm md:text-lg opacity-50">/{roundCount}</span></span>
                </div>

                <div className="flex-grow max-w-md h-7 md:h-8 bg-white border-[3px] md:border-4 border-[#1a0533] rounded-full overflow-hidden relative game-shadow shadow-[3px_3px_0px_#1a0533]">
                  <motion.div
                    initial={false}
                    animate={{ width: `${Math.max(0, (timeLeft || 0) / (TIME_LIMITS[difficulty] || 1)) * 100}%` }}
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

                {!showResult && selectedOption && players.some(p => !p.hasAnswered) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                  >
                    <div className="bg-[#9B59F5] border-4 border-[#1a0533] px-8 py-4 rounded-[2rem] shadow-[8px_8px_0px_#1a0533] flex flex-col items-center gap-4 animate-pulse backdrop-blur-sm">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-white font-black uppercase italic tracking-widest text-base md:text-xl cartoon-text-white">Aguardando jogadores...</span>
                    </div>
                  </motion.div>
                )}

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

              {/* Mini Placar fixo no rodapé para desktop, escondido no mobile */}
              <div className="hidden md:flex w-full h-16 shrink-0 bg-white border-4 border-[#1a0533] rounded-[2rem] p-3 items-center justify-center gap-4 overflow-x-auto no-scrollbar shadow-[0px_4px_0px_rgba(26,5,51,0.2)]">
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
              initialAvatarUrl={profile?.avatarUrl}
              onSave={saveProfile}
              onCancel={() => setIsEditingProfile(false)}
            />
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white border-4 border-[#1a0533] p-6 rounded-3xl w-full max-w-md flex flex-col gap-4 relative shadow-[8px_8px_0px_#1a0533]"
             >
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 w-10 h-10 bg-gray-100 border-2 border-[#1a0533] rounded-xl flex items-center justify-center hover:bg-gray-200">
                   <X className="w-6 h-6 text-[#1a0533]" />
                </button>
                <h2 className="text-2xl font-black italic uppercase text-[#1a0533] tracking-tighter">Testar Conexões</h2>
                <div className="flex flex-col gap-3 mt-4">
                   <button onClick={async () => {
                     setTestStatus(prev => ({ ...prev, supabase: 'testing' }));
                     try {
                        const { error } = await supabase.from('hymn_snippets').select('count').single();
                        setTestStatus(prev => ({ ...prev, supabase: !error ? 'ok' : 'error' }));
                     } catch(e) { setTestStatus(prev => ({ ...prev, supabase: 'error' })); }
                   }} className="btn-cartoon btn-blue py-3 font-bold flex items-center justify-between px-6">
                      <span>Testar Banco (Supabase)</span>
                      <div className={cn("w-4 h-4 rounded-full border-2 border-black/20", testStatus.supabase === 'idle' ? 'bg-white/40' : testStatus.supabase === 'testing' ? 'bg-yellow-400 animate-pulse' : testStatus.supabase === 'ok' ? 'bg-green-400' : 'bg-red-500')} />
                   </button>
                   <button onClick={async () => {
                      setTestStatus(prev => ({ ...prev, hymns: 'testing' }));
                      if (hymns.length > 0) {
                         setTestStatus(prev => ({ ...prev, hymns: 'ok' }));
                      } else {
                         setIsLoading(true);
                         await loadHymns();
                         setTestStatus(prev => ({ ...prev, hymns: hymns.length > 0 ? 'ok' : 'error' }));
                         setIsLoading(false);
                      }
                   }} className="btn-cartoon btn-yellow py-3 font-bold flex items-center justify-between px-6">
                      <span>Testar Hinos</span>
                      <div className={cn("w-4 h-4 rounded-full border-2 border-black/20", testStatus.hymns === 'idle' ? 'bg-white/40' : testStatus.hymns === 'testing' ? 'bg-yellow-400 animate-pulse' : testStatus.hymns === 'ok' ? 'bg-green-400' : 'bg-red-500')} />
                   </button>
                   <button onClick={() => {
                      setTestStatus(prev => ({ ...prev, multiplayer: 'testing' }));
                      // Postgres realtime check implies DB is online
                      setTimeout(() => setTestStatus(prev => ({ ...prev, multiplayer: testStatus.supabase === 'error' ? 'error' : 'ok' })), 1000);
                   }} className="btn-cartoon btn-purple py-3 font-bold text-white flex items-center justify-between px-6">
                      <span>Testar Multiplayer</span>
                      <div className={cn("w-4 h-4 rounded-full border-2 border-white/20", testStatus.multiplayer === 'idle' ? 'bg-white/30' : testStatus.multiplayer === 'testing' ? 'bg-yellow-400 animate-pulse' : testStatus.multiplayer === 'ok' ? 'bg-[#4ECB71]' : 'bg-[#FF4757]')} />
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
