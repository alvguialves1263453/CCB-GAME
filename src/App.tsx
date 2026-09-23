import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, User, ChevronRight, ArrowLeft, ArrowRight, Play, Trophy, Loader2, RefreshCw, X, Wifi, Search, Globe, Signal, Music, Settings, Info, Check, AlertCircle, Star, Sparkles, Plus, Key, MonitorSpeaker, Pencil, Share2, BookOpen, Zap, Flame, Smartphone, Monitor, Tablet } from "lucide-react";

const RankingCountdown = ({ onComplete }: { onComplete: () => void }) => {
  const [secondsLeft, setSecondsLeft] = useState(60);
  
  useEffect(() => {
    if (secondsLeft <= 0) {
      onComplete();
      return;
    }
    
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onComplete]);
  
  return (
    <div className="flex items-center justify-center gap-2 py-2 bg-[#2D4A7A] border border-slate-200 rounded-xl">
      <span className="text-sm font-black uppercase text-white/70">Fechando em</span>
      <span className="text-xl font-black text-white">{secondsLeft}s</span>
    </div>
  );
};

const AnimatedPoints = React.memo(({ points }: { points: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    // OTIMIZAÇÃO: animação em 60ms steps (era 20ms) + menos re-renders
    let raf: number;
    let current = 0;
    const step = Math.max(1, Math.floor(points / 12));
    const tick = () => {
      current = Math.min(current + step, points);
      setDisplay(current);
      if (current < points) raf = window.setTimeout(tick, 45) as unknown as number;
    };
    raf = window.setTimeout(tick, 45) as unknown as number;
    return () => clearTimeout(raf);
  }, [points]);
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="text-3xl md:text-5xl font-black italic text-[#2D4A7A] drop-shadow-sm will-change-transform"
    >
      +{display}
    </motion.div>
  );
});
AnimatedPoints.displayName = 'AnimatedPoints';
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";
import { supabase } from "./lib/supabase";
import { fetchHymns, generateQuestions, type Hymn, type Question } from "./services/hymnService";
import { multiplayerService, type Room, type Player as DBPlayer } from "./services/multiplayerService";
import { bibliaService, type BibliaRoom, type BibliaPlayer } from "./services/bibliaService";
import { drawingService } from "./services/drawingService";
import { soundService } from "./lib/soundService";
import { Avatar } from "./components/Avatar";
// Lazy (code-splitting): Konva+DrawingGame e grade de avatares só baixam quando abrir.
// Avatar fica síncrono (leve, usado nas listas).
const ProfileCreator = React.lazy(() => import("./components/ProfileCreator").then(m => ({ default: m.ProfileCreator })));
const DrawingGame = React.lazy(() => import("./components/DrawingGame").then(m => ({ default: m.DrawingGame })));
const QuemSouEuGame = React.lazy(() => import("./components/QuemSouEuGame").then(m => ({ default: m.QuemSouEuGame })));
import { presenceService, type OnlinePlayer } from "./services/presenceService";
import { Edit2 } from "lucide-react";

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
    <path d="M30 75 C15 75 8 65 8 52 C8 42 18 38 18 35 C18 32 12 28 12 20 C12 10 20 5 30 5 C40 5 48 10 48 20 C48 28 42 32 42 35 C42 38 52 42 52 52 C52 65 45 75 30 75Z" fill="url(#violinGrad)" stroke="#09090B" strokeWidth="3" />
    <path d="M22 45 Q30 40 38 45" stroke="#09090B" strokeWidth="2.5" fill="none" />
    <rect x="28" y="2" width="4" height="74" rx="2" fill="#09090B" />
    <circle cx="20" cy="55" r="3" fill="#09090B" />
    <circle cx="40" cy="55" r="3" fill="#09090B" />
    <path d="M20 52 Q20 58 23 58" stroke="#09090B" strokeWidth="1.5" fill="none" />
    <path d="M40 52 Q40 58 37 58" stroke="#09090B" strokeWidth="1.5" fill="none" />
    <circle cx="30" cy="2" r="5" fill="#5D2E17" stroke="#09090B" strokeWidth="2" />
  </svg>
);

const TrumpetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 1.4} height={size} viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFF2A7" />
        <stop offset="50%" stopColor="#A3E635" />
        <stop offset="100%" stopColor="#B8860B" />
      </linearGradient>
    </defs>
    <path d="M10 35 L50 35 L50 25 L10 25 Q5 25 5 30 Q5 35 10 35Z" fill="url(#goldGrad)" stroke="#09090B" strokeWidth="3" />
    <path d="M50 30 L85 30 L95 15 L95 45 L85 30" fill="url(#goldGrad)" stroke="#09090B" strokeWidth="3" strokeLinejoin="round" />
    <rect x="25" y="15" width="6" height="20" rx="3" fill="url(#goldGrad)" stroke="#09090B" strokeWidth="2.5" />
    <rect x="35" y="12" width="6" height="23" rx="3" fill="url(#goldGrad)" stroke="#09090B" strokeWidth="2.5" />
    <rect x="45" y="15" width="6" height="20" rx="3" fill="url(#goldGrad)" stroke="#09090B" strokeWidth="2.5" />
    <circle cx="28" cy="12" r="4" fill="#A3E635" stroke="#09090B" strokeWidth="2" />
    <circle cx="38" cy="9" r="4" fill="#A3E635" stroke="#09090B" strokeWidth="2" />
    <circle cx="48" cy="12" r="4" fill="#A3E635" stroke="#09090B" strokeWidth="2" />
  </svg>
);

const SaxophoneSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M35 10 Q45 10 45 25 L45 65 Q45 80 30 80 Q15 80 15 65 L15 55" stroke="#A3E635" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M45 20 L45 60 Q45 75 30 75 Q15 75 15 60 L15 50" stroke="#B8860B" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.4" />
    <ellipse cx="15" cy="55" rx="12" ry="8" fill="#A3E635" stroke="#09090B" strokeWidth="3" />
    <circle cx="35" cy="10" r="6" fill="#8B4513" stroke="#09090B" strokeWidth="2.5" />
    <circle cx="45" cy="30" r="4" fill="#EAD196" stroke="#09090B" strokeWidth="2" />
    <circle cx="45" cy="40" r="4" fill="#EAD196" stroke="#09090B" strokeWidth="2" />
    <circle cx="45" cy="50" r="4" fill="#EAD196" stroke="#09090B" strokeWidth="2" />
    <path d="M48 30 L53 30" stroke="#09090B" strokeWidth="2" />
    <path d="M48 40 L53 40" stroke="#09090B" strokeWidth="2" />
    <path d="M48 50 L53 50" stroke="#09090B" strokeWidth="2" />
  </svg>
);

const TubaSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 1.2} height={size * 1.3} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 15 Q65 15 65 40 L65 60 Q65 75 40 75 L30 75 Q10 75 10 60 L10 50" stroke="#B8860B" strokeWidth="12" strokeLinecap="round" fill="none" />
    <ellipse cx="10" cy="45" rx="15" ry="10" fill="#DAA520" stroke="#09090B" strokeWidth="3.5" />
    <circle cx="40" cy="15" r="8" fill="#8B6914" stroke="#09090B" strokeWidth="3" />
    <rect x="55" y="35" width="10" height="25" rx="4" fill="#B8860B" stroke="#09090B" strokeWidth="2.5" />
    <circle cx="60" cy="40" r="3" fill="#FFE400" />
    <circle cx="60" cy="50" r="3" fill="#FFE400" />
  </svg>
);

const ClarinetSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size * 0.5} height={size * 1.5} viewBox="0 0 30 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="5" width="14" height="80" rx="2" fill="#09090B" stroke="#2D1B69" strokeWidth="1" />
    <rect x="11" y="5" width="8" height="80" fill="#2D1B69" />
    <path d="M8 85 L22 85 L28 98 L2 98 L8 85" fill="#09090B" stroke="#09090B" strokeWidth="2" />
    {[20, 30, 40, 50, 60, 70].map(y => (
      <React.Fragment key={y}>
        <circle cx="15" cy={y} r="3" fill="#8B5CF6" stroke="#fff" strokeWidth="1" />
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

const MusicalNotesBackground = React.memo(({ reducedMotion }: { reducedMotion?: boolean }) => {
  const notes = React.useMemo(() => ["♪", "♫", "♬", "♩", "♭", "♮", "♯", "𝄞"], []);
  const noteColors = React.useMemo(() => ["#2D4A7A", "#C9A86A", "#6B8CAE", "#5A8A6B", "#94A3B8", "#B45309"], []);
  // OTIMIZAÇÃO MOBILE: 12 notas desktop, 6 em reducedMotion (era 40/8) - reduz 70% CPU/GPU
  const noteCount = reducedMotion ? 6 : 12;
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      {[...Array(noteCount)].map((_, i) => {
        const note = notes[i % notes.length];
        const color = noteColors[i % noteColors.length];
        const spawnFromLeft = i % 2 === 0;
        const startX = spawnFromLeft ? -10 : 110;
        const startY = (i * 8) % 100;
        const delay = (i * 1.2) % 12;
        const duration = 18 + (i * 2) % 18;
        const size = 18 + (i * 4) % 24;

        return (
          <motion.div
            key={`note-${i}`}
            initial={{ x: `${startX}vw`, y: `${startY}vh`, opacity: 0 }}
            animate={{
              x: spawnFromLeft ? "110vw" : "-10vw",
              opacity: [0, 0.28, 0.28, 0],
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "linear",
              // Desativa rotação 360 (cara) e y-oscilação via JS - usa apenas x+opacity no compositor
            }}
            className="absolute font-black select-none pointer-events-none will-change-transform"
            style={{
              fontSize: `${size}px`,
              color,
              WebkitTextStroke: '1px rgba(255,255,255,0.9)',
              paintOrder: 'stroke fill',
              zIndex: 0,
              // Remove drop-shadow pesado em mobile - substituído por text-shadow leve via CSS
            }}
          >
            {note}
          </motion.div>
        );
      })}

      {/* Instrumentos removidos a pedido do usuário */}
    </div>
  );
});
MusicalNotesBackground.displayName = 'MusicalNotesBackground';


type Difficulty = 'facil' | 'medio' | 'dificil' | 'aleatorio';
type HinoDifficulty = 'sem_tempo' | 'medio' | 'rapido';

const TIME_LIMITS = {
  // Hino Mode
  sem_tempo: Infinity,
  medio: 20,
  rapido: 10,
  // Biblia Mode
  facil: Infinity,
  dificil: 10,
  aleatorio: 20,
};



export default function App() {
  const [view, setView] = useState<ViewState>("home");
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [nearbyRooms, setNearbyRooms] = useState<{ id: string; hostName: string; hostAvatar?: string; difficulty?: string; roundCount: number; gameType: string }[]>([]);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);

  const refreshNearbyRooms = () => {
    soundService.playClick();
    setIsRefreshingRooms(true);
    multiplayerService.stopDiscoveryListener();
    multiplayerService.startDiscoveryListener((rooms) => {
      setNearbyRooms(rooms);
      setTimeout(() => setIsRefreshingRooms(false), 800);
    });
  };
  const [gameCountdown, setGameCountdown] = useState<number | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundCount, setRoundCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('facil');
  const [hinoDifficulty, setHinoDifficulty] = useState<HinoDifficulty>('sem_tempo');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; option: string } | null>(null);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [resultCountdown, setResultCountdown] = useState<number | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [isSolo, setIsSolo] = useState(true);
  const [botCount, setBotCount] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showUnreadyConfirm, setShowUnreadyConfirm] = useState(false);
  const [showReconnect, setShowReconnect] = useState<{ roomId: string; playerId: string; isHost: boolean; gameType: string } | null>(null);
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [isManualJoin, setIsManualJoin] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const isHost = players.find(p => p.id === localPlayerId)?.isHost || false;
  const RECONNECT_KEY = 'ccb_reconnect_v1';
  const saveReconnect = (roomId: string, playerId: string, isHost: boolean, gameType: string) => {
    try { localStorage.setItem(RECONNECT_KEY, JSON.stringify({ roomId, playerId, isHost, gameType, ts: Date.now() })); } catch {}
  };
  const clearReconnect = () => { try { localStorage.removeItem(RECONNECT_KEY); } catch {} };
  const [showSettings, setShowSettings] = useState(false);
  const [bgMusicOn, setBgMusicOn] = useState(false); // Música desativada por padrão
  const [leftPlayerName, setLeftPlayerName] = useState<string | null>(null);
  const [hostLeft, setHostLeft] = useState(false);
  const [frozenPlayers, setFrozenPlayers] = useState<Player[]>([]);
  const finalPlayersRef = useRef<Player[]>([]);
  const [testStatus, setTestStatus] = useState({
    supabase: 'idle',
    hymns: 'idle',
    multiplayer: 'idle'
  });
  const [showHelp, setShowHelp] = useState(false);
  const [stats, setStats] = useState({
    totalHymns: 0,
    bibliaEasy: 0,
    bibliaMedium: 0,
    bibliaHard: 0,
    bibliaTotal: 0
  });
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  // Meu ID de presença (sessionStorage): o selo <você> casa por ID, nunca por
  // apelido+avatar — todo mundo novo usa o padrão "Maestro"+irmaos/1.png e
  // marcava VOCÊ em vários cards ao mesmo tempo. Leitura ao vivo (não snapshot)
  // porque o service pode regenerar o id após pagehide/visibility.
  const myPresenceId: string | null = (() => {
    try { return presenceService.getPresenceId(); } catch { return null; }
  })();
  const [showOnlineList, setShowOnlineList] = useState(true);
  const [selectedOnlinePlayer, setSelectedOnlinePlayer] = useState<OnlinePlayer | null>(null);

  // Fetch Stats for Help Modal
  useEffect(() => {
    const fetchStats = async () => {
      // Unique Hymns count (counting unique hymn_ids)
      const { data: hData } = await supabase.from('hymn_snippets').select('hymn_id');
      const uniqueHymnsCount = hData ? new Set(hData.map(h => h.hymn_id)).size : 0;
      
      // Biblia counts by difficulty
      const { data: bData } = await supabase.from('biblia_perguntas').select('dificuldade');
      
      if (bData) {
        const counts = bData.reduce((acc: any, curr: any) => {
          const diff = curr.dificuldade || 'facil';
          acc[diff] = (acc[diff] || 0) + 1;
          acc.total++;
          return acc;
        }, { facil: 0, medio: 0, dificil: 0, total: 0 });

        setStats({
          totalHymns: uniqueHymnsCount,
          bibliaEasy: counts.facil,
          bibliaMedium: counts.medio,
          bibliaHard: counts.dificil,
          bibliaTotal: counts.total
        });
      } else {
        setStats(prev => ({ ...prev, totalHymns: uniqueHymnsCount }));
      }
    };
    fetchStats();
  }, []);

  // Drawing game states
  const [drawingCategory, setDrawingCategory] = useState<string>('Todos');
  const [drawingGameMode, setDrawingGameMode] = useState(false);
  const [drawingRoomId, setDrawingRoomId] = useState<string | null>(null);
  const [drawingLocalPlayerId, setDrawingLocalPlayerId] = useState<string | null>(null);
  const [drawingPlayers, setDrawingPlayers] = useState<any[]>([]);
  const [drawingRound, setDrawingRound] = useState(1);
  const [drawingScoreGoal, setDrawingScoreGoal] = useState(500);
  const [drawingCategories, setDrawingCategories] = useState<string[]>([]);
  const [drawingCurrentPrompt, setDrawingCurrentPrompt] = useState<string>('');
  const [drawingTimeLeft, setDrawingTimeLeft] = useState<number>(60);
  const [drawingCountdown, setDrawingCountdown] = useState<number | null>(null);
  const [drawingColor, setDrawingColor] = useState("#000000");
  const [drawingTool, setDrawingTool] = useState<"pencil" | "eraser">("pencil");
  const [drawingBrushSize, setDrawingBrushSize] = useState(5);
  const [drawingSubmissions, setDrawingSubmissions] = useState<any[]>([]);
  const [currentDrawingIndex, setCurrentDrawingIndex] = useState(0);
  const [hasSubmittedDrawing, setHasSubmittedDrawing] = useState(false);
  const [drawingVotes, setDrawingVotes] = useState<any[]>([]);
  const [currentVoteStars, setCurrentVoteStars] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [showDrawingAuthor, setShowDrawingAuthor] = useState(false);
  const [drawingFinalRanking, setDrawingFinalRanking] = useState<any[]>([]);
  const [isDrawingHost, setIsDrawingHost] = useState(false);
  const drawingStartTimeRef = useRef<number>(0);
  const drawingVotingStartTimeRef = useRef<number>(0);
  
  // Biblia game states
  const [bibliaGameMode, setBibliaGameMode] = useState(false);
  // Get effective difficulty based on game mode
  const effectiveDifficulty = bibliaGameMode ? difficulty : hinoDifficulty;
  const [bibliaRoomId, setBibliaRoomId] = useState<string | null>(null);
  const [bibliaLocalPlayerId, setBibliaLocalPlayerId] = useState<string | null>(null);
  const [bibliaPlayers, setBibliaPlayers] = useState<BibliaPlayer[]>([]);
  const [bibliaRound, setBibliaRound] = useState(1);
  const [bibliaRoundCount, setBibliaRoundCount] = useState(5);
  const [bibliaCurrentPergunta, setBibliaCurrentPergunta] = useState<string>('');
  const [bibliaOpcoes, setBibliaOpcoes] = useState<string[]>([]);
  const [bibliaTimeLeft, setBibliaTimeLeft] = useState<number>(15);
  const [bibliaCountdown, setBibliaCountdown] = useState<number | null>(null);
  const [bibliaSubmissions, setBibliaSubmissions] = useState<any[]>([]);
  const [bibliaFinalRanking, setBibliaFinalRanking] = useState<BibliaPlayer[]>([]);
  const [bibliaIsHost, setBibliaIsHost] = useState(false);
  const [gameType, setGameType] = useState<string>('hino');
  const bibliaStartTimeRef = useRef<number>(0);
  const [hymnSearchQuery, setHymnSearchQuery] = useState("");
  const [showDifficultyAnnouncement, setShowDifficultyAnnouncement] = useState(false);

  const startTimeRef = useRef<number>(0);
  const lastHitTimeRef = useRef<number>(0);
  const lastHandledRoundRef = useRef<number>(-1);
  // Round em que o som de resultado (multiplayer) já tocou — evita repetir
  const resultSoundRoundRef = useRef<number>(-1);
  // Fallback anti-travamento do quiz multiplayer (realtime pode perder evento):
  const quizRoomSeenRef = useRef<string>(''); // "phase:round" já aplicado
  const quizNextTimerForRef = useRef<string | null>(null); // round que o host já agendou
  const resultCountdownTimerRef = useRef<any>(null);
  const resultCountdownRoundRef = useRef<number>(-1);
  const botTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const lastBotRoundRef = useRef<number>(-1);

  // Refs for reliable socket callbacks
  const isGameActiveRef = useRef(isGameActive);
  const showResultRef = useRef(showResult);
  const currentRoundRef = useRef(currentRound);
  const difficultyRef = useRef(difficulty);
  const hinoDifficultyRef = useRef(hinoDifficulty);
  const roomDeadlineRef = useRef<number | null>(null);
  const questionsRef = useRef(questions);
  const feedbackRef = useRef(feedback);
  const selectedOptionRef = useRef(selectedOption);
  const playersRef = useRef<Player[]>(players);
  const prevPlayersRef = useRef<Player[]>([]);

  const drawingRoomIdRef = useRef(drawingRoomId);
  const drawingGameModeRef = useRef(drawingGameMode);
  const drawingLocalPlayerIdRef = useRef(drawingLocalPlayerId);
  const isDrawingHostRef = useRef(isDrawingHost);
  const bibliaRoomIdRef = useRef(bibliaRoomId);
  const bibliaGameModeRef = useRef(bibliaGameMode);
  const bibliaLocalPlayerIdRef = useRef(bibliaLocalPlayerId);
  const bibliaIsHostRef = useRef(bibliaIsHost);
  const roomIdRef = useRef(roomId);
  const isSoloRef = useRef(isSolo);
  const localPlayerIdRef = useRef(localPlayerId);

  useEffect(() => {
    drawingRoomIdRef.current = drawingRoomId;
    drawingGameModeRef.current = drawingGameMode;
    drawingLocalPlayerIdRef.current = drawingLocalPlayerId;
    isDrawingHostRef.current = isDrawingHost;
    bibliaRoomIdRef.current = bibliaRoomId;
    bibliaGameModeRef.current = bibliaGameMode;
    bibliaLocalPlayerIdRef.current = bibliaLocalPlayerId;
    bibliaIsHostRef.current = bibliaIsHost;
    roomIdRef.current = roomId;
    isSoloRef.current = isSolo;
    localPlayerIdRef.current = localPlayerId;
    
    isGameActiveRef.current = isGameActive;
    showResultRef.current = showResult;
    currentRoundRef.current = currentRound;
    difficultyRef.current = bibliaGameMode ? difficulty : hinoDifficulty;
    hinoDifficultyRef.current = hinoDifficulty;
    questionsRef.current = questions;
    feedbackRef.current = feedback;
    selectedOptionRef.current = selectedOption;
    playersRef.current = players;
  }, [isGameActive, showResult, currentRound, difficulty, hinoDifficulty, questions, feedback, selectedOption, players, bibliaGameMode, drawingRoomId, drawingGameMode, drawingLocalPlayerId, isDrawingHost, bibliaRoomId, bibliaLocalPlayerId, bibliaIsHost, roomId, isSolo, localPlayerId]);

  const [showPodium, setShowPodium] = useState(false);
  const [podiumStep, setPodiumStep] = useState(0); // 0: initial, 1: 3rd, 2: 2nd, 3: 1st
  const showPodiumRef = useRef(false);
  useEffect(() => { showPodiumRef.current = showPodium; }, [showPodium]);

  // Force showResult to false when podium is active
  useEffect(() => {
    if (showPodium) {
      setShowResult(false);
      showResultRef.current = false;
    }
  }, [showPodium]);

  // Música de fundo desativada - nunca toca
  useEffect(() => {
    soundService.stopBgMusic();
    return () => soundService.stopBgMusic();
  }, [view]);

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

    // OTIMIZAÇÃO: Detecta mobile + low-end para ativar reducedMotion (economia 70% GPU)
    const detectReducedMotion = () => {
      try {
        const memory = (navigator as any).deviceMemory;
        const cores = navigator.hardwareConcurrency;
        const isMobile = window.innerWidth < 768 || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const saveData = (navigator as any).connection?.saveData;
        // Ativa reducedMotion em: mobile, save-data, pouca RAM, poucos cores, ou prefers-reduced
        if (isMobile || saveData || prefersReduced || (memory !== undefined && memory < 4) || (cores !== undefined && cores <= 4)) {
          setReducedMotion(true);
        } else {
          setReducedMotion(false);
        }
      } catch {
        setReducedMotion(window.innerWidth < 768);
      }
    };
    detectReducedMotion();
    // Reage a mudanças de viewport / preferência
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => detectReducedMotion();
    mq.addEventListener?.('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mq.removeEventListener?.('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  // Persistence for user profile
  const [profile, setProfile] = useState<{ nickname: string; avatarUrl: string; avatarFileId?: string }>(() => {
    const saved = localStorage.getItem("ccb_quiz_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.avatarUrl === "1.png") parsed.avatarUrl = "irmaos/1.png";
        return parsed;
      } catch (e) {
        console.error("Error loading profile", e);
      }
    }
    return {
      nickname: "Maestro",
      avatarUrl: "irmaos/1.png"
    };
  });

  const saveProfile = async (nick: string, avatarUrl: string, avatarFileId?: string) => {
    const oldUrl = profile.avatarUrl;
    const oldFileId = (profile as any).avatarFileId;
    const isNewImageKit = avatarUrl.includes("ik.imagekit.io");
    const isOldImageKit = oldUrl?.includes("ik.imagekit.io");
    if (isOldImageKit && oldUrl !== avatarUrl) {
      const { imageKitService } = await import("./services/imageKitService");
      imageKitService.deleteAvatar(oldFileId, oldUrl);
    }
    const newProfile: any = { nickname: nick, avatarUrl };
    if (avatarFileId) newProfile.avatarFileId = avatarFileId;
    setProfile(newProfile);
    localStorage.setItem("ccb_quiz_profile", JSON.stringify(newProfile));
    setIsEditingProfile(false);
    soundService.playClick();
  };

  // Fallback DB polling - agora filtra stale igual ao service (35s)
  useEffect(() => {
    const directFetch = async () => {
      const { data, error } = await supabase.from("online_presence").select("*");
      if (!error && data) {
        const cutoff = Date.now() - 35 * 1000;
        const filtered = data.filter((r:any) => !r.updated_at || new Date(r.updated_at).getTime() > cutoff);
        const useData = filtered; // não mostra fantasma
        const mapped = useData.map((row: any) => ({
          id: row.id,
          nickname: row.nickname || "Jogador",
          avatar: row.avatar,
          status: row.status || " Online",
          statusDetail: row.status_detail || "",
          view: row.view || "home",
          gameType: row.game_type,
          device: row.device || undefined,
          onlineAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        })).sort((a:any,b:any)=>a.nickname.localeCompare(b.nickname));
        setOnlinePlayers(mapped);
      }
    };
    directFetch();
    const directPoll = setInterval(directFetch, 3000);
    return () => clearInterval(directPoll);
  }, []);

  // Atualiza instantaneamente seu próprio card em "Quem está online" sem esperar poll
  useEffect(() => {
    const myId = (() => { try { return sessionStorage.getItem("ccb_presence_id") } catch { return null } })();
    if (!myId) return;
    setOnlinePlayers(prev => {
      const idx = prev.findIndex(p => p.id === myId);
      if (idx === -1) return prev; // ainda não carregou do DB, poll vai trazer
      const cur = prev[idx];
      if (cur.nickname === profile.nickname && cur.avatar === profile.avatarUrl) return prev;
      const updated = [...prev];
      updated[idx] = { ...cur, nickname: profile.nickname, avatar: profile.avatarUrl };
      return updated.sort((a,b)=>a.nickname.localeCompare(b.nickname));
    });
  }, [profile]);

  useEffect(() => {
    presenceService.init(profile, view, gameType, setOnlinePlayers);
    return () => { presenceService.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    presenceService.update(profile, view, gameType);
  }, [profile, view, gameType]);

  // Reconexão: se fechou navegador e sala ainda ativa, oferece voltar
  useEffect(() => {
    const checkReconnect = async () => {
      try {
        const raw = localStorage.getItem(RECONNECT_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data?.roomId || !data?.playerId) return;
        if (Date.now() - (data.ts || 0) > 2 * 60 * 60 * 1000) { clearReconnect(); return; }
        // Se já está em sala via URL, não mostra
        const params = new URLSearchParams(window.location.search);
        if (params.get('room') || params.get('drawing') || params.get('biblia')) return;
        if (roomId || bibliaRoomId || drawingRoomId) return;
        // Verifica sala ainda existe (rooms ou biblia_rooms)
        let found = null;
        let tname = 'rooms';
        const { data: r1 } = await supabase.from('rooms').select('id, phase').eq('id', data.roomId).maybeSingle();
        if (r1) { found = r1; tname = 'rooms'; }
        else {
          const { data: r2 } = await supabase.from('biblia_rooms').select('id, phase').eq('id', data.roomId).maybeSingle();
          if (r2) { found = r2; tname = 'biblia_rooms'; }
        }
        if (!found) { clearReconnect(); return; }
        if ((found as any).phase === 'ranking') { clearReconnect(); return; }
        const ptable = tname === 'biblia_rooms' ? 'biblia_players' : 'players';
        const { data: p } = await supabase.from(ptable).select('id').eq('id', data.playerId).eq('room_id', data.roomId).maybeSingle();
        if (!p) { clearReconnect(); return; }
        setShowReconnect(data);
      } catch {}
    };
    const t = setTimeout(checkReconnect, 900);
    return () => clearTimeout(t);
  }, []);

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
      // 1. Regular Multiplayer cleanup
      if (!isSolo && roomId && localPlayerId) {
        const me = playersRef.current.find(p => p.id === localPlayerId);
        multiplayerService.leaveRoom(roomId, localPlayerId, me?.isHost);
      } else {
        multiplayerService.leaveRoom();
      }

      // 2. Drawing Game cleanup
      if (drawingRoomId && drawingLocalPlayerId) {
        drawingService.leaveRoom(drawingRoomId, drawingLocalPlayerId, isDrawingHost);
      }

      // 3. Biblia Game cleanup
      if (bibliaRoomId && bibliaLocalPlayerId) {
        bibliaService.leaveRoom(bibliaRoomId, bibliaLocalPlayerId, bibliaIsHost);
      }

      setRoomId(null);
      setLocalPlayerId(null);
      setDrawingRoomId(null);
      setDrawingLocalPlayerId(null);
      setBibliaRoomId(null);
      setBibliaLocalPlayerId(null);
      setIsSolo(true);
      setPlayers([]);
      setFrozenPlayers([]);
      finalPlayersRef.current = [];
      setQuestions([]);
      setCurrentRound(0);
      setIsGameActive(false);
      setShowResult(false);
      lastBotRoundRef.current = -1;
      botTimeoutsRef.current.forEach(clearTimeout);
      botTimeoutsRef.current = [];
      if (resultCountdownTimerRef.current) { clearInterval(resultCountdownTimerRef.current); resultCountdownTimerRef.current = null; }
      resultCountdownRoundRef.current = -1;
      quizNextTimerForRef.current = null;
      quizRoomSeenRef.current = '';
    }
  }, [view]);

  // beforeunload: NÃO deleta sala pra permitir reconexão (DESEJA SE RECONECTAR?)
  // Só limpa presença, a sala fica 2h pra voltar
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Mantém player na sala pra reconectar - não chama leaveRoom/delete
      // Apenas garante que o reconnect fica salvo (já salvo no create/join)
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // Only register once

  // Check for room in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const drawingParam = params.get("drawing");
    const bibliaParam = params.get("biblia");
    
    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setIsSolo(false);
      setIsManualJoin(false);
      setView("multiplayer_join");
    }
    
    if (bibliaParam) {
      // Sala legada biblia_rooms: usa bibliaRoomId e vai para tela de entrada
      // (biblia_setup em modo join) para escolher nome/foto antes do join.
      setBibliaRoomId(bibliaParam.toUpperCase());
      setBibliaGameMode(true);
      setIsSolo(false);
      setIsManualJoin(false);
      setView("biblia_setup");
    }
    
    if (drawingParam) {
      setDrawingRoomId(drawingParam.toUpperCase());
      setDrawingGameMode(true);
      setView("drawing_setup");
    }
    
  }, []);

  // Play sounds on important events
  useEffect(() => {
    if (view === 'ranking') {
      soundService.playVictory();
    }
  }, [view]);

  // Sync prevPlayersRef whenever players changes
  useEffect(() => {
    prevPlayersRef.current = players;
    // Also save to finalPlayersRef for ranking display
    if (view !== 'ranking' && players.length > 0) {
      finalPlayersRef.current = players;
    }
  }, [players, view]);

  // OTIMIZAÇÃO: Fallback polling 8s (era 3s) + evita render se dados iguais + pausa em background
  // Só após o join (localPlayerId): antes disso o convidado está em
  // multiplayer_join escolhendo nome/foto e não pode sofrer auto-nav.
  useEffect(() => {
    if (!roomId || isSolo || view === 'ranking' || !localPlayerId) return;
    if (document.hidden) return; // pausa se aba em segundo plano
    let lastHash = '';
    const pollInterval = setInterval(async () => {
      if (!roomIdRef.current || !localPlayerIdRef.current || document.hidden || viewRef.current === 'ranking') return;
      try {
        const { data } = await supabase.from('players').select('id,nickname,avatar,is_host,is_ready,score,has_answered,joined_at').eq('room_id', roomIdRef.current).order('joined_at', { ascending: true });
        if (!data || data.length === 0) {
          // Sala pode ter sido deletada pelo HOST (lobby/jogo) - expulsa guests imediatamente
          const { data: roomCheck } = await supabase.from('rooms').select('id').eq('id', roomIdRef.current).maybeSingle();
          if (!roomCheck) {
            const meIsHost = playersRef.current.find(p => p.id === localPlayerIdRef.current)?.isHost;
            if (!meIsHost) {
              setHostLeft(true);
              setTimeout(() => { setView('home'); setRoomId(null); setLocalPlayerId(null); setHostLeft(false); }, 2500);
            } else {
              // Host já limpou local, mas garante
              setView('home'); setRoomId(null);
            }
          }
          return;
        }
        // Hash rápido para detectar mudanças sem re-render
        const hash = data.map((r: any) => `${r.id}:${r.score}:${r.is_ready}:${r.has_answered}`).join('|');
        if (hash === lastHash) return; // sem mudanças -> não renderiza
        lastHash = hash;
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
        const currentIds = new Set(dbPlayers.map(p => p.id));
        const prev = prevPlayersRef.current;
        for (const p of prev) {
          if (!currentIds.has(p.id) && p.id !== localPlayerIdRef.current) {
            setLeftPlayerName(p.nickname);
            setTimeout(() => setLeftPlayerName(null), 4000);
            break;
          }
        }
        if (dbPlayers.length === 0 && !isSoloRef.current && roomIdRef.current) {
          const meIsHost = playersRef.current.find(p => p.id === localPlayerIdRef.current)?.isHost;
          if (!meIsHost) {
            alert('A sala foi encerrada pelo host!');
            setView('home');
            setRoomId(null);
          }
        }
        prevPlayersRef.current = dbPlayers;
        if (dbPlayers.length > 0 && viewRef.current !== 'ranking') {
          setPlayers(prev => {
            // Evita setPlayers se dados idênticos
            if (prev.length === dbPlayers.length && prev.every((pl, i) => pl.id === dbPlayers[i].id && pl.score === dbPlayers[i].score && pl.isReady === dbPlayers[i].isReady && pl.hasAnswered === dbPlayers[i].hasAnswered)) {
              return prev;
            }
            return dbPlayers.map(dbp => {
              const existing = prev.find(player => player.id === dbp.id);
              return { ...dbp, lastAnswerTime: existing?.lastAnswerTime || 0 };
            });
          });
        }
      } catch {}
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [roomId, isSolo, view, localPlayerId]);



  // FIX: Ao voltar do background, re-sincroniza imediatamente (evita "não atualiza" 8s)
  useEffect(() => {
    if (!roomId || isSolo || !localPlayerId) return;
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && roomIdRef.current && localPlayerIdRef.current) {
        try {
          const { data } = await supabase.from('players').select('id,nickname,avatar,is_host,is_ready,score,has_answered,joined_at').eq('room_id', roomIdRef.current).order('joined_at', { ascending: true });
          if (data) {
            const dbPlayers = data.map((row: any) => ({
              id: row.id, nickname: row.nickname, avatar: row.avatar, isHost: row.is_host, isReady: row.is_ready, score: row.score || 0, hasAnswered: row.has_answered || false, lastAnswerTime: 0, joinedAt: Number(row.joined_at) || 0
            }));
            if (dbPlayers.length > 0) setPlayers(prev => dbPlayers.map(dbp => ({ ...dbp, lastAnswerTime: prev.find(p => p.id === dbp.id)?.lastAnswerTime || 0 })));
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [roomId, isSolo, localPlayerId]);

  // Máquina de estados da sala do quiz multiplayer. useCallback estável (só refs +
  // setState): alimenta o realtime E o polling de fallback a cada 3s. Sem o fallback,
  // um único evento realtime perdido travava o jogo na mesma tela pra sempre.
  const handleQuizRoomUpdate = React.useCallback((room: any) => {
        // FIX: Host deletou sala -> convidados voltam pra home (antes ficava congelado)
        // Não expulsa quem ainda está na tela de entrada (multiplayer_join):
        // ele ainda nem deu join, precisa escolher nome/foto primeiro.
        if (!room) {
          if (!isSoloRef.current && viewRef.current !== 'ranking' && viewRef.current !== 'home' && viewRef.current !== 'multiplayer_join') {
            setHostLeft(true);
            setLeftPlayerName('O host encerrou a sala');
            setTimeout(() => {
              setView('home');
              setRoomId(null);
              setLocalPlayerId(null);
              setHostLeft(false);
            }, 2500);
          }
          return;
        }

        quizRoomSeenRef.current = room.phase + ':' + room.currentRound;

        setRoundCount(room.roundCount);
        const roomDifficulty = room.difficulty;

        // Sync the correct state based on gameType
        if (room.gameType === 'biblia') {
          setBibliaGameMode(true);
          setDifficulty(roomDifficulty as Difficulty);
        } else {
          setBibliaGameMode(false);
          setHinoDifficulty(roomDifficulty as HinoDifficulty);
        }

        difficultyRef.current = roomDifficulty as any;

        if (room.questions) {
          console.log('[GAME] Questions received:', room.questions.length, room.questions[0]?.pergunta || room.questions[0]?.snippet);
          setQuestions(room.questions);
        }
        setGameType(room.gameType || 'hino');

        const clearResultCountdownTick = () => {
          if (resultCountdownTimerRef.current) { clearInterval(resultCountdownTimerRef.current); resultCountdownTimerRef.current = null; }
          resultCountdownRoundRef.current = -1;
        };

        // State Machine based on Phase
        // Não auto-avança da tela de entrada (multiplayer_join) para o lobby
        // antes do join: o convidado precisa escolher nome/foto e clicar ENTRAR.
        if (room.phase === 'lobby') {
          if (viewRef.current === 'multiplayer_join' && !localPlayerIdRef.current) return;
          if (viewRef.current !== 'lobby') setView('lobby');
          setIsPreparing(false);
          setIsGameActive(false);
          setShowResult(false);
          clearResultCountdownTick();
        } else if (room.phase === 'preparing') {
          if (viewRef.current !== 'game') setView('game');
          setIsPreparing(true);
          setIsGameActive(false);
          setShowResult(false);
          clearResultCountdownTick();

          // Use fixed local countdown to avoid network/device clock drift
          setGameCountdown(3);
        } else if (room.phase === 'answering') {
          if (viewRef.current !== 'game') setView('game');

          // Always set startTime when entering answering phase
          startTimeRef.current = Date.now();

          // Reset UI if entering a new round from the DB
          if (!isGameActiveRef.current || currentRoundRef.current !== room.currentRound) {
             setIsPreparing(false);
             setIsGameActive(true);
             setShowResult(false);
             setCurrentRound(room.currentRound);
             setSelectedOption(null);
             setFeedback(null);
             setResultCountdown(null);
             resultSoundRoundRef.current = -1;
             clearResultCountdownTick();
             setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));

             // Reset timer state for new round
             const diff = difficultyRef.current;
             if (diff !== 'sem_tempo') {
               roomDeadlineRef.current = Date.now() + TIME_LIMITS[diff] * 1000;
             } else {
               roomDeadlineRef.current = null;
             }
             setTimeLeft(diff === 'sem_tempo' ? null : TIME_LIMITS[diff]);
           }
        } else if (room.phase === 'result') {
          setIsGameActive(false);
          setShowResult(true);
          setResultCountdown(3);

          // Contagem regressiva visível de verdade (antes congelava em "3s")
          if (resultCountdownRoundRef.current !== room.currentRound) {
            resultCountdownRoundRef.current = room.currentRound;
            if (resultCountdownTimerRef.current) clearInterval(resultCountdownTimerRef.current);
            resultCountdownTimerRef.current = setInterval(() => {
              setResultCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
            }, 1000);
          }

          // Som de acerto/erro adiado do multiplayer: toca 1x por round, só
          // agora que o resultado foi revelado pra todos (justo).
          if (!isSoloRef.current && resultSoundRoundRef.current !== room.currentRound) {
            resultSoundRoundRef.current = room.currentRound;
            const fb = feedbackRef.current;
            if (fb) {
              if (fb.correct) soundService.playCorrect();
              else if (fb.option && fb.option !== "Tempo Esgotado") soundService.playWrong();
            }
          }

          // FREEZE PLAYERS WHEN SHOWING LAST RESULT (before going to ranking!)
          if (room.currentRound + 1 >= room.roundCount) {
            setFrozenPlayers([...playersRef.current]);
          }

          // Host agenda o próximo round 1x por round (antes cada evento realtime
          // agendava um timer novo — empilhava startRound duplicado)
          const me = playersRef.current.find(p => p.id === localPlayerIdRef.current);
          const rId = roomIdRef.current;
          if (me?.isHost && rId) {
            const timerKey = rId + ':' + room.currentRound;
            if (quizNextTimerForRef.current !== timerKey) {
              quizNextTimerForRef.current = timerKey;
              setTimeout(() => {
                if (room.currentRound + 1 < room.roundCount) {
                  const timeLimitSec = TIME_LIMITS[difficultyRef.current];
                  multiplayerService.startRound(rId, room.currentRound + 1, timeLimitSec);
                } else {
                  // IMPORTANT: Finish game but DON'T change view locally,
                  // the phase ranking listener above will handle it for ALL players (including host)
                  multiplayerService.finishGame(rId);
                }
              }, 4000);
            }
          }
        } else if (room.phase === 'ranking') {
          clearResultCountdownTick();
          // Freeze players when entering ranking - copy current state for display
          if (viewRef.current !== 'ranking' && !showPodiumRef.current) {
            setFrozenPlayers([...playersRef.current]);
            setShowResult(false); // ALWAYS CLEAR RESULT OVERLAY

            // Trigger Cinematic Podium for everyone in multiplayer
            setShowPodium(true);
            setPodiumStep(0);

            // Step-by-step podium revelation
            setTimeout(() => setPodiumStep(1), 1500); // Show 3rd
            setTimeout(() => { setPodiumStep(2); soundService.playTick(); }, 3500); // Show 2nd
            setTimeout(() => { setPodiumStep(3); triggerConfetti(); soundService.playBell(); }, 6000); // Show 1st

            // Finally go to ranking after celebration
            setTimeout(() => {
              setShowPodium(false);
              setView('ranking');
            }, 10000);
          }
        }
  }, []);

  // Handle Multiplayer Subscriptions (STOP when in ranking!)
  // Só após o join (localPlayerId): evita puxar o convidado da tela de
  // entrada (multiplayer_join) para o lobby antes de escolher nome/foto.
  useEffect(() => {
    if (!roomId || isSolo || view === 'ranking' || !localPlayerId) return;

    const unsubscribe = multiplayerService.subscribeToRoom(
      roomId,
      (dbPlayers) => {
        // NEVER show host left message - this breaks the ranking display
        // The game will end naturally and stay on ranking until host closes
        
        // Detect players who left (only during active game, not in ranking)
        const currentIds = new Set(dbPlayers.map(p => p.id));
        const prev = prevPlayersRef.current;
        
        // Check each previous player (only if room has players!)
        if (dbPlayers.length > 0) {
          for (const p of prev) {
            if (!currentIds.has(p.id) && p.id !== localPlayerId) {
              // This player left the room
              setLeftPlayerName(p.nickname);
              setTimeout(() => setLeftPlayerName(null), 4000);
              break; // Only notify once
            }
          }
        }
        
        // Update ref for next comparison
        prevPlayersRef.current = dbPlayers;
        
        // ONLY update if we have players in DB and not going to ranking
        // This prevents overwriting with empty data when players leave
        if (dbPlayers.length > 0 && viewRef.current !== 'ranking') {
          setPlayers(prev => dbPlayers.map(dbp => {
            const existing = prev.find(p => p.id === dbp.id);
            return { ...dbp, lastAnswerTime: existing?.lastAnswerTime || 0 };
          }));
        }
      },
      (room) => {
        handleQuizRoomUpdate(room);
      }
    );

    return () => unsubscribe();
  }, [roomId, isSolo, view, localPlayerId, handleQuizRoomUpdate]);

  // Fallback anti-travamento: o realtime pode perder o evento de fase
  // (result/answering/ranking). Rele a sala a cada 3s e aplica se mudou.
  // Também faz migração de host se o host sumiu (sem host ninguém avança).
  useEffect(() => {
    if (!roomId || isSolo || view === 'ranking' || !localPlayerId) return;
    const pollRoom = setInterval(async () => {
      if (!roomIdRef.current || !localPlayerIdRef.current || document.hidden || viewRef.current === 'ranking') return;
      try {
        const { data: row } = await supabase.from('rooms').select('id,host_id,phase,current_round,round_count,difficulty,deadline_at,questions,game_type').eq('id', roomIdRef.current).maybeSingle();
        if (!row) return;
        const key = (row as any).phase + ':' + (row as any).current_round;
        if (key !== quizRoomSeenRef.current) {
          handleQuizRoomUpdate({
            id: (row as any).id,
            hostId: (row as any).host_id,
            phase: (row as any).phase,
            currentRound: (row as any).current_round,
            roundCount: (row as any).round_count,
            difficulty: (row as any).difficulty,
            deadlineAt: (row as any).deadline_at ? Number((row as any).deadline_at) : null,
            questions: (row as any).questions,
            gameType: (row as any).game_type || 'hino',
          });
        }
        // Migração de host: linha do host sumiu (fechou o app) e eu sou o mais
        // antigo — assumo pra partida não travar pra sempre.
        try {
          const list = playersRef.current;
          const meRow = list.find(p => p.id === localPlayerIdRef.current);
          const hasHost = list.some(p => p.isHost);
          if (meRow && !hasHost && viewRef.current !== 'home') {
            const ordered = [...list].sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
            if (ordered[0] && ordered[0].id === meRow.id && roomIdRef.current) {
              console.log('[MP] host sumiu, assumindo host para destravar a sala');
              supabase.from('players').update({ is_host: true }).eq('id', meRow.id).then(() => {});
              supabase.from('rooms').update({ host_id: meRow.id }).eq('id', roomIdRef.current).then(() => {});
            }
          }
        } catch {}
      } catch {}
    }, 3000);
    return () => clearInterval(pollRoom);
  }, [roomId, isSolo, view, localPlayerId, handleQuizRoomUpdate]);

  // Handle Drawing Game Subscriptions
  // Só após o join (drawingLocalPlayerId): evita puxar o convidado da tela
  // de entrada (drawing_setup) para o lobby antes de escolher nome/foto.
  useEffect(() => {
    if (!drawingRoomId || !drawingGameMode || !drawingLocalPlayerId) return;

    const unsubscribe = drawingService.subscribeToRoom(
      drawingRoomId,
      (dbPlayers) => setDrawingPlayers(dbPlayers),
      (room) => {
        if (!room) {
          if (!isDrawingHostRef.current && viewRef.current !== 'home' && viewRef.current !== 'ranking' && viewRef.current !== 'drawing_setup' && drawingRoomIdRef.current) {
            setHostLeft(true);
            setTimeout(() => {
              setView('home');
              setDrawingRoomId(null);
              setDrawingLocalPlayerId(null);
              setDrawingPlayers([]);
              setHostLeft(false);
            }, 2500);
          }
          return;
        }
        
        setDrawingCurrentPrompt(room.currentPrompt || '');
        if (room.roundCount) setDrawingScoreGoal(room.roundCount);
        
        // State Machine for Drawing Game
        // Não auto-avança da tela de entrada antes do join.
        if (room.phase === 'lobby') {
          if (viewRef.current === 'drawing_setup' && !drawingLocalPlayerIdRef.current) return;
          if (viewRef.current !== 'drawing_lobby') setView('drawing_lobby');
        } else if (room.phase === 'drawing') {
          if (viewRef.current !== 'drawing_game') setView('drawing_game');
          setDrawingRound(room.currentRound);
          // Update time if deadline exists
          if (room.deadline_at) {
            const remaining = Math.max(0, Math.ceil((room.deadline_at - Date.now()) / 1000));
            setDrawingTimeLeft(remaining);
          }
        } else if (room.phase === 'voting') {
          setView('drawing_voting');
        } else if (room.phase === 'ranking') {
          setView('drawing_ranking');
        }
      }
    );

    return () => unsubscribe();
  }, [drawingRoomId, drawingGameMode, drawingLocalPlayerId]);

  // Fetch dynamic categories for Drawing Game
  useEffect(() => {
    if (drawingGameMode) {
      const fetchCategories = async () => {
        const { data } = await supabase.from('desenho_palavras').select('category');
        if (data) {
          const uniqueCats = Array.from(new Set(data.map(d => d.category)));
          setDrawingCategories(uniqueCats);
        }
      };
      fetchCategories();
    }
  }, [drawingGameMode]);

  // Drawing game countdown timer
  useEffect(() => {
    if (view !== 'drawing_game') return;
    
    const interval = setInterval(() => {
      setDrawingTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [view]);

  // Handle biblia Game Subscriptions
  // Só após o join (bibliaLocalPlayerId): evita puxar o convidado da tela
  // de entrada (biblia_setup) para o lobby antes de escolher nome/foto.
  useEffect(() => {
    console.log('[BIBLIA] useEffect:', { bibliaRoomId, bibliaGameMode });
    if (!bibliaRoomId || !bibliaGameMode || !bibliaLocalPlayerId) return;

    const unsubscribe = bibliaService.subscribeToRoom(
      bibliaRoomId,
      (dbPlayers) => {
        console.log('[BIBLIA] Players updated:', dbPlayers);
        setBibliaPlayers(dbPlayers);
      },
      (room) => {
        if (!room) {
          // Host encerrou - expulsa todos da sala (criação ou jogo)
          // Não expulsa quem ainda está na tela de entrada.
          if (!bibliaIsHostRef.current && viewRef.current !== 'home' && viewRef.current !== 'ranking' && viewRef.current !== 'biblia_setup' && bibliaRoomIdRef.current) {
            setHostLeft(true);
            setTimeout(() => {
              setView('home');
              setBibliaRoomId(null);
              setBibliaLocalPlayerId(null);
              setBibliaPlayers([]);
              setHostLeft(false);
            }, 2500);
          }
          return;
        }
        
        setBibliaRoundCount(room.roundCount);
        setBibliaCurrentPergunta(room.questions?.[room.currentRound - 1]?.pergunta || 'N/A');
        setBibliaOpcoes(room.questions?.[room.currentRound - 1]?.options || []);
        
        if (room.phase === 'lobby') {
          if (viewRef.current === 'biblia_setup' && !bibliaLocalPlayerIdRef.current) return;
          if (viewRef.current !== 'biblia_lobby') setView('biblia_lobby');
        } else if (room.phase === 'preparing') {
          console.log('[BIBLIA] preparing phase');
          if (viewRef.current !== 'biblia_game') setView('biblia_game');
          setBibliaCountdown(3);
          
          // Auto start after 3s
          if (bibliaIsHost) {
            setTimeout(async () => {
              const q = room.questions?.[0];
              if (q) {
                await bibliaService.startRound(bibliaRoomId!, 1, 15, q.pergunta);
              }
            }, 3500);
          }
        } else if (room.phase === 'answering') {
          console.log('[BIBLIA] answering, questions:', room.questions);
          if (viewRef.current !== 'biblia_game') setView('biblia_game');
          bibliaStartTimeRef.current = Date.now();
          
          // Set pergunta and options
          const q = room.questions?.[room.currentRound - 1];
          if (q) {
            setBibliaCurrentPergunta(q.pergunta);
            setBibliaOpcoes(q.options || []);
          }
          
          if (room.questions && room.questions.length > 0) {
            const pergunta = room.questions[room.currentRound - 1];
            if (pergunta) {
              setBibliaCurrentPergunta(pergunta.pergunta);
              // Shuffle options
              const options = [pergunta.correta, pergunta.opcao1, pergunta.opcao2, pergunta.opcao3].sort(() => Math.random() - 0.5);
              setBibliaOpcoes(options);
            }
          }
          
          setBibliaRound(room.currentRound);
          setBibliaTimeLeft(15);
        } else if (room.phase === 'result') {
          // Handle result phase
        } else if (room.phase === 'ranking') {
          setBibliaFinalRanking(bibliaPlayers);
          setView('biblia_ranking');
        }
      }
    );

    return () => unsubscribe();
  }, [bibliaRoomId, bibliaGameMode, bibliaLocalPlayerId]);

  // biblia game countdown timer
  useEffect(() => {
    if (view !== 'biblia_game') return;
    
    const interval = setInterval(() => {
      setBibliaTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [view]);

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
    if (isGameActive && !showResult && players.length > 0) {
      const allAnswered = players.every(p => p.hasAnswered);
      console.log("[Solo] check allAnswered:", allAnswered, "players:", players.map(p=>p.id.slice(0,4)+":"+p.hasAnswered), "isSolo:", isSolo, "isGameActive:", isGameActive);
          if (allAnswered) {
        const timer = setTimeout(() => {
          if (isGameActiveRef.current && !showResultRef.current) {
            console.log("[Solo] allAnswered true -> showResult isSolo:", isSoloRef.current);
            if (isSoloRef.current) {
              showResultRef.current = true;
              setIsGameActive(false);
              setShowResult(true);
              setResultCountdown(3);
              const timer = setInterval(() => {
                setResultCountdown(prev => {
                  if (prev !== null && prev <= 0) { clearInterval(timer); nextRoundLocal(); return null; }
                  return prev !== null ? prev - 1 : null;
                });
              }, 1000);
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
          if (!isGameActiveRef.current || showResultRef.current || currentRoundRef.current !== currentRound) return;
          
          setPlayers(current => current.map(p => {
            if (p.id === bot.id && !p.hasAnswered) {
              const isCorrect = Math.random() > (isHard ? 0.2 : 0.4);
              let points = 0;
              if (isCorrect) {
                const timeSpentBot = delay / 1000;
                const limit = TIME_LIMITS[difficultyRef.current] || 999;
                if (difficultyRef.current === 'sem_tempo') points = Math.max(100, Math.floor(1000 - (timeSpentBot * 20)));
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

  // biblia rooms discovery - also on mode_selection
  useEffect(() => {
    if (view === "mode_selection") {
      bibliaService.startDiscoveryListener((rooms) => {
        // Could add to nearby rooms list for biblia
        console.log('biblia rooms:', rooms);
      });
      return () => {
        bibliaService.stopDiscoveryListener();
      };
    }
  }, [view]);

  // Countdown Timer
  useEffect(() => {
    if (gameCountdown !== null && gameCountdown > 0) {
      const timer = setTimeout(() => {
        setGameCountdown(gameCountdown - 1);
        soundService.playCountdown();
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
            startTimeRef.current = Date.now();
          } else {
            roomDeadlineRef.current = null;
          }
          multiplayerService.startRound(roomId, 0, timeLimitSec);
        }
      }
      setGameCountdown(null);
    }
  }, [gameCountdown, isSolo]);

  // Result countdown handled entirely by handleRoundEnd's setInterval

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
    setRoomId(null); // Reset room ID for solo path
    setBibliaGameMode(false); // Default to hino
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
      const result = await multiplayerService.createRoom(profile.nickname, profile.avatarUrl, effectiveDifficulty, roundCount, bibliaGameMode ? 'biblia' : 'hino');
      if (result) {
        setRoomId(result.room.id);
        setLocalPlayerId(result.player.id);
        saveReconnect(result.room.id, result.player.id, true, bibliaGameMode ? 'biblia' : 'hino');
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
        id: Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        nickname: profile.nickname,
        avatar: profile.avatarUrl,
        isHost: true,
        score: 0,
        hasAnswered: false,
        lastAnswerTime: 0,
        isReady: true
      };

      const botNames = [
        { name: "Irmão João", gender: "m" },
        { name: "Irmã Maria", gender: "f" },
        { name: "Irmão Lucas", gender: "m" },
        { name: "Irmã Sarah", gender: "f" },
        { name: "Irmão Davi", gender: "m" },
        { name: "Irmã Rebeca", gender: "f" },
        { name: "Irmão Samuel", gender: "m" },
        { name: "Irmã Ester", gender: "f" }
      ];

      const activeBots = Array.from({ length: botCount }, (_, i) => {
        const botData = botNames[i % botNames.length];
        let avatarPath = "";
        
        if (botData.gender === "m") {
          // Sorteia entre 1 e 40
          const num = Math.floor(Math.random() * 40) + 1;
          avatarPath = `irmaos/${num}.png`;
        } else {
          // Sorteia entre 1 e 15 para irmãs, usando o prefixo irma_
          const num = Math.floor(Math.random() * 15) + 1;
          avatarPath = `irmas/irma_${num}.png`;
        }

        return {
          id: `bot_${i + 1}`,
          nickname: botData.name,
          avatar: avatarPath,
          isHost: false,
          score: 0,
          hasAnswered: false,
          lastAnswerTime: 0,
          isReady: true
        };
      });

      setPlayers([newPlayer, ...activeBots]);
      setLocalPlayerId(newPlayer.id);
      localPlayerIdRef.current = newPlayer.id;
      setIsLoading(false);
      setView("lobby");
    } else {
      // Real Multiplayer
      try {
        if (drawingGameMode && drawingRoomId) {
          const player = await drawingService.joinRoom(drawingRoomId, profile.nickname, profile.avatarUrl);
          if (player) {
            setDrawingLocalPlayerId(player.playerId);
            setIsDrawingHost(false);
            saveReconnect(drawingRoomId, player.playerId, false, 'desenho');
            setDrawingPlayers(prev => {
              if (prev.some(p => p.id === player.playerId)) return prev;
              return [...prev, {
                id: player.playerId,
                nickname: profile.nickname,
                avatar: profile.avatarUrl,
                isHost: false,
                isReady: false,
                totalScore: 0
              }];
            });
            setView("drawing_lobby");
          } else {
            setDrawingGameMode(false);
            setDrawingRoomId(null);
            setDrawingLocalPlayerId(null);
            alert("Sala de desenho não encontrada ou erro ao entrar.");
            setView("home");
          }
        } else if (roomId) {
          // Detect if this room is a drawing room even if not in drawing mode
          const roomData = await drawingService.getRoom(roomId);
          if (roomData && roomData.game_type === 'desenho') {
            setDrawingGameMode(true);
            setDrawingRoomId(roomId);
            const player = await drawingService.joinRoom(roomId, profile.nickname, profile.avatarUrl);
            if (player) {
              setDrawingLocalPlayerId(player.playerId);
              saveReconnect(roomId, player.playerId, false, 'desenho');
              setIsDrawingHost(false);
              setView("drawing_lobby");
            }
            return;
          }

          // Join existing quiz/hino
          // Usa o nome/foto editados na tela de entrada (não o cache antigo).
          const player = await multiplayerService.joinRoom(roomId, profile.nickname.trim(), profile.avatarUrl);
          if (player) {
            try { window.history.replaceState({}, '', window.location.pathname); } catch {}
            setLocalPlayerId(player.id);
            saveReconnect(roomId!, player.id, false, bibliaGameMode ? 'biblia' : 'hino');
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
          // Create new quiz/hino
          setIsSolo(false);
          const result = await multiplayerService.createRoom(profile.nickname, profile.avatarUrl, effectiveDifficulty, roundCount, bibliaGameMode ? 'biblia' : 'hino');
          if (result) {
            setRoomId(result.room.id);
            setLocalPlayerId(result.player.id);
            saveReconnect(result.room.id, result.player.id, true, bibliaGameMode ? 'biblia' : 'hino');
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
    if (navigator.vibrate) navigator.vibrate(20);
    if (!localPlayerId || isSolo || !roomId) return;
    const me = players.find(p => p.id === localPlayerId);
    if (me) {
      const next = !me.isReady;
      setPlayers(prev => prev.map(p => p.id === localPlayerId ? { ...p, isReady: next } : p));
      try {
        await multiplayerService.toggleReady(roomId, next);
      } catch {
        // Rollback em caso de falha de rede
        setPlayers(prev => prev.map(p => p.id === localPlayerId ? { ...p, isReady: !next } : p));
      }
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
    console.log("[Solo] handleStartGameClick isSolo:", isSolo, "bibliaMode:", bibliaGameMode, "hymns:", hymns.length, "roundCount:", roundCount);
    if (isSolo) {
      try {
        const q = await prepareQuestions(bibliaGameMode);
        console.log("[Solo] prepareQuestions result:", q ? q.length : null, q?.[0]);
        if (q && q.length > 0) {
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
          console.log("[Solo] view set to game, countdown 3");
        } else {
          console.error("[Solo] Sem perguntas! q:", q);
          alert("Não foi possível gerar perguntas. Verifique se há hinos/perguntas no Supabase.");
        }
      } catch (e:any) {
        console.error("[Solo] Erro handleStartGameClick:", e);
        alert("Erro ao iniciar solo: " + (e.message||String(e)));
      } finally {
        setIsLoading(false);
      }
    } else {
      const me = players.find(p => p.id === localPlayerId);
      if (!me?.isHost) return;

      const allOthersReady = players.filter(p => !p.isHost).every(p => p.isReady);
      if (!allOthersReady && !forceStart) {
        setShowUnreadyConfirm(true);
        return;
      }

      const q = await prepareQuestions(bibliaGameMode);
      if (q && roomId) {
        setIsLoading(true);
        // Start game in DB using effectiveDifficulty
        await multiplayerService.startGame(roomId, q, roundCount, effectiveDifficulty);
        setIsLoading(false);
      }
    }
  };

  const prepareQuestions = async (isBiblia: boolean = false) => {
    setIsLoading(true);
    
    // Se modo Biblia, buscar de biblia_perguntas
    if (isBiblia) {
      const { data: allPerguntas } = await supabase.from('biblia_perguntas').select('*');
      if (!allPerguntas || allPerguntas.length === 0) {
        alert("Nenhuma pergunta da Biblia!");
        setIsLoading(false);
        return null;
      }

      let selected: any[] = [];

      if (difficulty !== 'aleatorio') {
        const filtered = allPerguntas.filter(p => p.dificuldade === difficulty);
        selected = filtered.sort(() => Math.random() - 0.5).slice(0, roundCount);
      } else {
        // Mixed mode: distribute as equally as possible between difficulties
        const easy = allPerguntas.filter(p => p.dificuldade === 'facil').sort(() => Math.random() - 0.5);
        const medium = allPerguntas.filter(p => p.dificuldade === 'medio').sort(() => Math.random() - 0.5);
        const hard = allPerguntas.filter(p => p.dificuldade === 'dificil').sort(() => Math.random() - 0.5);
        
        const perDiff = Math.ceil(roundCount / 3);
        
        // Pick from each, then shuffle the result
        selected = [
          ...easy.slice(0, perDiff),
          ...medium.slice(0, perDiff),
          ...hard.slice(0, perDiff)
        ].slice(0, roundCount).sort(() => Math.random() - 0.5);
      }

      const q = selected.map((p: any) => {
        // Primeiro cria as opções depois embaralha
        const opts = [p.correta, p.opcao1, p.opcao2, p.opcao3].sort(() => Math.random() - 0.5);
        // Acha o índice da resposta correta
        const correctIdx = opts.indexOf(p.correta);
        return {
          hinario: 0,
          numero: p.id,
          pergunta: p.pergunta,
          snippet: p.pergunta,
          options: opts,
          correct: correctIdx,
          isBiblia: true,
          perguntaDifficulty: p.dificuldade || 'facil'
        };
      });
      setIsLoading(false);
      return q;
    }
    
    // Modo normal (hino)
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
    setFeedback(null);
    setLastPoints(null);
    hasRungBellRef.current = false;
    const currentDifficulty = bibliaGameMode ? difficulty : hinoDifficulty;
    setTimeLeft(currentDifficulty === 'sem_tempo' ? null : TIME_LIMITS[currentDifficulty]);
    startTimeRef.current = Date.now();

    // Reset players for the round
    setPlayers(prev => prev.map(p => ({ ...p, hasAnswered: false })));

    // Biblia Mode: Show difficulty announcement before starting
    if (bibliaGameMode && questions[roundIndex]) {
      setShowDifficultyAnnouncement(true);
      // Wait for animation before officially starting the "timer"
      setTimeout(() => {
        setShowDifficultyAnnouncement(false);
        startTimeRef.current = Date.now();
      }, 1500);
    } else {
      startTimeRef.current = Date.now();
    }

    // Clear any pending bot timeouts
    botTimeoutsRef.current.forEach(clearTimeout);
    botTimeoutsRef.current = [];
  };

  const handleAnswer = React.useCallback((option: string | null) => {
    // OTIMIZAÇÃO: usa refs para evitar stale closure em lag + feedback imediato
    if (!isGameActiveRef.current || selectedOptionRef.current || feedbackRef.current) return;
    // Feedback visual instantâneo antes de qualquer async
    if (option && navigator.vibrate) navigator.vibrate(30);
    if (option) soundService.playClick();

    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    lastHitTimeRef.current = timeSpent;

    setSelectedOption(option || "Tempo Esgotado");

    const currentQuestion = questionsRef.current[currentRoundRef.current];
    const isUserCorrect = option ? option.trim().toLowerCase() === currentQuestion?.options[currentQuestion?.correct]?.trim().toLowerCase() : false;

    let pointsToAdd = 0;
    if (isUserCorrect) {
      const currentDifficulty = difficultyRef.current;
      const timeLimit = TIME_LIMITS[currentDifficulty];
      
      if (currentDifficulty === 'sem_tempo' || timeLimit === Infinity) {
        pointsToAdd = Math.max(100, Math.floor(1000 - (timeSpent * 20)));
      } else {
        // Dynamic points based on percentage of time remaining
        pointsToAdd = Math.max(100, Math.floor(((timeLimit - timeSpent) / timeLimit) * 1000));
      }
    }

    setFeedback({ correct: isUserCorrect, option: option || "Tempo Esgotado" });

    // Som de acerto/erro: no SOLO toca na hora; no MULTIPLAYER fica mudo aqui e
    // toca só quando o resultado é revelado (fase 'result') — senão quem está
    // perto ouve o acerto/erro e descobre a resposta antes de marcar.
    const isSoloGame = isSoloRef.current;
    if (isUserCorrect) {
      if (isSoloGame) soundService.playCorrect();
      setLastPoints(pointsToAdd);
    } else if (option) {
      if (isSoloGame) soundService.playWrong();
      setLastPoints(0);
    }

    const myId = localPlayerIdRef.current || localPlayerId;
    console.log("[Solo] handleAnswer myId:", myId, "option:", option, "isCorrect:", isUserCorrect, "question:", currentQuestion?.pergunta?.slice(0,30));
    setPlayers(current => {
      const updated = current.map(p => {
        if (p.id === myId) {
          return { ...p, hasAnswered: true, score: p.score + pointsToAdd };
        }
        return p;
      });
      console.log("[Solo] after user hasAnswered:", updated.map(p=>p.id.slice(0,4)+":"+p.hasAnswered));
      return updated;
    });

    if (isSoloRef.current) {
      botTimeoutsRef.current.forEach(clearTimeout);
      botTimeoutsRef.current = [];
      setPlayers(current => {
        const updated = current.map(p => {
          if (p.id.includes("bot") && !p.hasAnswered) {
            const currentDifficulty = difficultyRef.current;
            const isHard = currentDifficulty === 'dificil';
            const isCorrect = Math.random() > (isHard ? 0.2 : 0.4);
            let points = 0;
            if (isCorrect) {
              const timeSpent = (Date.now() - startTimeRef.current) / 1000;
              const timeLimit = TIME_LIMITS[currentDifficulty] || 20;
              if (currentDifficulty === 'sem_tempo' || timeLimit === Infinity) {
                points = Math.max(100, Math.floor(1000 - (timeSpent * 20)));
              } else {
                points = Math.max(100, Math.floor(((timeLimit - timeSpent) / timeLimit) * 1000));
              }
            }
            return { ...p, hasAnswered: true, score: p.score + points };
          }
          return p;
        });
        console.log("[Solo] after bots hasAnswered:", updated.map(p=>p.id.slice(0,4)+":"+p.hasAnswered));
        return updated;
      });
      // Fallback redundante — handleAnswer já foi tratado pelo useEffect principal
      // Se chegar aqui, o countdown já foi iniciado pelo useEffect em 1375
    }

    // Write immediately + fire-and-forget; fallback poll will pick up the row.
    if (!isSoloRef.current && localPlayerIdRef.current && roomIdRef.current) {
      const localId = localPlayerIdRef.current;
      const correct = isUserCorrect;
      const pts = pointsToAdd;
      const rnd = currentRoundRef.current;
      // 1) realtime service (preferred)
      multiplayerService.submitAnswer(roomIdRef.current, correct, pts, rnd);
      // 2) fallback direto ao banco caso o service falhe silenciosamente
      (async () => {
        try {
          const { data } = await supabase.from('players').select('score').eq('id', localId).single();
          const current = data?.score || 0;
          await supabase.from('players').update({ has_answered: true, score: current + pts, round: rnd }).eq('id', localId);
        } catch {}
      })();
    }
  }, []);

  const lastTickTimeRef = useRef<number>(0);
  const hasRungBellRef = useRef<boolean>(false);
  const roundCountRef = useRef<number>(roundCount);
  useEffect(() => { roundCountRef.current = roundCount; }, [roundCount]);

  // OTIMIZAÇÃO: Timer Tick - 250ms (era 100ms) = 4x menos renders + deps estáveis
  useEffect(() => {
    if (!isGameActive || showResult || isPreparing) return;
    hasRungBellRef.current = false;
    const interval = setInterval(() => {
      if (!isGameActiveRef.current || showResultRef.current) return;
      
      const currentDifficulty = difficultyRef.current;
      if (currentDifficulty === 'sem_tempo') return;
      
      const timeLimit = TIME_LIMITS[currentDifficulty];
      const startTime = startTimeRef.current;
      
      const timeSpent = (Date.now() - startTime) / 1000;
      const remaining = Math.max(0, timeLimit - timeSpent);

      // Só atualiza se mudou >=0.1s para evitar renders desnecessários
      setTimeLeft(prev => (prev === null || Math.abs(prev - remaining) >= 0.1 ? remaining : prev));

      if (remaining <= 3 && remaining > 0) {
        const now = Date.now();
        if (now - lastTickTimeRef.current > 800) { // era 200ms -> 800ms menos áudio
          soundService.playTick();
          lastTickTimeRef.current = now;
        }
      }

      if (remaining <= 0.15) {
        if (!hasRungBellRef.current) {
          hasRungBellRef.current = true;
          soundService.playBell();
        }
        if (!selectedOptionRef.current && !feedbackRef.current) {
          handleAnswer(null); 
        }
        if (isSoloRef.current) {
          handleRoundEnd();
        } else {
          showResultRef.current = true;
          setIsGameActive(false);
          setShowResult(true);
          const me = playersRef.current.find(p => p.id === localPlayerIdRef.current);
          if (me?.isHost && roomIdRef.current) {
             multiplayerService.endRound(roomIdRef.current);
          }
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isGameActive, showResult, isPreparing]);

  const handleRoundEnd = () => {
    if (!isGameActiveRef.current || lastHandledRoundRef.current === currentRoundRef.current) return;
    lastHandledRoundRef.current = currentRoundRef.current;

      if (isSoloRef.current) {
        setIsGameActive(false);
        setShowResult(true);
        setResultCountdown(3);
        const timer = setInterval(() => {
          setResultCountdown(prev => {
            if (prev !== null && prev <= 0) {
              clearInterval(timer);
              nextRoundLocal();
              return null;
            }
            return prev !== null ? prev - 1 : null;
          });
        }, 1000);
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

    if (!isSoloRef.current && roomIdRef.current) {
      multiplayerService.nextRound(roomIdRef.current, nextIdx);
    }

    if (nextIdx < roundCount) {
      startRound(nextIdx);
    } else {
      // Game ended! Show Cinematic Podium
      setFrozenPlayers([...playersRef.current]);
      showResultRef.current = false;
      setShowResult(false); // Clear the Correct/Wrong overlay
      setShowPodium(true);
      setPodiumStep(0);
      
      // Step-by-step podium revelation
      setTimeout(() => setPodiumStep(1), 1500); // Show 3rd
      setTimeout(() => { setPodiumStep(2); soundService.playTick(); }, 3500); // Show 2nd
      setTimeout(() => { setPodiumStep(3); triggerConfetti(); soundService.playBell(); }, 6000); // Show 1st
      
      // Finally go to ranking after big celebration
      setTimeout(() => {
        setShowPodium(false);
        setView("ranking");
      }, 10000);
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
          view === "game" && isGameActive && difficulty !== 'sem_tempo' && timeLeft !== null
            ? (timeLeft <= 3 && timeLeft > 0 ? "bg-[#F43F5E]/40" : timeLeft <= 5 && timeLeft > 0 ? "bg-[#FF9F43]/40" : "bg-transparent")
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
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] bg-red-500 text-white px-6 py-3 rounded-2xl border-4 border-white shadow-lg"
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
              className="bg-[#18181B] border border-white/10 rounded-3xl p-8 flex flex-col items-center gap-4 shadow-xl max-w-sm w-full"
            >
              <div className="w-20 h-20 bg-[#1C1014] text-red-500 rounded-3xl mx-auto flex items-center justify-center">
                <X className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black uppercase text-white">Sala Encerrada</h3>
              <p className="text-zinc-400 font-medium text-center">O host saiu da sala.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconexão - DESEJA SE RECONECTAR NOVAMENTE? */}
      <AnimatePresence>
        {showReconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="bg-white rounded-[20px] min-[360px]:rounded-3xl p-5 min-[360px]:p-6 w-[92vw] max-w-[360px] shadow-2xl border-2 border-slate-200 flex flex-col gap-4 text-center"
            >
              <div className="w-14 h-14 min-[360px]:w-16 min-[360px]:h-16 bg-[#1E3A5F] rounded-2xl flex items-center justify-center mx-auto shadow-md">
                <RefreshCw className="w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 text-white" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-[15px] min-[360px]:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">Deseja se reconectar novamente?</h3>
                <p className="text-[12px] min-[360px]:text-[13px] font-semibold text-slate-500 leading-snug">Você saiu da sala <span className="font-black text-[#1E3A5F]">#{showReconnect.roomId}</span> enquanto ela ainda está ativa.</p>
                <p className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2">Seus pontos e progresso ainda estão salvos</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 min-[360px]:gap-3 pt-1">
                <button
                  onClick={() => { soundService.playClick(); clearReconnect(); setShowReconnect(null); }}
                  className="py-3 min-[360px]:py-3.5 rounded-xl min-[360px]:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[11px] min-[360px]:text-xs tracking-widest border border-slate-200 active:scale-[0.98] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    soundService.playClick();
                    const data = showReconnect;
                    setShowReconnect(null);
                    if (!data) return;
                    try {
                      // Tenta rooms (hino/biblia/desenho estão em rooms com game_type)
                      const { data: room } = await supabase.from('rooms').select('*').eq('id', data.roomId).maybeSingle();
                      if (room) {
                        const gtype = (room as any).game_type || data.gameType;
                        const phase = (room as any).phase;
                        if (gtype === 'desenho') {
                          drawingService.setSession(data.roomId, data.playerId);
                          setDrawingRoomId(data.roomId);
                          setDrawingLocalPlayerId(data.playerId);
                          setDrawingGameMode(true);
                          setIsDrawingHost(data.isHost);
                          // Restaura pra fase correta (lobby ou drawing) - DrawingGame carrega lines/hints via drawing_states
                          setView(phase === 'lobby' ? 'drawing_lobby' : 'drawing_game');
                          return;
                        }
                        await multiplayerService.initChannel(data.roomId, data.playerId);
                        setRoomId(data.roomId);
                        setLocalPlayerId(data.playerId);
                        setIsSolo(false);
                        setBibliaGameMode(gtype === 'biblia');
                        // Restaura rodada/pontos/phase exata - não força lobby
                        if (phase === 'lobby') setView('lobby');
                        else if (phase === 'ranking') setView('ranking');
                        else setView('game');
                        return;
                      }
                      // Tenta biblia_rooms (legado)
                      const { data: bRoom } = await supabase.from('biblia_rooms').select('*').eq('id', data.roomId).maybeSingle();
                      if (bRoom) {
                        await bibliaService.initChannel(data.roomId, data.playerId);
                        setBibliaRoomId(data.roomId);
                        setBibliaLocalPlayerId(data.playerId);
                        setBibliaGameMode(true);
                        setView('biblia_lobby');
                        return;
                      }
                      alert('Sala não encontrada ou já encerrada.');
                      clearReconnect();
                    } catch (e) { console.error(e); alert('Erro ao reconectar'); clearReconnect(); }
                  }}
                  className="py-3 min-[360px]:py-3.5 rounded-xl min-[360px]:rounded-2xl bg-[#1E3A5F] hover:bg-[#23395B] text-white font-black uppercase text-[11px] min-[360px]:text-xs tracking-widest shadow-md active:scale-[0.98] transition-all border border-[#1E3A5F]"
                >
                  Reconectar
                </button>
              </div>
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
              className="bg-[#18181B] border border-white/10 p-8 rounded-3xl max-w-sm w-full game-shadow text-center space-y-6"
            >
              <div className="w-20 h-20 bg-[#1C1A10] text-yellow-600 rounded-3xl mx-auto flex items-center justify-center">
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
                  className="flex-1 p-4 bg-[#121215] text-game-border font-black rounded-xl hover:bg-[#1C1C21] transition-colors uppercase tracking-widest text-sm"
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
              className="bg-[#18181B] border border-white/10 p-8 rounded-3xl max-w-sm w-full game-shadow text-center space-y-6"
            >
              <div className="w-20 h-20 bg-[#1C1014] text-game-danger rounded-3xl mx-auto flex items-center justify-center">
                <X className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-game-border uppercase tracking-tight">{
                  (!isSolo && (
                    (roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost) ||
                    (bibliaRoomId && bibliaIsHost) ||
                    (drawingRoomId && isDrawingHost)
                  )) ? "Encerrar Sala?" : "Sair do Jogo?"
                }</h3>
                <p className="text-game-border/60 font-medium">{
                  isSolo ? "Seu progresso nesta partida será perdido." :
                  (roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost) ||
                  (bibliaRoomId && bibliaIsHost) ||
                  (drawingRoomId && isDrawingHost)
                    ? "Você é o HOST. Se sair, TODOS os jogadores serão expulsos e a sala será fechada permanentemente."
                    : "Você sairá da sala e a partida continuará para os demais."
                } Tem certeza?</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    soundService.playClick();
                    setShowExitConfirm(false);
                  }}
                  className="flex-1 p-4 bg-[#121215] text-game-border font-black rounded-xl hover:bg-[#1C1C21] transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={async () => {
                    soundService.playClick();
                    setShowExitConfirm(false);
                    clearReconnect();
                    // Host em qualquer modo: expulsa todos e fecha sala
                    const isHostGeneric = !isSolo && roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost;
                    const isHostBiblia = bibliaRoomId && bibliaIsHost;
                    const isHostDrawing = drawingRoomId && isDrawingHost;
    
                    if (isHostGeneric) {
                      multiplayerService.deleteRoomWithKeepalive(roomId!);
                      setPlayers([]); setRoomId(null); setLocalPlayerId(null);
                      setView("home"); setIsGameActive(false); return;
                    }
                    if (isHostBiblia && bibliaRoomId) {
                      await bibliaService.deleteRoomWithKeepalive(bibliaRoomId);
                      setBibliaPlayers([]); setBibliaRoomId(null); setBibliaLocalPlayerId(null);
                      setView("home"); setIsGameActive(false); return;
                    }
                    if (isHostDrawing && drawingRoomId) {
                      await drawingService.deleteRoomWithKeepalive(drawingRoomId);
                      setDrawingPlayers([]); setDrawingRoomId(null); setDrawingLocalPlayerId(null);
                      setView("home"); setIsGameActive(false); return;
                    }
                    // Guest saindo
                    if (roomId && !isSolo) multiplayerService.leaveRoom();
                    if (bibliaRoomId) bibliaService.leaveRoom(bibliaRoomId, bibliaLocalPlayerId || undefined, false);
                    if (drawingRoomId) drawingService.leaveRoom(drawingRoomId, drawingLocalPlayerId || undefined, false);
                    setView("home");
                    setIsGameActive(false);
                  }}
                  className="flex-1 p-4 bg-game-danger text-white font-black rounded-xl hover:bg-red-600 transition-colors shadow-lg"
                >
                  {(!isSolo && ((roomId && playersRef.current.find(p => p.id === localPlayerId)?.isHost) || (bibliaRoomId && bibliaIsHost) || (drawingRoomId && isDrawingHost))) ? "Encerrar Sala" : "Sair"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "flex-1 min-h-0 w-full max-w-6xl mx-auto px-2 md:px-4 py-1 md:py-4 flex flex-col items-center relative z-10 overflow-y-auto no-scrollbar",
        (view === "game" || view === "home") ? "justify-start md:justify-center" : "justify-center"
      )}>

        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="w-full flex-grow min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 px-2 md:px-6 py-2 md:py-4 max-w-6xl mx-auto"
            >
              {/* HERO — tipografia massiva à esquerda (desktop) / topo (mobile) */}
              <div className="md:col-span-7 flex flex-col justify-center gap-3 md:gap-5 min-h-0">
                <motion.div
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <span className="w-10 h-1.5 bg-[#A3E635] rounded-full" />
                  <span className="eyebrow text-[#A3E635]">DESENVOLVIDO POR GUILHERME ALVES</span>
                </motion.div>

                <div className="flex flex-col">
                  <motion.h1
                    className="display-xl text-white select-none"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 140 }}
                  >
                    CCB
                  </motion.h1>
                  <motion.h1
                    className="display-xl -mt-2 md:-mt-4 text-transparent bg-clip-text bg-gradient-to-r from-[#A3E635] to-[#22D3EE]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, type: 'spring', stiffness: 140 }}
                  >
                    QUIZ
                  </motion.h1>
                </div>

                <motion.p
                  className="text-sm md:text-base text-zinc-400 font-medium max-w-md leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  Ouça, responda e vença. Hinos da CCB e conhecimento bíblico em partidas rápidas solo ou em grupo.
                </motion.p>

                {/* Ações principais — empilhadas, full-bleed no mobile */}
                <motion.div
                  className="flex flex-col gap-2.5 mt-1 md:mt-2"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                >
                  <button
                    onClick={handlePlayClick}
                    className="btn-cartoon btn-purple w-full py-5 md:py-6 gap-3 text-lg md:text-xl shadow-[0_16px_40px_-12px_rgba(163,230,53,0.45)]"
                  >
                    <Play className="w-6 h-6 fill-current" />
                    <span>JOGAR</span>
                    <span className="ml-auto opacity-50 text-xs tracking-[0.2em]">SOLO</span>
                  </button>

                  <button
                    onClick={() => { soundService.playClick(); setIsSolo(false); setView("multiplayer_menu"); }}
                    className="btn-cartoon btn-yellow w-full py-5 md:py-6 gap-3 text-lg md:text-xl"
                  >
                    <Users className="w-6 h-6" />
                    <span>GRUPO</span>
                    <span className="ml-auto opacity-40 text-xs tracking-[0.2em]">ONLINE</span>
                  </button>
                </motion.div>

                {/* Jogadores Online - tempo real via Supabase Presence */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-3 w-full"
                >
                  <button
                    onClick={() => { soundService.playClick(); setShowOnlineList(v => !v); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 shadow-sm transition-all active:scale-[0.98]"
                  >
                    <span className="flex items-center gap-3">
                      <span className="relative w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                        <Signal className="w-5 h-5 text-white" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
                      </span>
                      <span className="text-left">
                        <span className="block text-xs font-black uppercase tracking-widest text-slate-800">Jogadores Online</span>
                        <span className="block text-[11px] font-semibold text-slate-500">{(onlinePlayers.length || 1)} {(onlinePlayers.length || 1)===1 ? "conectado" : "conectados"} agora • ao vivo {onlinePlayers.length===0 ? "(você)" : ""}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${"bg-emerald-500 animate-pulse"}`} />
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showOnlineList ? "rotate-90" : ""}`} />
                    </span>
                  </button>

                  {showOnlineList && (
                      <div className="mt-2 bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Quem está online</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">{onlinePlayers.length || 1}</span>
                          </div>
                          <div className="max-h-[45vh] overflow-y-auto custom-scrollbar">
                            {(() => {
                              const list = onlinePlayers.length > 0 ? onlinePlayers : [{
                                id: "self",
                                nickname: profile.nickname || "Jogador",
                                avatar: profile.avatarUrl || "irmaos/1.png",
                                status: " No lobby",
                                statusDetail: "No menu inicial",
                                view,
                                gameType,
                                onlineAt: Date.now(),
                              } as any];
                              return (
                              <div className="p-2 flex flex-col gap-1.5 bg-white">
                                {list.map((op) => {
                                  const isMe = op.id === "self" || (myPresenceId !== null && op.id === myPresenceId);
                                  const isPlaying = op.status.includes("Jogando");
                                  const isLobby = op.status.includes("lobby") || op.status.includes("Online");
                                  return (
                                    <button key={op.id} onClick={() => { soundService.playClick(); setSelectedOnlinePlayer(op as any); }} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${isMe ? "bg-violet-50 border-violet-300 ring-1 ring-violet-200" : "bg-white border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-sm"}`}>
                                      <div className="relative shrink-0">
                                        <Avatar url={op.avatar || "irmaos/1.png"} size={40} className="rounded-xl" />
                                        <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isPlaying ? "bg-emerald-500" : isLobby ? "bg-blue-500" : "bg-amber-500"}`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                                          {op.nickname}
                                          {isMe && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-600 text-white shadow-sm border border-violet-700 tracking-wide">{"<você>"}</span>}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-500 truncate flex items-center gap-1">
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border ${isPlaying ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isLobby ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{op.status.replace(" ","").trim() || "Online"}</span>
                                          <span className="truncate text-slate-500 hidden sm:inline">• {op.statusDetail}</span>
                                        </p>
                                      </div>
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                              );
                            })()}
                          </div>
                          <div className="px-3 py-2 bg-amber-50/60 border-t border-amber-100 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <p className="text-[11px] font-semibold text-amber-800">Toque no card para ver perfil • Atualiza em tempo real</p>
                          </div>
                        </div>
                    )}
                  </motion.div>

                {/* Modal do jogador online */}
                <AnimatePresence>
                  {selectedOnlinePlayer && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"
                      onClick={() => setSelectedOnlinePlayer(null)}
                    >
                      <motion.div
                        initial={{ scale: 0.96, y: 16, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.96, y: 16, opacity: 0 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 flex flex-col items-center gap-4"
                      >
                        <div className="relative">
                          <Avatar url={selectedOnlinePlayer.avatar || "irmaos/1.png"} size={120} className="rounded-3xl ring-4 ring-violet-100" />
                          <span className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border-2 border-white shadow-md ${selectedOnlinePlayer.status.includes("Jogando") ? "bg-emerald-500 text-white" : selectedOnlinePlayer.status.includes("lobby") || selectedOnlinePlayer.status.includes("Online") ? "bg-blue-500 text-white" : "bg-amber-500 text-white"}`}>
                            {selectedOnlinePlayer.status.trim() || "Online"}
                          </span>
                        </div>
                        <div className="text-center">
                          <h3 className="text-xl font-black text-slate-900 flex items-center justify-center gap-2">
                            {selectedOnlinePlayer.nickname}
                            {(selectedOnlinePlayer.id === "self" || (myPresenceId !== null && selectedOnlinePlayer.id === myPresenceId)) && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-600 text-white">{"<você>"}</span>}
                          </h3>
                        </div>
                        <button onClick={() => setSelectedOnlinePlayer(null)} className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-xs tracking-widest transition-colors">Fechar</button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Row secundária de ícones + versão */}
                <div className="flex items-center justify-between mt-1 md:mt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { soundService.playClick(); setView("hymn_list"); }}
                      className="btn-icon"
                      title="Hinos"
                    >
                      <Music className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { soundService.playClick(); setShowHelp(true); }}
                      className="btn-icon"
                      title="Ajuda"
                    >
                      <Info className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { soundService.playClick(); setShowSettings(true); }}
                      className="btn-icon"
                      title="Configurações"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-right opacity-35">
                    <p className="eyebrow text-zinc-400 leading-none">v2.1.5</p>
                    <p className="eyebrow text-zinc-500 leading-none mt-0.5">beta</p>
                  </div>
                </div>
              </div>

              {/* PAINEL LATERAL — perfil como card flutuante + instrumentos */}
              <div className="md:col-span-5 flex flex-col gap-3 md:gap-4 min-h-0 justify-center">
                {/* Player card — assimétrico, deslocado */}
                <motion.div
                  className="relative premium-card p-4 md:p-6 md:ml-4 md:mt-8"
                  initial={{ opacity: 0, x: 24, rotate: 1.5 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 160 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Avatar url={profile?.avatarUrl || "irmaos/1.png"} size={88} className="ring-2 ring-[#A3E635]/40 rounded-2xl" />
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-[#A3E635] rounded-lg flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
                        title="Editar perfil"
                      >
                        <Edit2 className="w-3.5 h-3.5 stroke-[3px]" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="eyebrow text-zinc-500 mb-1">Jogador</p>
                      <input
                        type="text"
                        maxLength={15}
                        value={profile?.nickname}
                        onChange={(e) => {
                          const newNick = e.target.value;
                          setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "irmaos/1.png" });
                          localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                        }}
                        className="bg-transparent text-xl md:text-2xl font-bold text-white tracking-tight leading-tight focus:outline-none border-b border-transparent focus:border-[#A3E635]/50 transition-colors w-full"
                      />
                      <p className="text-xs text-zinc-500 mt-1.5 font-medium">Pronto para a próxima rodada</p>
                    </div>
                  </div>
                </motion.div>

                {/* Faixa de instrumentos — grid bold */}
                <motion.div
                  className="hidden md:grid grid-cols-4 gap-2 md:ml-0"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {[
                    { Icon: ViolinSVG, label: 'Violino' },
                    { Icon: SaxophoneSVG, label: 'Sax' },
                    { Icon: TubaSVG, label: 'Tuba' },
                    { Icon: ClarinetSVG, label: 'Clarinete' },
                  ].map(({ Icon, label }) => (
                    <div
                      key={label}
                      className="bg-[#121215] border border-white/[0.07] rounded-xl py-3 flex flex-col items-center gap-1.5 text-zinc-500 hover:text-[#A3E635] hover:border-[#A3E635]/30 transition-colors"
                    >
                      <Icon size={28} />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.15em]">{label}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Stats rápidas fake — bold gaming flourish */}
                <motion.div
                  className="grid grid-cols-3 gap-2"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                >
                  {[
                    { k: 'Hinos', v: hymns.length > 0 ? String(hymns.length) : '—' },
                    { k: 'Modos', v: '3' },
                    { k: 'Ranking', v: 'Top' },
                  ].map(({ k, v }) => (
                    <div key={k} className="bg-[#121215] border border-white/[0.07] rounded-xl px-3 py-2.5 text-center">
                      <p className="text-lg md:text-xl font-bold text-white font-display tracking-tight leading-none">{v}</p>
                      <p className="eyebrow text-zinc-500 mt-1 text-[0.55rem]">{k}</p>
                    </div>
                  ))}
                </motion.div>
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
              <div className="cartoon-panel p-6 md:p-8 flex flex-col gap-5 max-h-[80vh]">
                <div className="flex items-center justify-between shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      soundService.playClick();
                      setView("home");
                    }}
                    className="w-14 h-14 bg-[#121215] border border-white/10 rounded-2xl flex items-center justify-center game-shadow cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-8 h-8 text-white" />
                  </motion.button>
                  <h2 className="text-3xl font-black text-white italic uppercase cartoon-text text-right drop-shadow-md">Hinos no Supabase</h2>
                </div>

                {/* SEARCH BAR */}
                <div className="relative shrink-0">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <Search className="w-5 h-5 text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="Pesquisar por hino ou número..."
                    value={hymnSearchQuery}
                    onChange={(e) => setHymnSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-[#121215] border border-white/10 rounded-2xl font-black text-white focus:outline-none focus:bg-white transition-all shadow-lg placeholder:text-zinc-600"
                  />
                  {hymnSearchQuery && (
                    <button 
                      onClick={() => setHymnSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#1C1C21] p-1 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
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

                      const filteredHymns = uniqueHymns.filter(h => 
                        h.title.toLowerCase().includes(hymnSearchQuery.toLowerCase()) ||
                        h.id.toString().includes(hymnSearchQuery)
                      );

                      if (filteredHymns.length === 0 && hymnSearchQuery) {
                        return (
                          <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4 text-zinc-600">
                            <Search className="w-16 h-16" />
                            <p className="font-black text-xl italic">Nenhum hino encontrado para sua busca.</p>
                          </div>
                        );
                      }

                      return filteredHymns.map((h) => (
                        <div key={h.id} className="p-4 bg-gray-50 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-[#A3E635]/20 transition-colors shadow-lg">
                          <div className="flex flex-col">
                            <span className="text-white font-black text-xl italic">
                              {h.title.replace(/^\d+[\s.-]*/, '')}
                            </span>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-[#8B5CF6] border border-white/10 flex items-center justify-center text-white text-xl font-black shadow-md shrink-0">
                            {h.id}
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center gap-4 text-zinc-500">
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
              <div className="flex items-center justify-between px-1 shrink-0">
                <button onClick={() => setView("home")} className="btn-icon">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="eyebrow text-[#A3E635]">Multiplayer</p>
                  <h2 className="display-md text-white">Conjunto</h2>
                </div>
                <div className="w-11 h-11" />
              </div>

              {/* Ações — dois painéis lado a lado, altura igual, estilo console */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <motion.button
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { soundService.playClick(); setIsSolo(false); setView("mode_selection"); }}
                  className="mode-card p-4 md:p-5 flex flex-col items-start gap-3 md:gap-4 cursor-pointer text-left min-h-[140px] md:min-h-[170px] justify-between"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-[#A3E635]/15 border border-[#A3E635]/35 flex items-center justify-center text-[#A3E635]">
                    <Plus className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="eyebrow text-zinc-500 text-[0.55rem]">01 · Host</p>
                    <p className="text-base md:text-xl font-bold text-white tracking-tight mt-0.5">Criar Sala</p>
                    <p className="text-[11px] md:text-xs text-zinc-500 mt-0.5">Configure e convide</p>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    soundService.playClick();
                    setIsManualJoin(true);
                    setRoomId(null);
                    setJoinRoomCode("");
                    setView("multiplayer_join");
                  }}
                  className="mode-card p-4 md:p-5 flex flex-col items-start gap-3 md:gap-4 cursor-pointer text-left min-h-[140px] md:min-h-[170px] justify-between"
                >
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-[#22D3EE]/12 border border-[#22D3EE]/35 flex items-center justify-center text-[#22D3EE]">
                    <Key className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="eyebrow text-zinc-500 text-[0.55rem]">02 · Guest</p>
                    <p className="text-base md:text-xl font-bold text-white tracking-tight mt-0.5">Usar Código</p>
                    <p className="text-[11px] md:text-xs text-zinc-500 mt-0.5">Entre com o código</p>
                  </div>
                </motion.button>
              </div>

              {/* Salas próximas — lista dark em vez de painel branco */}
              <div className="cartoon-panel p-4 flex flex-col overflow-hidden shrink-0" style={{ maxHeight: '40vh' }}>
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                    <div>
                      <p className="eyebrow text-zinc-500 text-[0.55rem]">Rede local</p>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">Salas Amigas</h3>
                    </div>
                  </div>

                  <button
                    onClick={refreshNearbyRooms}
                    className="btn-icon !w-9 !h-9"
                    title="Atualizar"
                  >
                    <RefreshCw className={cn("w-4 h-4", isRefreshingRooms && "animate-spin")} />
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto no-scrollbar space-y-2">
                  {nearbyRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-40 gap-3 py-8">
                      <MonitorSpeaker className="w-12 h-12 animate-wiggle text-zinc-600" />
                      <p className="eyebrow text-zinc-500 text-center">Buscando na rede...</p>
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
                        className="w-full p-3 bg-[#121215] border border-white/[0.08] rounded-xl flex flex-col gap-1.5 text-left hover:border-[#A3E635]/40 hover:bg-[#16161A] transition-all group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-3 min-w-0">
                            <Avatar url={game.hostAvatar || "irmaos/1.png"} size={44} className="rounded-xl shrink-0" />
                            <span className="font-bold text-[15px] text-white truncate">{game.hostName || "Host"}</span>
                          </span>
                          <span className="font-display font-bold text-xs text-[#8B5CF6] shrink-0">#{game.id}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                            game.difficulty === 'sem_tempo' ? "bg-[#22C55E]/15 text-[#34D399]" :
                            game.difficulty === 'medio' ? "bg-[#F59E0B]/15 text-[#FBBF24]" :
                            "bg-[#8B5CF6]/15 text-[#A78BFA]"
                          )}>
                            {game.difficulty === 'sem_tempo' ? 'SEM TEMPO' : game.difficulty === 'medio' ? 'MÉDIO' : 'RÁPIDO'}
                          </span>
                          <span className="text-[9px] font-semibold text-zinc-500">{game.roundCount} rodadas</span>
                          <span className="text-[9px] font-semibold text-zinc-400">{game.gameType === 'biblia' ? 'Bíblia' : 'Hino'}</span>
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
              className="w-full max-w-md premium-card p-5 flex flex-col gap-3 mx-auto"
            >
              {/* Header - volta pro que acabou de acessar */}
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => {
                  soundService.playClick();
                  // Veio por link/QR (join via URL, sem código digitado): limpa e volta pra home.
                  if (view === "multiplayer_join" && !isManualJoin && !localPlayerId) {
                    setRoomId(null);
                    try { window.history.replaceState({}, '', window.location.pathname); } catch {}
                    setView("home");
                  } else {
                    setView(view === "multiplayer_join" ? "multiplayer_menu" : "mode_selection");
                  }
                }} className="btn-icon shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <p className="eyebrow text-[#A3E635]">Configurar</p>
                  <h2 className="display-md text-white">
                    {view === "multiplayer_join" ? "Entrar na Sala" : (isSolo ? "Solo" : "Nova Sala")}
                  </h2>
                </div>
              </div>

              {/* Nickname removed, using Profile */}

              {/* Room code for join - only if manual */}
              {view === "multiplayer_join" && isManualJoin && (
                <div>
                  <label className="eyebrow text-zinc-500 mb-1.5 block">Código da Sala</label>
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

              {/* Convite via link/QR: mostra qual sala vai entrar */}
              {view === "multiplayer_join" && !isManualJoin && roomId && (
                <div className="bg-[#18181B] border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Código da Sala</span>
                  <span className="text-2xl font-black italic tracking-widest text-white">{roomId}</span>
                </div>
              )}

              {/* PROFILE SETUP SECTION */}
              <div className="bg-[#121215] rounded-xl p-4 border border-dashed border-[#8B5CF6]/35 flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar url={profile?.avatarUrl || "irmaos/1.png"} size={80} className="ring-2 ring-[#A3E635]/40 rounded-xl" />
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="absolute -bottom-1 -right-1 bg-[#A3E635] p-1.5 rounded-lg text-white shadow-md"
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
                    setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "irmaos/1.png" });
                    localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                  }}
                  className="input-cartoon text-center text-sm"
                />
              </div>

              {/* Setup options (only for creating games) */}
              {(view === "setup" || view === "multiplayer_setup") && (
                <div className="space-y-3">
                  {/* Rounds + Difficulty row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Rounds */}
                    <div>
                      <label className="eyebrow text-zinc-500 mb-1.5 block">Rodadas</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[5, 10, 15, 20].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setRoundCount(n); }}
                            className={cn(
                              "py-2 rounded-lg border font-display font-bold text-base transition-all",
                              roundCount === n
                                ? "bg-[#A3E635] text-white border-[#A3E635]"
                                : "bg-[#121215] text-zinc-400 border-white/10 hover:bg-[#1C1C21]"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="eyebrow text-zinc-500 mb-1.5 block">Nível</label>
                      <div className="flex flex-col gap-1.5">
{(bibliaGameMode ? [
                            { value: 'facil' as Difficulty, label: 'FÁCIL', desc: 'Perguntas fáceis', color: 'bg-[#22C55E]', textColor: 'text-white' },
                            { value: 'medio' as Difficulty, label: 'MÉDIO', desc: 'Perguntas médias', color: 'bg-[#F59E0B]', textColor: 'text-white' },
                            { value: 'dificil' as Difficulty, label: 'DIFÍCIL', desc: 'Perguntas difíceis', color: 'bg-[#8B5CF6]', textColor: 'text-white' },
                            { value: 'aleatorio' as Difficulty, label: 'MISTO', desc: 'Todas as dificuldades', color: 'bg-[#EC4899]', textColor: 'text-white' },
                          ] : [
                            { value: 'sem_tempo' as HinoDifficulty, label: 'SEM TEMPO', desc: 'Sem limite de tempo', color: 'bg-[#22C55E]', textColor: 'text-white' },
                            { value: 'medio' as HinoDifficulty, label: 'MÉDIO', desc: '20 segundos por pergunta', color: 'bg-[#F59E0B]', textColor: 'text-white' },
                            { value: 'rapido' as HinoDifficulty, label: 'RÁPIDO', desc: '10 segundos por pergunta', color: 'bg-[#8B5CF6]', textColor: 'text-white' },
                          ]).map(d => (
<button
                            key={d.value}
                            onClick={() => { soundService.playClick(); bibliaGameMode ? setDifficulty(d.value as Difficulty) : setHinoDifficulty(d.value as HinoDifficulty); }}
                            className={cn(
                              "py-1.5 px-2 flex flex-col items-center justify-center rounded-lg border border-white/10 transition-all",
                              bibliaGameMode
                                ? (difficulty === d.value ? `${d.color} ${d.textColor} shadow-md scale-[1.02]` : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]")
                                : (hinoDifficulty === d.value ? `${d.color} ${d.textColor} shadow-md scale-[1.02]` : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]")
                            )}
                          >
                            <span className="font-black text-sm uppercase tracking-wider leading-none">{d.label}</span>
                            <span className={cn("text-[9px] font-bold uppercase mt-0.5", bibliaGameMode ? (difficulty === d.value ? "opacity-90" : "opacity-60") : (hinoDifficulty === d.value ? "opacity-90" : "opacity-60"))}>{d.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bot count (solo only) */}
                  {isSolo && (
                    <div>
                      <label className="eyebrow text-zinc-500 mb-1.5 block">Rivais Simulados</label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[0, 1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setBotCount(n); }}
                            className={cn(
                              "py-2 rounded-lg border font-display font-bold text-base transition-all",
                              botCount === n
                                ? "bg-[#8B5CF6] text-white border-[#8B5CF6]"
                                : "bg-[#121215] text-zinc-400 border-white/10 hover:bg-[#1C1C21]"
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
              className="w-full flex-1 min-h-0 max-w-4xl flex flex-col gap-3 px-2 pb-20 md:pb-4"
            >
              <div className="flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    soundService.playClick();
                    setView(isSolo ? "home" : "multiplayer_menu");
                  }}
                  className="btn-icon"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="eyebrow text-[#A3E635]">Escolha</p>
                  <h2 className="display-md text-white">Modo de Jogo</h2>
                </div>
                <div className="w-11 h-11 shrink-0" />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4 space-y-3">
                {/* Modos ativos — cards numerados com índice brutal */}
                {[
                  {
                    n: '01',
                    title: 'Qual é o Hino?',
                    desc: 'Ouça o trecho e adivinhe o número e título do hino.',
                    icon: Music,
                    accent: '#A3E635',
                    soloOk: true,
                    onClick: () => {
                      soundService.playClick();
                      setRoomId(null);
                      setBibliaGameMode(false);
                      setView("multiplayer_setup");
                    },
                  },
                  {
                    n: '02',
                    title: 'Quiz da Bíblia',
                    desc: 'Teste seus conhecimentos da Palavra de Deus!',
                    icon: BookOpen,
                    accent: '#22D3EE',
                    soloOk: true,
                    onClick: () => {
                      soundService.playClick();
                      setRoomId(null);
                      setBibliaGameMode(true);
                      setView("multiplayer_setup");
                    },
                  },
                  {
                    n: '03',
                    title: 'Desenhe a Palavra',
                    desc: 'Um jogador desenha e os outros tentam adivinhar!',
                    icon: Pencil,
                    accent: '#8B5CF6',
                    soloOk: false,
                    onClick: () => {
                      if (isSolo) return;
                      soundService.playClick();
                      setRoomId(null);
                      setBibliaGameMode(false);
                      setDrawingGameMode(true);
                      setView("drawing_setup");
                    },
                  },
                  {
                    n: '04',
                    title: 'Quem Sou Eu?',
                    desc: 'Faça mímica no mesmo aparelho e adivinhe a palavra!',
                    icon: Sparkles,
                    accent: '#F97316',
                    soloOk: true,
                    onClick: () => {
                      soundService.playClick();
                      setView("quemsou_game");
                    },
                  },
                ].map((mode) => {
                  const disabled = !mode.soloOk && isSolo;
                  const Icon = mode.icon;
                  return (
                    <motion.button
                      key={mode.n}
                      whileHover={disabled ? {} : { x: 6 }}
                      whileTap={disabled ? {} : { scale: 0.99 }}
                      disabled={disabled}
                      onClick={mode.onClick}
                      className={cn(
                        "mode-card w-full p-4 md:p-5 flex items-center gap-4 md:gap-5 text-left group",
                        disabled && "opacity-40 grayscale cursor-not-allowed"
                      )}
                    >
                      {/* Índice numérico gigante */}
                      <span
                        className="font-display font-bold text-4xl md:text-5xl leading-none tracking-tighter shrink-0 w-14 md:w-16"
                        style={{ color: mode.accent, opacity: disabled ? 0.4 : 0.9 }}
                      >
                        {mode.n}
                      </span>

                      <div
                        className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${mode.accent}18`, border: `1px solid ${mode.accent}40` }}
                      >
                        <Icon className="w-6 h-6 md:w-7 md:h-7" style={{ color: mode.accent }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg md:text-2xl font-bold text-white tracking-tight leading-tight">{mode.title}</h3>
                        <p className="text-xs md:text-sm text-zinc-400 mt-0.5 leading-snug">{mode.desc}</p>
                        {disabled && (
                          <p className="eyebrow text-zinc-500 mt-1.5 text-[0.55rem]">Apenas multiplayer</p>
                        )}
                      </div>

                      <span
                        className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg border transition-all shrink-0 group-hover:scale-110"
                        style={{ borderColor: `${mode.accent}50`, color: mode.accent }}
                      >
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                      </span>
                    </motion.button>
                  );
                })}

                {/* Em breve — grid compacto */}
                <div className="pt-3 border-t border-white/[0.07]">
                  <p className="eyebrow text-zinc-500 mb-2.5">Em breve</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { title: "Complete a Letra", icon: Check },
                      { title: "Qual a Voz?", icon: Users },
                      { title: "Soprando a Doutrina", icon: MonitorSpeaker },
                      { title: "Ritmo Certo", icon: Play },
                      { title: "Batalha Musical", icon: Trophy },
                    ].map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <div
                          key={mode.title}
                          className="bg-[#121215] border border-white/[0.06] rounded-xl px-3.5 py-3 flex items-center gap-3 opacity-45 grayscale"
                        >
                          <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-400 truncate">{mode.title}</span>
                          <span className="ml-auto eyebrow text-zinc-600 text-[0.5rem] shrink-0">Lock</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Drawing Setup */}
          {(view === "drawing_setup") && (
            <motion.div
              key="drawing_setup"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="w-full max-w-lg flex flex-col gap-3 mx-auto"
            >
              {/* Header with back to mode_selection */}
              <div className="flex items-center justify-between px-1 shrink-0">
                <button onClick={() => {
                  soundService.playClick();
                  // Veio por link/QR (join): limpa e volta pra home. Senão, fluxo normal.
                  if (drawingRoomId && !drawingLocalPlayerId) {
                    setDrawingRoomId(null);
                    setDrawingGameMode(false);
                    try { window.history.replaceState({}, '', window.location.pathname); } catch {}
                    setView("home");
                  } else {
                    setDrawingGameMode(false);
                    setView("mode_selection");
                  }
                }} className="btn-icon">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="eyebrow text-[#A3E635]">Multiplayer</p>
                  <h2 className="display-md text-white">{drawingRoomId && !drawingLocalPlayerId ? "Entrar na Sala" : "Desenho Musical"}</h2>
                </div>
                <div className="w-11 h-11" />
              </div>

              {/* Profile & Config */}
              <div className="cartoon-panel p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar url={profile?.avatarUrl || "irmaos/1.png"} size={70} />
                  <input 
                    type="text" 
                    maxLength={15}
                    placeholder="Seu Nome"
                    value={profile?.nickname}
                    onChange={(e) => {
                      const newNick = e.target.value;
                      setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "irmaos/1.png" });
                      localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                    }}
                    className="bg-[#18181B] border-2 border-white/15 px-3 py-1.5 rounded-xl font-black text-center text-sm flex-1 focus:outline-none focus:border-[#8B5CF6] shadow-sm"
                  />
                  <button onClick={() => setIsEditingProfile(true)} className="bg-[#A3E635] p-2 rounded-lg border-2 border-[#09090B] shadow-md">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Modo join via link/QR: esconde config do host, mostra sala + ENTRAR */}
                {drawingRoomId && !drawingLocalPlayerId ? (
                  <>
                    <div className="bg-[#18181B] border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Código da Sala</span>
                      <span className="text-2xl font-black italic tracking-widest text-white">{drawingRoomId}</span>
                    </div>
                    <motion.button
                      whileHover={!profile?.nickname?.trim() || isLoading ? {} : { scale: 1.03 }}
                      whileTap={!profile?.nickname?.trim() || isLoading ? {} : { scale: 0.97 }}
                      disabled={!profile?.nickname?.trim() || isLoading}
                      onClick={async () => {
                        const nick = profile?.nickname?.trim();
                        if (!nick) { alert("Escreva seu nome primeiro!"); return; }
                        soundService.playClick();
                        setIsLoading(true);
                        try { window.history.replaceState({}, '', window.location.pathname); } catch {}
                        const player = await drawingService.joinRoom(drawingRoomId, nick, profile.avatarUrl);
                        if (player) {
                          setDrawingLocalPlayerId(player.playerId);
                          setIsDrawingHost(false);
                          saveReconnect(drawingRoomId, player.playerId, false, 'desenho');
                          setDrawingPlayers([{ id: player.playerId, nickname: nick, avatar: profile.avatarUrl, isHost: false, isReady: false, totalScore: 0 }]);
                          setView("drawing_lobby");
                        } else {
                          alert("Sala de desenho não encontrada ou erro ao entrar.");
                        }
                        setIsLoading(false);
                      }}
                      className="btn-cartoon btn-green w-full py-3 text-lg tracking-widest gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      ENTRAR
                    </motion.button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block text-zinc-400">Pontuação para Vencer</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[500, 800, 1000].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setDrawingScoreGoal(n); }}
                            className={cn(
                              "py-2 rounded-lg border border-white/10 font-black text-base transition-all",
                              drawingScoreGoal === n
                                ? "bg-[#8B5CF6] text-white shadow-md scale-105"
                                : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block text-zinc-400">Categoria</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['Todos', ...drawingCategories].map(cat => (
                          <button
                            key={cat}
                            onClick={() => { soundService.playClick(); setDrawingCategory(cat); }}
                            className={cn(
                              "py-2 rounded-lg border border-white/10 font-black text-xs transition-all",
                              drawingCategory === cat
                                ? "bg-[#8B5CF6] text-white shadow-md scale-105"
                                : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <motion.button
                      whileHover={!profile || isLoading ? {} : { scale: 1.03 }}
                      whileTap={!profile || isLoading ? {} : { scale: 0.97 }}
                      disabled={!profile || isLoading}
                      onClick={async () => {
                        soundService.playClick();
                        setIsLoading(true);
                        const result = await drawingService.createRoom(profile.nickname, profile.avatarUrl, drawingScoreGoal, drawingCategory);
                        if (result) {
                          setDrawingRoomId(result.roomId);
                          setDrawingLocalPlayerId(result.playerId);
                          setIsDrawingHost(true);
                          saveReconnect(result.roomId, result.playerId, true, 'desenho');
                          setDrawingPlayers([{ id: result.playerId, nickname: profile.nickname, avatar: profile.avatarUrl, isHost: true, isReady: false, totalScore: 0 }]);
                          setView("drawing_lobby");
                        } else {
                          alert("Erro ao criar sala. Verifique sua conexão.");
                        }
                        setIsLoading(false);
                      }}
                      className="btn-cartoon btn-green w-full py-3 text-lg tracking-widest gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                      CRIAR SALA
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Drawing Lobby */}
          {(view === "drawing_lobby") && (
            <motion.div
              key="drawing_lobby"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex-1 min-h-0 max-w-5xl flex flex-col gap-2 pb-20 md:pb-3"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-2 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => { soundService.playClick(); setShowExitConfirm(true); }} className="w-11 h-11 bg-[#18181B] border border-white/10 rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <div className="bg-[#18181B] border border-white/10 px-4 py-1.5 rounded-xl game-shadow">
                    <span className="text-base font-black italic uppercase tracking-tighter cartoon-text text-white">SALA: <span className="text-[#8B5CF6]">{drawingRoomId}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDrawingHost && (
                    <div className="bg-[#121215] border border-white/10 px-3 py-1 rounded-lg">
                      <span className="text-xs font-black uppercase text-white">HOST</span>
                    </div>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { soundService.playClick(); setShowQrModal(true); }}
                    className="btn-cartoon btn-yellow px-3 py-1.5 text-xs gap-2 whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Convidar
                  </motion.button>
                </div>
              </div>

              {/* Invite Modal for Drawing */}
              {showQrModal && drawingRoomId && (
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
                    className="bg-[#18181B] border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-sm w-full"
                  >
                    <h3 className="text-xl font-black uppercase italic text-[#8B5CF6]">Convidar Amigos</h3>
                    
                    {showQrCode ? (
                      <div className="w-full flex flex-col items-center gap-3">
                        <div className="bg-[#18181B] border border-white/10 rounded-2xl p-2 shadow-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?drawing=' + drawingRoomId)}`}
                            alt="QR Code da sala"
                            className="w-36 h-36 rounded-xl"
                          />
                        </div>
                        <button
                          onClick={() => setShowQrCode(false)}
                          className="text-xs text-[#8B5CF6] font-black uppercase hover:underline"
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

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        soundService.playClick();
                        const link = `${window.location.origin + window.location.pathname}?drawing=${drawingRoomId}`;
                        navigator.clipboard.writeText(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="w-full btn-cartoon btn-green p-4 flex items-center justify-center gap-3"
                    >
                      <Globe className="w-6 h-6" />
                      <span className="font-black uppercase">{copied ? "Link Copiado!" : "Copiar Link"}</span>
                    </motion.button>

                    <div className="w-full bg-[#A3E635] border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 shadow-lg">
                      <span className="text-xs font-black uppercase text-zinc-400">Código da Sala</span>
                      <div className="text-3xl font-black italic tracking-widest text-white">{drawingRoomId}</div>
                    </div>

                    <button
                      onClick={() => setShowQrModal(false)}
                      className="w-full py-2 bg-[#121215] border border-white/10 rounded-xl font-black uppercase text-sm hover:bg-[#1C1C21] transition-colors cursor-pointer shadow-md"
                    >
                      Fechar
                    </button>
                  </motion.div>
                </motion.div>
              )}

              <div className="flex-1 min-h-0 cartoon-panel p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <div className="w-9 h-9 bg-[#8B5CF6] border border-white/10 rounded-lg flex items-center justify-center text-white game-shadow">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter cartoon-text text-white">Jogadores ({drawingPlayers.length})</h3>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {drawingPlayers.map((p) => (
                        <div key={p.id} className={cn(
                          "relative p-2.5 border border-white/10 rounded-xl flex flex-col items-center gap-1.5 transition-all",
                          p.isReady ? "bg-[#d1fae5] shadow-md" : "bg-[#121215] opacity-80"
                        )}>
                          {p.isHost && <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#A3E635] border-2 border-[#09090B] rounded-full flex items-center justify-center text-[8px] font-black z-10">👑</div>}
                          {p.avatar ? (
                            <div className="mb-2 pointer-events-none">
                              <Avatar url={p.avatar} size={100} className="rounded-2xl" />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-20 h-20 rounded-2xl border border-white/10 flex items-center justify-center text-3xl font-black",
                              p.isReady ? "bg-[#34D399] text-white" : "bg-[#121215] text-white"
                            )}>
                              {p.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="font-black text-xs truncate w-full text-center text-white">{p.nickname}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-2.5 shrink-0">
                  <div className="bg-[#121215] border border-white/10 rounded-xl p-3 space-y-2">
                    <h4 className="font-black uppercase text-[9px] tracking-widest text-center border-b-2 border-gray-300 pb-1.5 text-white">Configurações</h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-white">
                        <span>TEMA:</span>
                        <span className="bg-[#8B5CF6] text-white border-2 border-[#09090B] px-2 py-0.5 rounded-md text-[9px] shadow-sm">{drawingCategory}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-white">
                        <span>META:</span>
                        <span className="bg-[#A3E635] text-white border-2 border-[#09090B] px-2 py-0.5 rounded-md text-[9px] shadow-sm">{drawingScoreGoal} pts</span>
                      </div>
                    </div>
                  </div>

                  {isDrawingHost ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        const allReady = drawingPlayers.every(p => p.isReady);
                        if (!allReady) {
                          await drawingService.toggleReady(drawingRoomId!, true);
                          setDrawingPlayers(prev => prev.map(p => p.id === drawingLocalPlayerId ? { ...p, isReady: true } : p));
                          return;
                        }
                        soundService.playClick();
                        await drawingService.startDrawingGame(drawingRoomId!, drawingScoreGoal);
                        
                        // Show countdown 3, 2, 1
                        [3, 2, 1].forEach((n, i) => {
                          setTimeout(() => setDrawingCountdown(n), i * 800);
                        });
                        setTimeout(async () => {
                          setDrawingCountdown(null);
                          const room = await drawingService.getRoom(drawingRoomId!);
                          if (room) {
                            setDrawingCurrentPrompt(room.currentPrompt || '');
                            if (room.roundCount) setDrawingScoreGoal(room.roundCount);
                            if (room.deadline_at) {
                              setDrawingTimeLeft(Math.max(0, Math.ceil((room.deadline_at - Date.now()) / 1000)));
                            }
                          }
                          setView('drawing_game');
                        }, 2500);
                      }}
                      className="btn-cartoon btn-green w-full py-3 text-lg tracking-widest"
                    >
                      {drawingPlayers.every(p => p.isReady) ? "COMEÇAR!" : "PRONTO!"}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        const me = drawingPlayers.find(p => p.id === drawingLocalPlayerId);
                        await drawingService.toggleReady(drawingRoomId!, !me?.isReady);
                        setDrawingPlayers(prev => prev.map(p => p.id === drawingLocalPlayerId ? { ...p, isReady: !p.isReady } : p));
                      }}
                      className={cn(
                        "btn-cartoon w-full py-3 text-lg tracking-widest",
                        drawingPlayers.find(p => p.id === drawingLocalPlayerId)?.isReady ? "btn-green" : "btn-purple"
                      )}
                    >
                      {drawingPlayers.find(p => p.id === drawingLocalPlayerId)?.isReady ? "PRONTO!" : "ESTOU PRONTO"}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Drawing Countdown */}
          {drawingCountdown && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-[#09090B]"
            >
              <motion.div
                key={drawingCountdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", damping: 10 }}
                className="text-[10rem] md:text-[15rem] font-black italic text-[#A3E635] drop-shadow-2xl shadow-violet-500/40"
              >
                {drawingCountdown}
              </motion.div>
            </motion.div>
          )}

          {/* Drawing Game */}
          {view === "drawing_game" && drawingRoomId && drawingLocalPlayerId && (
            <motion.div
              key="drawing_game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col absolute inset-0 z-50 bg-[#09090B]"
            >
               {/* Exit Button during Drawing Game */}
               <button 
                 onClick={async () => {
                   if (confirm("Deseja mesmo sair da sala de desenho?")) {
                     soundService.playClick();
                     await drawingService.leaveRoom(drawingRoomId, drawingLocalPlayerId || undefined, isDrawingHost);
                     setDrawingGameMode(false);
                     setDrawingRoomId(null);
                     setView("mode_selection");
                   }
                 }}
                 className="absolute top-4 right-4 z-[100] w-10 h-10 bg-red-500/20 hover:bg-[#1C1014]0 border-2 border-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md"
                 title="Sair da Sala"
               >
                 <X className="w-6 h-6" />
               </button>

               <React.Suspense fallback={<div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white min-h-[50dvh]"><Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" /><p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando desenho...</p></div>}>
                <DrawingGame 
                   roomId={drawingRoomId} 
                   localPlayerId={drawingLocalPlayerId}
                   players={drawingPlayers}
                   isHost={isDrawingHost}
                   category={drawingCategory}
                   scoreGoal={drawingScoreGoal}
                   onEndGame={() => setView('home')}
                />
                </React.Suspense>
            </motion.div>
           )}

          {/* Quem Sou Eu? (mímica local, pass-and-play) */}
          {view === "quemsou_game" && (
            <motion.div
              key="quemsou_game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex-1 min-h-0 max-w-4xl flex flex-col gap-3 px-2 pb-20 md:pb-4"
            >
              <React.Suspense fallback={<div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white min-h-[50dvh]"><Loader2 className="w-8 h-8 animate-spin text-[#1E3A5F]" /><p className="text-xs font-black uppercase tracking-widest text-slate-400">Carregando jogo...</p></div>}>
                <QuemSouEuGame onExit={() => setView("mode_selection")} />
              </React.Suspense>
            </motion.div>
           )}

          {/* biblIA Setup */}
          {(view === "biblia_setup") && (
            <motion.div
              key="biblia_setup"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="w-full max-w-lg flex flex-col gap-3 mx-auto"
            >
              <div className="flex items-center justify-between px-1 shrink-0">
                <button onClick={() => {
                  soundService.playClick();
                  // Veio por link/QR (join): limpa e volta pra home.
                  if (bibliaRoomId && !bibliaLocalPlayerId) {
                    setBibliaRoomId(null);
                    setBibliaGameMode(false);
                    try { window.history.replaceState({}, '', window.location.pathname); } catch {}
                  }
                  setView("home");
                }} className="btn-icon">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="eyebrow text-[#A3E635]">Multiplayer</p>
                  <h2 className="display-md text-white">{bibliaRoomId && !bibliaLocalPlayerId ? "Entrar na Sala" : "Conjunto"}</h2>
                </div>
                <div className="w-11 h-11" />
              </div>

              <div className="cartoon-panel p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar url={profile?.avatarUrl || "irmaos/1.png"} size={70} />
                  <input 
                    type="text" 
                    maxLength={15}
                    placeholder="Seu Nome"
                    value={profile?.nickname}
                    onChange={(e) => {
                      const newNick = e.target.value;
                      setProfile(prev => prev ? { ...prev, nickname: newNick } : { nickname: newNick, avatarUrl: "irmaos/1.png" });
                      localStorage.setItem("ccb_quiz_profile", JSON.stringify({ ...profile, nickname: newNick }));
                    }}
                    className="bg-[#18181B] border-2 border-white/15 px-3 py-1.5 rounded-xl font-black text-center text-sm flex-1 focus:outline-none focus:border-[#F43F5E] shadow-sm"
                  />
                  <button onClick={() => setIsEditingProfile(true)} className="bg-[#A3E635] p-2 rounded-lg border-2 border-[#09090B] shadow-md">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Modo join via link/QR (?biblia=): esconde config do host, mostra ENTRAR */}
                {bibliaRoomId && !bibliaLocalPlayerId ? (
                  <>
                    <div className="bg-[#18181B] border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Código da Sala</span>
                      <span className="text-2xl font-black italic tracking-widest text-white">{bibliaRoomId}</span>
                    </div>
                    <button
                      onClick={async () => {
                        const nick = profile?.nickname?.trim();
                        if (!nick) { alert("Escreve o teu nome primeiro!"); return; }
                        soundService.playClick();
                        setIsLoading(true);
                        try { window.history.replaceState({}, '', window.location.pathname); } catch {}
                        const player = await bibliaService.joinRoom(bibliaRoomId, nick, profile.avatarUrl);
                        setIsLoading(false);
                        if (player) {
                          setBibliaLocalPlayerId(player.id);
                          setBibliaIsHost(false);
                          saveReconnect(bibliaRoomId, player.id, false, 'biblia');
                          setBibliaGameMode(true);
                          setBibliaPlayers([{ ...player } as any]);
                          setView("biblia_lobby");
                        } else {
                          alert("Sala não encontrada ou erro ao entrar. Verifique o código.");
                        }
                      }}
                      disabled={isLoading || !profile?.nickname?.trim()}
                      className="w-full py-3 bg-[#22C55E] border border-white/10 rounded-xl font-black text-xl uppercase tracking-wider shadow-md disabled:opacity-50"
                    >
                      {isLoading ? "Entrando..." : "ENTRAR"}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block text-zinc-400">Rodadas</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[5, 10, 15, 20].map(n => (
                          <button
                            key={n}
                            onClick={() => { soundService.playClick(); setBibliaRoundCount(n); }}
                            className={cn(
                              "py-2 rounded-lg border border-white/10 font-black text-base transition-all",
                              bibliaRoundCount === n
                                ? "bg-[#8B5CF6] text-white shadow-md scale-105"
                                : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-1.5 block text-zinc-400">Dificuldade</label>
                      <div className="grid grid-cols-4 gap-1.5">
    {bibliaGameMode ? ([
                              { value: 'facil' as Difficulty, label: 'FÁCIL', desc: 'Perguntas fáceis', color: 'bg-[#22C55E]', textColor: 'text-white' },
                              { value: 'medio' as Difficulty, label: 'MÉDIO', desc: 'Perguntas médias', color: 'bg-[#F59E0B]', textColor: 'text-white' },
                              { value: 'dificil' as Difficulty, label: 'DIFÍCIL', desc: 'Perguntas difíceis', color: 'bg-[#8B5CF6]', textColor: 'text-white' },
                              { value: 'aleatorio' as Difficulty, label: 'MISTO', desc: 'Todas as dificuldades', color: 'bg-[#EC4899]', textColor: 'text-white' },
                            ]) : ([
                          { value: 'sem_tempo' as HinoDifficulty, label: 'Sem Tempo', color: 'bg-[#22C55E]', textColor: 'text-white' },
                          { value: 'medio' as HinoDifficulty, label: 'Médio', color: 'bg-[#F59E0B]', textColor: 'text-white' },
                          { value: 'rapido' as HinoDifficulty, label: 'Rápido', color: 'bg-[#8B5CF6]', textColor: 'text-white' }
                        ] as const).map(d => (
                          <button
                            key={d.value}
                            onClick={() => { soundService.playClick(); bibliaGameMode ? setDifficulty(d.value as Difficulty) : setHinoDifficulty(d.value as HinoDifficulty); }}
                            className={cn(
                              "py-2 rounded-lg border border-white/10 font-black text-xs transition-all capitalize",
                              bibliaGameMode ? (difficulty === d.value
                                ? `${d.color} ${d.textColor} shadow-md scale-105`
                                : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]") : (hinoDifficulty === d.value
                                ? `${d.color} ${d.textColor} shadow-md scale-105`
                                : "bg-[#121215] text-zinc-500 hover:bg-[#1C1C21]")
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        const nick = profile?.nickname?.trim();
                        if (!nick) {
                          alert("Escreve o teu nome primeiro!");
                          return;
                        }
                        soundService.playClick();
                        setIsLoading(true);
                        console.log('[BIBLIA] Creating room for:', nick);
                        const result = await bibliaService.createRoom(nick, profile.avatarUrl, difficulty, bibliaRoundCount);
                        console.log('[BIBLIA] Room created:', result);
                        setIsLoading(false);
                        if (result) {
                          setBibliaRoomId(result.room.id);
                          setBibliaLocalPlayerId(result.player.id);
                          setBibliaIsHost(true);
                          saveReconnect(result.room.id, result.player.id, true, 'biblia');
                          setBibliaGameMode(true);
                          setBibliaPlayers([result.player]);
                          setView("biblia_lobby");
                        } else {
                          alert('Erro ao criar sala. Ver console (F12)');
                        }
                      }}
                      disabled={isLoading}
                      className="w-full py-3 bg-[#F43F5E] border border-white/10 rounded-xl font-black text-xl uppercase tracking-wider shadow-md disabled:opacity-50"
                    >
                      {isLoading ? "A criar..." : "CRIAR SALA"}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

{/* biblIA Lobby */}
          {(view === "biblia_lobby") && bibliaRoomId && (
            <motion.div
              key="biblia_lobby"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex-1 min-h-0 max-w-5xl flex flex-col gap-2 mx-auto"
            >
              <div className="flex items-center justify-between px-2 shrink-0">
                <button onClick={() => { soundService.playClick(); setShowExitConfirm(true); }} className="w-11 h-11 bg-[#18181B] border border-white/10 rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="bg-[#18181B] border border-white/10 px-4 py-1.5 rounded-xl game-shadow">
                  <span className="text-base font-black italic uppercase tracking-tighter cartoon-text text-white">SALA: <span className="text-[#8B5CF6]">{bibliaRoomId}</span></span>
                </div>
                <button onClick={() => { soundService.playClick(); navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?biblia=' + bibliaRoomId); alert('Link copiado!'); }} className="w-11 h-11 bg-[#18181B] border border-white/10 rounded-xl flex items-center justify-center game-shadow cursor-pointer hover:scale-105 transition-transform shrink-0">
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="flex-1 min-h-0 cartoon-panel p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* Players section */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <Users className="w-5 h-5 text-white" />
                    <span className="text-lg font-black italic uppercase tracking-tighter cartoon-text text-white">Jogadores</span>
                    <span className="bg-[#18181B] border-2 border-[#09090B] px-2 py-0.5 rounded-md text-xs font-black">{bibliaPlayers.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {bibliaPlayers.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "flex items-center gap-3 p-3 bg-[#18181B] rounded-xl border border-white/10 shadow-md",
                          p.isReady ? "bg-green-50" : "bg-gray-50"
                        )}
                      >
                        <Avatar url={p.avatar || "irmaos/1.png"} size={50} />
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-white truncate">{p.nickname}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {p.isHost && <span className="bg-[#A3E635] text-white px-1.5 py-0.5 rounded text-[9px] font-black">HOST</span>}
                            {p.isReady && <span className="bg-[#34D399] text-white px-1.5 py-0.5 rounded text-[9px] font-black">PRONTO</span>}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Info section */}
                <div className="w-full md:w-64 flex flex-col gap-3">
                  <div className="bg-[#18181B] border border-white/10 rounded-xl p-4 flex flex-col gap-2 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400">Dificuldade</span>
                      <span className={cn("text-xs font-black uppercase px-2 py-0.5 rounded", difficulty === 'sem_tempo' ? "bg-[#22C55E] text-white" : difficulty === 'medio' ? "bg-[#F59E0B] text-white" : difficulty === 'dificil' ? "bg-[#8B5CF6] text-white" : "bg-[#EC4899] text-white")}>{difficulty === 'aleatorio' ? 'Misto' : difficulty}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-zinc-400">Rodadas</span>
                      <span className="text-xs font-black uppercase bg-[#8B5CF6] text-white px-2 py-0.5 rounded">{bibliaRoundCount}</span>
                    </div>
                  </div>

                  {!bibliaIsHost && (
                    <button
                      onClick={async () => {
                        const me = bibliaPlayers.find(p => p.id === bibliaLocalPlayerId);
                        await bibliaService.toggleReady(bibliaRoomId!, !me?.isReady);
                        setBibliaPlayers(prev => prev.map(p => p.id === bibliaLocalPlayerId ? { ...p, isReady: !me?.isReady } : p));
                      }}
                      className={cn(
                        "w-full py-4 border border-white/10 rounded-xl font-black text-xl uppercase tracking-wider shadow-md",
                        bibliaPlayers.find(p => p.id === bibliaLocalPlayerId)?.isReady ? "bg-[#34D399] text-white" : "bg-[#121215] text-white"
                      )}
                    >
                      {bibliaPlayers.find(p => p.id === bibliaLocalPlayerId)?.isReady ? "PRONTO!" : "ESTOU PRONTO"}
                    </button>
)}
 
{bibliaIsHost && bibliaRoomId && bibliaPlayers.length > 0 && (
                     <>
                       <button
                         onClick={async () => {
                           alert('CLICOU EM COMEÇAR!');
                           console.log('[BIBLIA] Starting game...');
                            console.log('[BIBLIA] Starting game...');
                            const { data: allPerguntas } = await supabase.from('biblia_perguntas').select('*');
                            console.log('[BIBLIA] Perguntas:', allPerguntas?.length);
                            if (!allPerguntas || allPerguntas.length === 0) {
                              alert('Nenhuma pergunta da Biblia!');
                              return;
                            }
                            const shuffled = allPerguntas.sort(() => Math.random() - 0.5);
                            const selected = shuffled.slice(0, bibliaRoundCount);
                            const bibliaQuestions = selected.map((p: any) => ({
                              pergunta: p.pergunta,
                              options: [p.correta, p.opcao1, p.opcao2, p.opcao3].sort(() => Math.random() - 0.5),
                              correct: 0
                            }));
                            console.log('[BIBLIA] calling startGame:', bibliaQuestions);
                            await bibliaService.startGame(bibliaRoomId!, bibliaQuestions, bibliaRoundCount, difficulty);
                            setView('biblia_game');
                          }}
                         disabled={bibliaPlayers.length < 1}
                         className="w-full py-4 border border-white/10 rounded-xl font-black text-xl uppercase tracking-wider shadow-md bg-[#8B5CF6] text-white"
                       >
                        COMEÇAR!
                      </button>
                    </>
                  )}
</div>
              </div>
            </motion.div>
          )}

          {/* biblIA Game */}
          {view === "biblia_game" && (
            <motion.div
              key="biblia_game"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full flex-1 min-h-0 flex flex-col gap-2 pb-20 md:pb-3"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-[#18181B] border-b-4 border-[#09090B] shrink-0">
                <span className="text-sm font-black text-white">Rodada {bibliaRound}/{bibliaRoundCount}</span>
                <div className={cn(
                  "w-14 h-14 flex items-center justify-center rounded-xl font-black text-2xl border border-white/10 shadow-md",
                  bibliaTimeLeft <= 5 ? "bg-[#F43F5E] text-white animate-pulse" :
                  bibliaTimeLeft <= 10 ? "bg-[#A3E635] text-white" :
                  "bg-[#121215] text-white"
                )}>
                  {bibliaTimeLeft}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-lg bg-[#18181B] border border-white/10 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-xl md:text-2xl font-black text-center text-white mb-6">{bibliaCurrentPergunta}</h3>
                  
                  <div className="flex flex-col gap-3">
                    {bibliaOpcoes.map((opcao, idx) => (
                      <button
                        key={idx}
                        onClick={async () => {
                          soundService.playClick();
                          // Handle answer
                        }}
                        className="w-full py-4 bg-[#F43F5E] border border-white/10 rounded-xl font-black text-lg text-white shadow-md hover:bg-[#ff6b7a] transition-colors"
                      >
                        {opcao}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* biblIA Ranking */}
          {view === "biblia_ranking" && bibliaFinalRanking.length > 0 && (
            <motion.div
              key="biblia_ranking"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-lg mx-auto flex flex-col gap-4 pb-20 md:pb-3 relative"
            >
              <button 
                onClick={() => { setView("mode_selection"); setBibliaGameMode(false); }}
                className="absolute top-0 -right-4 z-10 w-10 h-10 bg-red-500 border border-white/10 rounded-xl flex items-center justify-center shadow-md hover:scale-110 transition-transform"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="text-center">
                <h2 className="text-3xl md:text-4xl font-black italic uppercase cartoon-text text-[#A3E635] drop-shadow-md">FIM DE JOGO!</h2>
                <p className="text-white font-bold">Ranking Final</p>
              </div>

              <div className="bg-[#18181B] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 shadow-lg">
                {bibliaFinalRanking.sort((a, b) => b.score - a.score).map((p, idx) => (
                  <div key={p.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border border-white/10 relative overflow-hidden",
                    p.id === localPlayerId ? "border-[#22C55E] ring-4 ring-[#22C55E]/30 z-10" : "",
                    idx === 0 ? "bg-[#A3E635]" : idx === 1 ? "bg-gray-300" : idx === 2 ? "bg-amber-600" : "bg-[#121215]"
                  )}>
                    <span className="w-8 h-8 flex items-center justify-center bg-[#09090B] text-white rounded-lg font-black">{idx + 1}</span>
                    <Avatar url={p.avatar || "irmaos/1.png"} size={40} />
                    <span className="flex-1 font-black text-white">{p.nickname}</span>
                    <span className="text-xl font-black text-white">{p.score}</span>
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
              className="w-full flex-1 min-h-0 max-w-5xl flex flex-col gap-2 pb-20 md:pb-3"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-1 shrink-0">
                <div className="flex items-center gap-3">
                  {isSolo ? (
                    <button onClick={() => setView("mode_selection")} className="btn-icon">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
) : (
                    <button onClick={() => { soundService.playClick(); setShowExitConfirm(true); }} className="btn-icon !text-[#F43F5E] hover:!border-[#F43F5E]/50">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  <div className="premium-card px-4 py-2">
                    <p className="eyebrow text-zinc-500 text-[0.55rem] leading-none">Sala</p>
                    <p className="font-display font-bold text-xl text-white tracking-tight leading-none mt-1">
                      {roomId || <span className="text-[#A3E635]">SOLO</span>}
                    </p>
                  </div>
                </div>

                {!isSolo && roomId && (
                  <button
                    onClick={() => { soundService.playClick(); setShowQrModal(true); }}
                    className="btn-cartoon btn-yellow px-4 py-2.5 text-xs gap-2 whitespace-nowrap"
                  >
                    <Users className="w-4 h-4" />
                    Convidar
                  </button>
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
                      className="bg-[#18181B] border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 shadow-xl max-w-sm w-full"
                    >
                      <h3 className="text-xl font-black uppercase italic text-white cartoon-text">Convidar Amigos</h3>
                      
                      {showQrCode ? (
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="bg-[#18181B] border border-white/10 rounded-2xl p-2 shadow-lg">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?room=' + roomId)}`}
                              alt="QR Code da sala"
                              className="w-36 h-36 rounded-xl"
                            />
                          </div>
                          <button
                            onClick={() => setShowQrCode(false)}
                            className="text-xs text-[#8B5CF6] font-black uppercase hover:underline"
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
                      <div className="w-full bg-[#A3E635] border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 shadow-lg">
                        <span className="text-xs font-black uppercase text-zinc-400">Código da Sala</span>
                        <div className="text-3xl font-black italic tracking-widest text-white">{roomId}</div>
                      </div>

                      <button
                        onClick={() => setShowQrModal(false)}
                        className="w-full py-2 bg-[#121215] border border-white/10 rounded-xl font-black uppercase text-sm hover:bg-[#1C1C21] transition-colors cursor-pointer shadow-md"
                      >
                        Fechar
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </div>

              <div className="flex-1 min-h-0 cartoon-panel p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* Players section — grid de tiles escuros */}
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="eyebrow text-zinc-500 text-[0.55rem] leading-none">Lobby</p>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide leading-none mt-1">Jogadores ({players.length})</h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {players.map((p) => (
                        <div key={p.id} className={cn(
                          "relative p-3 border rounded-xl flex flex-col items-center gap-2 transition-all",
                          p.isReady
                            ? "bg-[#34D399]/10 border-[#34D399]/40"
                            : "bg-[#121215] border-white/[0.08] opacity-85"
                        )}>
                          {p.isHost && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#A3E635] rounded-full flex items-center justify-center text-[8px] z-10 shadow-md">👑</div>
                          )}
                          {p.avatar ? (
                            <div className="pointer-events-none">
                              <Avatar url={p.avatar} size={72} className="rounded-xl" />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-16 h-16 rounded-xl border flex items-center justify-center text-2xl font-bold font-display",
                              p.isReady ? "bg-[#34D399]/20 border-[#34D399]/50 text-[#34D399]" : "bg-white/[0.06] border-white/15 text-zinc-300"
                            )}>
                              {p.nickname.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <p className="font-bold text-xs truncate w-full text-center text-white">{p.nickname}</p>
                          <div className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                            p.isReady ? "bg-[#34D399] text-[#052E16]" : "bg-white/[0.07] text-zinc-500"
                          )}>
                            {p.isReady ? "Pronto" : "Espera"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sidebar config — stack bold */}
                <div className="w-full md:w-64 flex flex-col gap-2.5 shrink-0">
                  <div className="bg-[#121215] border border-white/[0.08] rounded-xl p-3.5 space-y-2.5">
                    <p className="eyebrow text-zinc-500 text-center pb-2 border-b border-white/[0.08]">Partida</p>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-400">
                      <span className="uppercase tracking-wider">Rodadas</span>
                      <span className="font-display font-bold text-sm text-white bg-white/[0.07] px-2.5 py-0.5 rounded-md border border-white/10">{roundCount}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-400">
                      <span className="uppercase tracking-wider">Nível</span>
                      <span className="font-display font-bold text-xs uppercase text-white bg-[#A3E635] px-2.5 py-0.5 rounded-md">
                        {effectiveDifficulty === 'sem_tempo' ? 'Sem Tempo' :
                         effectiveDifficulty === 'medio' ? 'Médio' :
                         effectiveDifficulty === 'rapido' ? 'Rápido' :
                         effectiveDifficulty === 'facil' ? 'Fácil' :
                         effectiveDifficulty === 'dificil' ? 'Difícil' :
                         effectiveDifficulty === 'aleatorio' ? 'Misto' : effectiveDifficulty}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const me = players.find(p => p.id === localPlayerId);
                    if (isSolo || me?.isHost) {
                      return (
                        <button
                          onClick={() => handleStartGameClick(false)}
                          className="btn-cartoon btn-purple w-full py-4 text-base tracking-widest"
                        >
                          {isSolo ? "COMEÇAR!" : "COMEÇAR PARTIDA"}
                        </button>
                      );
                    } else {
                      return (
                        <button
                          onClick={toggleReady}
                          className={cn(
                            "btn-cartoon w-full py-4 text-base tracking-widest",
                            me?.isReady ? "btn-green" : "btn-purple"
                          )}
                        >
                          {me?.isReady ? "PRONTO!" : "ESTOU PRONTO"}
                        </button>
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
              className="w-full flex-1 min-h-0 max-w-6xl flex flex-col gap-1 md:gap-1.5 overflow-hidden relative pb-24 md:pb-2"
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
                      className="text-[150px] md:text-[300px] font-black text-white italic drop-shadow-2xl"
                    >
                      {gameCountdown === 0 ? "VAI!" : gameCountdown}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DIFFICULTY ANNOUNCEMENT OVERLAY */}
              <AnimatePresence>
                {showDifficultyAnnouncement && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
                  >
                    <motion.div
                      initial={{ scale: 0.5, y: 50, rotate: -10 }}
                      animate={{ scale: 1, y: 0, rotate: 0 }}
                      exit={{ scale: 1.5, opacity: 0, y: -50 }}
                      className="flex flex-col items-center gap-6"
                    >
                      <div className="premium-card px-8 py-10 md:px-12 md:py-14 flex flex-col items-center gap-4 relative">
                        <span className="eyebrow text-zinc-500">Dificuldade</span>
                        
                        {(() => {
                          const diff = questions[currentRound]?.perguntaDifficulty || 'facil';
                          const config = {
                            facil: { label: 'FÁCIL', color: '#34D399', icon: <Star className="w-10 h-10 fill-[#34D399]" /> },
                            medio: { label: 'MÉDIO', color: '#F59E0B', icon: <Zap className="w-10 h-10 fill-[#F59E0B]" /> },
                            dificil: { label: 'DIFÍCIL', color: '#F43F5E', icon: <Flame className="w-10 h-10 fill-[#F43F5E]" /> }
                          }[diff as keyof typeof config] || { label: diff.toUpperCase(), color: '#8B5CF6', icon: <BookOpen className="w-10 h-10" /> };

                          return (
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-bounce mb-2">{config.icon}</div>
                              <h2 
                                className="text-6xl md:text-8xl font-black uppercase tracking-tight"
                                style={{ color: config.color }}
                              >
                                {config.label}
                              </h2>
                            </div>
                          );
                        })()}
                        
                        <div className="absolute -top-5 -right-5 w-14 h-14 bg-[#8B5CF6] rounded-2xl flex items-center justify-center rotate-12 shadow-xl shadow-[#8B5CF6]/30">
                           <BookOpen className="w-7 h-7 text-white" />
                        </div>
                      </div>
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="text-zinc-300 font-bold uppercase tracking-[0.3em] text-base md:text-xl mt-8 font-display"
                      >
                         Prepare-se
                       </motion.div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* HUD bar — minimal, dark, tipografia display */}
              <div className="flex items-center justify-between px-1 md:px-2 gap-2 md:gap-3 h-12 md:h-14 shrink-0 pt-1">
                <button
                  onClick={() => { soundService.playClick(); setShowExitConfirm(true); }}
                  className="btn-icon !w-10 !h-10 !text-[#F43F5E] hover:!border-[#F43F5E]/50 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="px-3 md:px-4 py-1.5 flex items-center gap-2 bg-[#121215] border border-white/[0.08] rounded-lg shrink-0">
                  <span className="hidden md:block eyebrow text-zinc-500 text-[0.5rem]">Round</span>
                  <span className="font-display font-bold text-lg md:text-xl text-white tracking-tight">
                    {currentRound + 1}<span className="text-zinc-500 text-sm md:text-base">/{roundCount}</span>
                  </span>
                </div>

                <div className="flex-grow max-w-md h-7 md:h-8 bg-[#121215] border border-white/[0.1] rounded-full overflow-hidden relative">
                  <motion.div
                    initial={false}
                    animate={{ width: `${Math.max(0, (timeLeft || 0) / (TIME_LIMITS[effectiveDifficulty] || 1)) * 100}%` }}
                    className={cn(
                      "h-full transition-colors duration-300 rounded-full",
                      (timeLeft === null || timeLeft === Infinity) ? "bg-[#A3E635]" :
                        timeLeft <= 3 ? "bg-[#F43F5E]" :
                          timeLeft <= 5 ? "bg-[#F59E0B]" : "bg-[#A3E635]"
                    )}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] md:text-[11px] font-bold text-white tracking-widest uppercase font-display">
                      <span className="hidden md:inline">Tempo </span>{timeLeft === null || timeLeft === Infinity ? "∞" : `${timeLeft.toFixed(1)}s`}
                    </span>
                  </div>
                </div>

                <div className="px-3 md:px-4 py-1.5 flex items-center gap-2 bg-[#121215] border border-white/[0.08] rounded-lg shrink-0">
                  <Trophy className="w-4 h-4 text-[#A3E635]" />
                  <span className="font-display font-bold text-lg md:text-xl text-white tracking-tight">
                    {players.find(p => p.id === localPlayerId)?.score || 0}
                  </span>
                </div>
              </div>

              <div className="flex-grow cartoon-panel p-3 md:p-5 flex flex-col items-center gap-2 md:gap-3 relative overflow-y-auto no-scrollbar min-h-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#A3E635]/50 to-transparent" />

                      <div className="flex flex-col items-center text-center gap-2 max-w-2xl w-full">
                        {questions[currentRound]?.pergunta ? (
                          <>
                            <span className="eyebrow text-[#8B5CF6]">Quiz da Bíblia</span>
                            {questions[currentRound]?.perguntaDifficulty && questions[currentRound].perguntaDifficulty !== 'aleatorio' && (
                              <span className={cn(
                                "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider",
                                questions[currentRound].perguntaDifficulty === 'facil'
                                  ? "bg-[#34D399]/15 text-[#34D399]"
                                  : questions[currentRound].perguntaDifficulty === 'medio'
                                    ? "bg-[#F59E0B]/15 text-[#FBBF24]"
                                    : "bg-[#8B5CF6]/15 text-[#A78BFA]"
                              )}>
                                {questions[currentRound].perguntaDifficulty === 'facil' ? 'Fácil' : questions[currentRound].perguntaDifficulty === 'medio' ? 'Média' : 'Difícil'}
                              </span>
                            )}
                            <div className="premium-card px-4 py-4 w-full max-h-[20vh] overflow-y-auto no-scrollbar flex items-center justify-center">
                              <p className={cn(
                                "font-bold text-white text-center leading-snug font-display",
                                questions[currentRound].pergunta.length > 100 ? "text-base md:text-xl" : "text-lg md:text-2xl"
                              )}>
                                {questions[currentRound].pergunta}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="eyebrow text-[#A3E635]">Qual é o hino?</span>
                            <div className="premium-card px-4 py-5 w-full max-h-[25vh] md:max-h-[30vh] overflow-y-auto no-scrollbar flex items-center justify-center">
                              <p className={cn(
                                "font-bold text-white text-center leading-snug font-display italic",
                                questions[currentRound].snippet?.length > 100 ? "text-lg md:text-xl" : "text-xl md:text-3xl"
                              )}>
                                "{questions[currentRound].snippet}"
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3 shrink-0 py-2">
                    {questions[currentRound].options.map((option, idx) => {
                      // Extract hymn number and title for "Qual é o hino?" mode
                      const isHymnMode = !questions[currentRound]?.pergunta;
                      const hymnNumber = isHymnMode ? option.match(/^\d+/)?.[0] : null;
                      const hymnTitle = isHymnMode ? option.replace(/^\d+[\s.-]*/, '') : option;
                      const correctOpt = questions[currentRound].options[questions[currentRound].correct];
                      const letter = String.fromCharCode(65 + idx); // A B C D

                      const state = cn(
                        "answer-tile w-full min-h-[3.5rem] md:min-h-[4.25rem] px-3.5 md:px-4 py-3 md:py-4 flex items-center gap-3 text-left",
                        !selectedOption && "text-zinc-100",
                        selectedOption === option && !showResult && "is-selected text-white",
                        selectedOption && selectedOption !== option && !showResult && "is-dim",
                        showResult && option === correctOpt && "is-correct text-white scale-[1.02] z-10 animate-pop-in",
                        showResult && selectedOption === option && option !== correctOpt && "is-wrong text-white animate-shake",
                        showResult && option !== correctOpt && option !== selectedOption && "is-dim",
                        showResult && option !== correctOpt && selectedOption === option && "is-wrong"
                      );

                      return (
                        <button
                          key={idx}
                          disabled={!!feedback || !!selectedOption}
                          onClick={() => handleAnswer(option)}
                          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                          className={state}
                        >
                          {/* Tile A/B/C D ou número do hino */}
                          {isHymnMode && hymnNumber ? (
                            <div className="w-11 h-11 md:w-12 md:h-12 rounded-lg bg-[#09090B]/70 border border-white/15 flex items-center justify-center shrink-0 font-display font-bold text-base md:text-xl text-[#A3E635]">
                              {hymnNumber}
                            </div>
                          ) : (
                            <div className={cn(
                              "w-8 h-8 md:w-9 md:h-9 rounded-md flex items-center justify-center shrink-0 font-display font-bold text-sm border",
                              showResult && option === correctOpt
                                ? "bg-white/20 border-white/40 text-white"
                                : selectedOption === option && !showResult
                                  ? "bg-[#A3E635] border-[#A3E635] text-white"
                                  : "bg-white/[0.06] border-white/15 text-zinc-400"
                            )}>
                              {letter}
                            </div>
                          )}
                          <span className={cn(
                            "font-semibold leading-snug flex-1",
                            hymnTitle.length > 30 ? "text-sm md:text-lg" : "text-base md:text-lg"
                          )}>{hymnTitle}</span>
                          {showResult && option === correctOpt && (
                            <Check className="absolute right-3.5 w-5 h-5 md:w-6 md:h-6 text-[#34D399]" />
                          )}
                        </button>
                      );
                    })}
                </div>

                {!isSolo && !showResult && selectedOption && players.some(p => !p.hasAnswered) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                  >
                    <div className="premium-card px-8 py-5 flex flex-col items-center gap-3 backdrop-blur-sm">
                      <div className="w-10 h-10 border-[3px] border-white/20 border-t-[#A3E635] rounded-full animate-spin" />
                      <span className="text-white font-bold uppercase tracking-[0.2em] text-sm md:text-base font-display">Aguardando jogadores</span>
                    </div>
                  </motion.div>
                )}

                {showResult && (
                  <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={cn(
                      "absolute inset-0 flex flex-col items-center justify-center z-50 p-4 md:p-10 text-center glass-panel",
                      feedback?.correct ? "bg-[#34D399]/40" : "bg-[#F43F5E]/40"
                    )}
                  >
                    <div className="premium-card px-6 py-8 md:px-12 md:py-12 shadow-2xl flex flex-col items-center gap-4 md:gap-6 animate-pop-in max-w-[90%]">
                      <h3 className={cn("display-lg uppercase", feedback?.correct ? "text-[#34D399]" : "text-[#F43F5E]")}>
                        {feedback?.correct ? "Boa!" : "Quase!"}
                      </h3>
                      {lastPoints !== null && lastPoints > 0 && (
                        <AnimatedPoints points={lastPoints} />
                      )}
                      <div className="bg-[#A3E635] text-white px-5 py-2 rounded-full font-display font-bold text-xs md:text-sm uppercase tracking-[0.25em]">
                        Próximo em {resultCountdown !== null ? resultCountdown : 3}s
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Mini Placar fixo no rodapé para desktop, escondido no mobile */}
              <div className="hidden md:flex w-full h-14 shrink-0 bg-[#121215] border border-white/[0.08] rounded-xl p-2 items-center justify-center gap-3 overflow-x-auto no-scrollbar mt-2">
                {players.sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 shrink-0 bg-[#18181B] px-3.5 py-2 rounded-lg border border-white/[0.07]">
                    <div className={cn("w-2.5 h-2.5 rounded-full", p.hasAnswered ? "bg-[#34D399]" : "bg-zinc-600")} />
                    <span className="text-xs font-semibold text-zinc-300">{i + 1}. {p.nickname}</span>
                    <span className="font-display font-bold text-xs text-white bg-[#A3E635] px-2.5 py-0.5 rounded-md">{p.score}</span>
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
              className="w-full flex-1 min-h-0 max-w-4xl flex flex-col items-center gap-[1.5vh] overflow-hidden px-4 py-2 pb-6 md:pb-2"
            >
              {/* Close button - visible for everyone in ranking */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => isSolo ? resetGame() : setShowExitConfirm(true)}
                    className="absolute top-4 right-2 z-30"
                  >
                    <div className="btn-icon !text-[#F43F5E] hover:!border-[#F43F5E]/50">
                      <X className="w-5 h-5" />
                    </div>
                  </motion.button>

              {/* Trophy + Title — tipografia display bold */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="relative">
                  <motion.div
                    animate={{ scale: [1, 1.06, 1], rotate: [0, 3, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 3.5 }}
                    className="w-[12vh] h-[12vh] max-w-28 max-h-28 bg-[#A3E635] rounded-2xl flex items-center justify-center shadow-[0_24px_48px_-16px_rgba(163,230,53,0.45)] relative z-10 animate-pop-in"
                  >
                    <Trophy className="w-[6vh] h-[6vh] max-w-14 max-h-14 text-white" />
                  </motion.div>
                </div>

                <p className="eyebrow text-[#A3E635]">Resultado final</p>
                <h2 style={{ fontSize: 'clamp(2.25rem, 9vh, 5rem)' }} className="display-xl text-white leading-none">Vitória!</h2>
                <p className="text-zinc-400 font-medium uppercase tracking-[0.2em] text-xs">
                  Parabéns, {players.sort((a, b) => b.score - a.score)[0]?.nickname || 'Campeão'}!
                </p>
              </div>

              {/* Player list - use finalPlayersRef for ranking to ensure players don't disappear */}
              <div className="w-full flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2">
                {(() => {
                  // Priority: frozenPlayers > finalPlayersRef > players
                  const displayPlayers = frozenPlayers.length > 0 ? frozenPlayers : (finalPlayersRef.current.length > 0 ? finalPlayersRef.current : players);
                  return displayPlayers.sort((a, b) => b.score - a.score);
                })().map((p, idx) => {
                  const isMe = p.id === localPlayerId;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={cn(
                        "p-3 md:p-4 border rounded-2xl flex items-center justify-between transition-all relative overflow-hidden",
                        idx === 0 ? "bg-[#A3E635] border-[#A3E635] shadow-[0_20px_40px_-12px_rgba(163,230,53,0.35)] z-10" :
                        isMe ? "bg-[#121215] border-[#22D3EE]/50 ring-2 ring-[#22D3EE]/25 z-20" :
                        "bg-[#18181B] border-white/[0.08] opacity-90"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-xl font-display font-bold text-base shrink-0 border",
                          idx === 0 ? "bg-[#09090B] text-[#A3E635] border-[#09090B]" :
                          isMe ? "bg-[#22D3EE]/20 text-[#22D3EE] border-[#22D3EE]/40" :
                          "bg-white/[0.05] text-zinc-400 border-white/10"
                        )}>
                          {idx + 1}
                        </div>

                        <Avatar url={p.avatar || 'irmaos/1.png'} size={idx === 0 || isMe ? 48 : 40} className="shrink-0" />

                        <div className="flex flex-col min-w-0">
                          <span className={cn(
                            "text-base md:text-lg font-bold tracking-tight leading-tight truncate",
                            idx === 0 ? "text-white" : isMe ? "text-white" : "text-zinc-100"
                          )}>
                            {p.nickname}
                          </span>
                          <span className={cn(
                            "eyebrow text-[0.5rem] mt-0.5",
                            idx === 0 ? "text-zinc-100/60" : "text-zinc-500"
                          )}>
                            {p.id.startsWith("bot") ? "Bot" : "Jogador"}
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        "px-4 py-1.5 rounded-xl font-display font-bold text-xl md:text-2xl border shrink-0",
                        idx === 0 ? "bg-[#09090B] text-[#A3E635] border-[#09090B]" :
                        isMe ? "bg-[#22D3EE] text-white border-[#22D3EE]" :
                        "bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/35"
                      )}>
                        {p.score}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Timer countdown in ranking - just visual, no auto-delete */}
              {view === 'ranking' && !isSolo && (
                <RankingCountdown onComplete={() => {
                  // Just show a message, don't auto-delete
                  // Players and host must manually close
                }} />
              )}


            </motion.div>
          )}
        </AnimatePresence>

        {/* GLOBAL PODIUM CINEMATIC OVERLAY */}
        <AnimatePresence>
          {showPodium && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center overflow-hidden"
              >
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] to-transparent" />
                  <div className="flex flex-wrap justify-around gap-20 p-20">
                     {Array.from({length: 20}).map((_, i) => (
                       <Trophy key={i} className="w-20 h-20 text-white/10 rotate-12" />
                     ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {podiumStep === 0 && (
                        <motion.h2
                          key="wait"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 2, opacity: 0 }}
                          className="display-lg md:text-7xl text-white uppercase"
                        >
                          Quem foi o vencedor?
                        </motion.h2>
                  )}

                  {podiumStep >= 1 && (
                    <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-4 md:gap-8 w-full max-w-5xl h-full pb-10 overflow-y-auto md:overflow-visible no-scrollbar">
                      {/* 3rd Place */}
                      <motion.div
                        initial={{ y: 200, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0, type: "spring" }}
                        className="flex flex-col items-center gap-2 md:gap-3 order-3 md:order-1 scale-90 md:scale-100"
                      >
                        <div className="relative group">
                           <Avatar url={frozenPlayers.sort((a,b)=>b.score-a.score)[2]?.avatar || 'irmaos/1.png'} size={window.innerWidth < 768 ? 60 : 120} />
                           <div className="absolute -top-3 -left-3 w-10 h-10 bg-[#CD7F32] rounded-full border-2 md:border-4 border-white flex items-center justify-center text-white font-black text-lg shadow-lg">3º</div>
                        </div>
                        <span className="text-white font-black uppercase italic tracking-wide text-base md:text-xl truncate max-w-[150px]">
                           {frozenPlayers.sort((a,b)=>b.score-a.score)[2]?.nickname || "---"}
                        </span>
                        <div className="w-24 md:w-36 h-12 md:h-32 bg-[#CD7F32] border-2 md:border-4 border-white/30 rounded-t-xl md:rounded-t-3xl flex items-center justify-center flex-col gap-0 md:gap-1">
                           <span className="text-white/60 font-black text-[7px] md:text-sm uppercase">Pontos</span>
                           <span className="text-white font-black text-base md:text-2xl">{frozenPlayers.sort((a,b)=>b.score-a.score)[2]?.score || 0}</span>
                        </div>
                      </motion.div>

                      {/* 1st Place */}
                      <motion.div
                        initial={{ y: 300, opacity: 0 }}
                        animate={podiumStep >= 3 ? { y: 0, opacity: 1 } : { opacity: 0 }}
                        transition={{ type: "spring", stiffness: 100 }}
                        className="flex flex-col items-center gap-2 md:gap-4 order-1 md:order-2 mb-2 md:mb-10 scale-95 md:scale-110"
                      >
                        <div className="relative group">
                           <motion.div
                             animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                             transition={{ repeat: Infinity, duration: 4 }}
                           >
                             <Avatar url={frozenPlayers.sort((a,b)=>b.score-a.score)[0]?.avatar || 'irmaos/1.png'} size={window.innerWidth < 768 ? 100 : 220} className="ring-4 md:ring-[12px] ring-[#A3E635] ring-offset-2 md:ring-offset-4 ring-offset-black/50" />
                           </motion.div>
                           <div className="absolute -top-4 md:-top-10 left-1/2 -translate-x-1/2 w-12 h-12 md:w-24 md:h-24 bg-[#A3E635] rounded-full border-4 md:border-[6px] border-white flex items-center justify-center text-white font-black text-xl md:text-4xl shadow-2xl animate-bounce">1º</div>
                        </div>
                        <h3 className="text-xl md:text-6xl font-bold text-white uppercase tracking-tight">
                           {frozenPlayers.sort((a,b)=>b.score-a.score)[0]?.nickname || "---"}
                         </h3>
                         <div className="w-32 md:w-56 h-20 md:h-56 bg-gradient-to-b from-[#A3E635] to-[#4D7C0F] border-4 md:border-[6px] border-white/25 rounded-t-[1.5rem] md:rounded-t-[3rem] flex items-center justify-center flex-col gap-1 md:gap-2 shadow-[0_0_60px_rgba(163,230,53,0.3)] relative">
                            <Trophy className="hidden md:block w-16 h-16 text-zinc-100/30 absolute top-4" />
                            <span className="text-zinc-100/70 font-bold text-[9px] md:text-lg uppercase tracking-widest mt-2 md:mt-10">Vencedor</span>
                            <span className="text-white font-display font-bold text-xl md:text-5xl">{frozenPlayers.sort((a,b)=>b.score-a.score)[0]?.score || 0}</span>
                          </div>
                      </motion.div>

                      {/* 2nd Place */}
                      <motion.div
                        initial={{ y: 250, opacity: 0 }}
                        animate={podiumStep >= 2 ? { y: 0, opacity: 1 } : { opacity: 0 }}
                        transition={{ type: "spring" }}
                        className="flex flex-col items-center gap-2 md:gap-3 order-2 md:order-3 scale-90 md:scale-100"
                      >
                        <div className="relative group">
                           <Avatar url={frozenPlayers.sort((a,b)=>b.score-a.score)[1]?.avatar || 'irmaos/1.png'} size={window.innerWidth < 768 ? 80 : 150} className="ring-4 md:ring-8 ring-[#C0C0C0]" />
                           <div className="absolute -top-3 -right-3 w-10 h-10 md:w-16 md:h-16 bg-[#C0C0C0] rounded-full border-2 md:border-4 border-white flex items-center justify-center text-white font-black text-lg md:text-2xl shadow-xl">2º</div>
                        </div>
                        <span className="text-white font-black uppercase italic tracking-wide text-base md:text-2xl">
                           {frozenPlayers.sort((a,b)=>b.score-a.score)[1]?.nickname || "---"}
                        </span>
                        <div className="w-28 md:w-44 h-16 md:h-44 bg-[#C0C0C0] border-2 md:border-4 border-white/30 rounded-t-xl md:rounded-t-3xl flex items-center justify-center flex-col gap-0 md:gap-1">
                           <span className="text-white/60 font-black text-[8px] md:text-base uppercase">Vice</span>
                           <span className="text-white font-black text-lg md:text-3xl">{frozenPlayers.sort((a,b)=>b.score-a.score)[1]?.score || 0}</span>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Creator Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <React.Suspense fallback={<div className="bg-white rounded-3xl p-8 flex items-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-[#1E3A5F]" /><span className="text-sm font-bold text-slate-500">Carregando perfis...</span></div>}>
            <ProfileCreator
              initialNickname={profile?.nickname}
              initialAvatarUrl={profile?.avatarUrl}
              onSave={saveProfile}
              onCancel={() => setIsEditingProfile(false)}
            />
            </React.Suspense>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#18181B] border border-white/10 p-6 rounded-3xl w-full max-w-md flex flex-col gap-4 relative shadow-xl"
             >
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 w-10 h-10 bg-[#121215] border-2 border-[#09090B] rounded-xl flex items-center justify-center hover:bg-[#1C1C21]">
                   <X className="w-6 h-6 text-white" />
                </button>
                <h2 className="text-2xl font-bold text-white tracking-tight">Configurações</h2>
                 {/* Música de Fundo - REMOVIDA */}
                 <h3 className="text-lg font-semibold text-zinc-300 tracking-tight mt-4">Testar Conexões</h3>
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
                    }} className="btn-cartoon btn-purple py-3 font-bold flex items-center justify-between px-6">
                       <span>Testar Multiplayer</span>
                      <div className={cn("w-4 h-4 rounded-full border-2 border-white/20", testStatus.multiplayer === 'idle' ? 'bg-white/30' : testStatus.multiplayer === 'testing' ? 'bg-yellow-400 animate-pulse' : testStatus.multiplayer === 'ok' ? 'bg-[#34D399]' : 'bg-[#F43F5E]')} />
                   </button>
                </div>
             </motion.div>
          </div>
        )}

        {showHelp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#18181B] border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md flex flex-col gap-6 relative shadow-xl"
            >
              <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 w-10 h-10 bg-[#121215] border border-white/10 rounded-xl flex items-center justify-center hover:bg-[#1C1C21] transition-colors shadow-md">
                <X className="w-6 h-6 text-white" />
              </button>

              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 bg-[#8B5CF6] border border-white/10 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Info className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter cartoon-text">Ajuda & Stats</h2>
              </div>

              <div className="space-y-4">
                {/* Hymns Stat */}
                <div className="bg-[#34D399]/10 border-4 border-[#34D399] p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#34D399] border-2 border-[#09090B] rounded-xl flex items-center justify-center text-white shrink-0">
                    <Music className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Hinos Disponíveis</span>
                    <span className="text-2xl font-black text-white leading-none">{stats.totalHymns} Hinos</span>
                  </div>
                </div>

                {/* Biblia Stats */}
                <div className="bg-[#8B5CF6]/10 border-4 border-[#8B5CF6] p-4 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8B5CF6] border-2 border-[#09090B] rounded-xl flex items-center justify-center text-white shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-zinc-500">Quiz da Bíblia</span>
                      <span className="text-2xl font-black text-white leading-none">{stats.bibliaTotal} Perguntas</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-[#18181B] border-2 border-[#22C55E] p-2 rounded-xl flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-[#22C55E]">Fácil</span>
                      <span className="text-lg font-black text-white">{stats.bibliaEasy}</span>
                    </div>
                    <div className="bg-[#18181B] border-2 border-[#F59E0B] p-2 rounded-xl flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-[#F59E0B]">Médio</span>
                      <span className="text-lg font-black text-white">{stats.bibliaMedium}</span>
                    </div>
                    <div className="bg-[#18181B] border-2 border-[#8B5CF6] p-2 rounded-xl flex flex-col items-center">
                      <span className="text-[8px] font-black uppercase text-[#8B5CF6]">Difícil</span>
                      <span className="text-lg font-black text-white">{stats.bibliaHard}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-2 border-dashed border-[#F59E0B] p-4 rounded-xl">
                <p className="text-[10px] font-bold text-[#F59E0B] text-center leading-tight uppercase font-black">
                  Quer adicionar mais perguntas? <br/>Use o comando SQL no Supabase!
                </p>
              </div>

              <button 
                onClick={() => setShowHelp(false)} 
                className="btn-cartoon btn-purple w-full py-4 text-lg font-black uppercase"
              >
                ENTENDI!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
