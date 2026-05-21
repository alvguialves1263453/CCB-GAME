import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateLetterSequence, validateWord, calculateTimerForRound, type LetterSequence } from '../services/wordBombService';
import { soundService } from '../lib/soundService';
import { Heart, Send, AlertCircle, Trophy } from 'lucide-react';

interface WordBombPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  lives: number;
  isAlive: boolean;
  isCurrentTurn: boolean;
}

interface WordBombGameProps {
  players: WordBombPlayer[];
  roomId: string;
  playerId: string;
  lives: number;
  onGameEnd?: (winner: WordBombPlayer) => void;
  onQuit?: () => void;
}

export function WordBomb({ players, roomId, playerId, lives, onGameEnd, onQuit }: WordBombGameProps) {
  // Game state
  const [gameState, setGameState] = useState<'playing' | 'paused' | 'explosion' | 'roundEnd'>('playing');
  const [currentLetters, setCurrentLetters] = useState<LetterSequence | null>(null);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [alivePlayers, setAlivePlayers] = useState<string[]>(players.map(p => p.id));
  
  // Timer state
  const [bombTimer, setBombTimer] = useState(8);
  const [baseTimer, setBaseTimer] = useState(8);
  const [round, setRound] = useState(0);
  
  // UI state
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'invalid'; message: string } | null>(null);
  const [explosion, setExplosion] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const explosionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize game
  useEffect(() => {
    const letters = generateLetterSequence();
    setCurrentLetters(letters);
    setBombTimer(8);
    setBaseTimer(8);
    
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (gameState !== 'playing') return;

    timerIntervalRef.current = setInterval(() => {
      setBombTimer(prev => {
        const newTimer = prev - 0.1;
        
        if (newTimer <= 0) {
          // Bomb exploded!
          handleBombExplosion();
          return 0;
        }
        
        // Play warning sound at different times
        if (newTimer <= 3 && Math.round(newTimer * 10) % 10 === 0) {
          soundService.playClick();
        }
        
        return newTimer;
      });
    }, 100);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameState, currentPlayerIndex]);

  const isMyTurn = alivePlayers[currentPlayerIndex] === playerId;
  const currentPlayer = players.find(p => p.id === alivePlayers[currentPlayerIndex]);

  const handleBombExplosion = useCallback(() => {
    if (gameState !== 'playing') return;

    soundService.playClick();
    setGameState('explosion');
    
    // Remove current player's life
    const deadPlayer = alivePlayers[currentPlayerIndex];
    const playerToUpdate = players.find(p => p.id === deadPlayer);
    
    if (playerToUpdate) {
      playerToUpdate.lives -= 1;
      
      if (playerToUpdate.lives <= 0) {
        // Player is eliminated
        const newAlive = alivePlayers.filter(id => id !== deadPlayer);
        
        if (newAlive.length === 1) {
          // Game over - winner found!
          const winner = players.find(p => p.id === newAlive[0]);
          if (winner) {
            onGameEnd?.(winner);
          }
          return;
        }
        
        setAlivePlayers(newAlive);
        setCurrentPlayerIndex(0);
      } else {
        // Move to next player
        moveToNextPlayer();
      }
    }

    setExplosion(true);
    explosionTimeoutRef.current = setTimeout(() => {
      setExplosion(false);
      setGameState('playing');
      startNewRound();
    }, 1500);
  }, [gameState, currentPlayerIndex, alivePlayers, players, onGameEnd]);

  const moveToNextPlayer = useCallback(() => {
    setCurrentPlayerIndex(prev => {
      const nextIndex = (prev + 1) % alivePlayers.length;
      return nextIndex;
    });
  }, [alivePlayers.length]);

  const startNewRound = useCallback(() => {
    const letters = generateLetterSequence();
    setCurrentLetters(letters);
    setInputValue('');
    setFeedback(null);
    
    const newTimer = calculateTimerForRound(round + 1);
    setBombTimer(newTimer);
    setBaseTimer(newTimer);
    setRound(prev => prev + 1);
  }, [round]);

  const handleSubmitWord = useCallback((word: string) => {
    if (!isMyTurn || gameState !== 'playing' || !currentLetters) return;

    const cleanWord = word.toLowerCase().trim();

    // Validate word
    if (cleanWord.length === 0) {
      setFeedback({ type: 'invalid', message: 'Digite uma palavra!' });
      return;
    }

    if (usedWords.has(cleanWord)) {
      setFeedback({ type: 'error', message: 'Palavra já foi usada!' });
      soundService.playClick();
      return;
    }

    if (!validateWord(cleanWord, currentLetters.letters, currentLetters.position)) {
      setFeedback({ type: 'error', message: 'Palavra não contém as letras!' });
      soundService.playClick();
      return;
    }

    // Valid word!
    soundService.playClick();
    setFeedback({ type: 'success', message: 'Correto! ✓' });
    setUsedWords(prev => new Set(prev).add(cleanWord));
    setInputValue('');

    // Move to next player and start new round
    setTimeout(() => {
      moveToNextPlayer();
      startNewRound();
    }, 600);
  }, [isMyTurn, gameState, currentLetters, usedWords, moveToNextPlayer, startNewRound]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitWord(inputValue);
    }
  }, [inputValue, handleSubmitWord]);

  // Calculate circle positions for players
  const getPlayerPosition = (index: number) => {
    const totalPlayers = players.length;
    const angle = (index / totalPlayers) * Math.PI * 2;
    const radius = 35; // percentage of container
    
    const x = 50 + radius * Math.cos(angle - Math.PI / 2);
    const y = 50 + radius * Math.sin(angle - Math.PI / 2);
    
    return { x, y };
  };

  const alivePlayerCount = alivePlayers.length;

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-gradient-to-br from-[#6d28d9] via-[#db2777] to-[#f97316]">
      {/* Top status bar */}
      <div className="px-4 py-3 flex justify-between items-center bg-black/20 backdrop-blur-sm">
        <div className="text-white font-black text-xl">
          Rodada <span className="text-[#FFD700]">{round + 1}</span>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
            <span className="text-white font-bold">Jogadores:</span>
            <span className="text-[#FFD700] font-black text-lg">{alivePlayerCount}</span>
          </div>
          <button
            onClick={onQuit}
            className="bg-[#FF4757] hover:bg-[#FF3838] text-white font-bold px-4 py-2 rounded-full transition-all"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Game arena */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Players in circle */}
        <div className="absolute inset-0">
          {alivePlayers.map((playerId, index) => {
            const player = players.find(p => p.id === playerId);
            if (!player) return null;

            const pos = getPlayerPosition(index);
            const isCurrent = index === currentPlayerIndex;

            return (
              <motion.div
                key={playerId}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  animate={{
                    scale: isCurrent ? [1, 1.05, 1] : 1,
                    filter: isCurrent ? 'drop-shadow(0 0 20px #FFD700)' : 'drop-shadow(0 0 10px rgba(0,0,0,0.5))',
                  }}
                  transition={{ duration: 0.6, repeat: isCurrent ? Infinity : 0 }}
                  className="flex flex-col items-center gap-2"
                >
                  {/* Avatar */}
                  <motion.div
                    className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl font-black flex-shrink-0 transition-all ${
                      player.isAlive ? 'bg-gradient-to-br from-[#9B59F5] to-[#FF5A95] border-white' : 'bg-gray-600 border-gray-700 opacity-50'
                    }`}
                    animate={{
                      boxShadow: isCurrent ? ['0 0 20px #FFD700', '0 0 40px #FFD700', '0 0 20px #FFD700'] : '0 0 10px rgba(0,0,0,0.5)',
                    }}
                    transition={{ duration: 0.6, repeat: isCurrent ? Infinity : 0 }}
                  >
                    {player.avatar || '👤'}
                  </motion.div>

                  {/* Nickname */}
                  <div className="text-white font-bold text-sm text-center bg-black/40 px-3 py-1 rounded-lg whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis">
                    {player.nickname}
                  </div>

                  {/* Lives */}
                  <div className="flex gap-1">
                    {[...Array(lives)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: i < player.lives ? 1 : 0.5,
                          opacity: i < player.lives ? 1 : 0.3,
                        }}
                      >
                        <Heart
                          size={18}
                          fill={i < player.lives ? '#FF4757' : 'transparent'}
                          color={i < player.lives ? '#FF4757' : '#888'}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Arrow indicator */}
                  {isCurrent && (
                    <motion.div
                      animate={{ y: [-10, 10, -10] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-3xl"
                    >
                      ⬇️
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Bomb in center */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-8"
          animate={{
            scale: explosion ? [1, 1.2, 0.8] : 1,
          }}
          transition={{
            duration: explosion ? 0.4 : 0.3,
          }}
        >
          {/* Letter sequence above bomb */}
          {currentLetters && (
            <motion.div
              key={`${currentLetters.letters}-${round}`}
              initial={{ scale: 0, rotateX: 90 }}
              animate={{ scale: 1, rotateX: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="text-sm font-bold text-white/70 mb-2">
                {currentLetters.position === 'start' && '🔤 Início da palavra'}
                {currentLetters.position === 'middle' && '🔤 Meio da palavra'}
                {currentLetters.position === 'end' && '🔤 Final da palavra'}
              </div>
              <div className="text-5xl md:text-6xl font-black text-[#FFD700] tracking-widest drop-shadow-[3px_3px_0px_#1a0533] uppercase">
                {currentLetters.letters}
              </div>
            </motion.div>
          )}

          {/* Bomb */}
          <motion.div
            className="relative"
            animate={{
              scale: explosion ? 1.5 : 1,
            }}
          >
            {/* Explosion effect */}
            {explosion && (
              <motion.div
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 w-40 h-40 -left-20 -top-20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF4757] via-[#FFD700] to-[#f97316] rounded-full blur-2xl" />
              </motion.div>
            )}

            {/* Bomb SVG */}
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="drop-shadow-[8px_8px_0px_rgba(26,5,51,0.8)]"
            >
              {/* Bomb body */}
              <circle cx="80" cy="95" r="60" fill="#1a1a1a" stroke="#1a0533" strokeWidth="3" />
              
              {/* Shine on bomb */}
              <ellipse cx="60" cy="70" rx="20" ry="25" fill="rgba(255,255,255,0.2)" />

              {/* Fuse base */}
              <rect x="76" y="30" width="8" height="20" fill="#8B4513" stroke="#1a0533" strokeWidth="2" />

              {/* Fuse - animated */}
              <motion.path
                d="M80 30 Q75 20 80 10 Q85 20 80 30"
                stroke="#FF6B35"
                strokeWidth="4"
                fill="none"
                animate={{
                  opacity: [1, 0.5, 1],
                }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />

              {/* Spark particles */}
              {[0, 1, 2].map(i => (
                <motion.circle
                  key={i}
                  cx="80"
                  cy="10"
                  r="3"
                  fill="#FFD700"
                  animate={{
                    y: [0, -20 - i * 10],
                    opacity: [1, 0],
                  }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.15,
                    repeat: Infinity,
                  }}
                />
              ))}

              {/* Pulse animation */}
              <motion.circle
                cx="80"
                cy="95"
                r="60"
                fill="none"
                stroke="rgba(255, 215, 0, 0.5)"
                strokeWidth="2"
                animate={{
                  r: [60, 70, 60],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                }}
              />
            </svg>
          </motion.div>

          {/* Timer display */}
          <motion.div
            className="text-center"
            animate={{
              scale: bombTimer < 3 ? [1, 1.1, 1] : 1,
              color: bombTimer < 3 ? '#FF4757' : '#FFD700',
            }}
            transition={{
              duration: 0.5,
              repeat: bombTimer < 3 ? Infinity : 0,
            }}
          >
            <div className="text-7xl md:text-8xl font-black drop-shadow-[4px_4px_0px_#1a0533]">
              {bombTimer.toFixed(1)}
            </div>
            <div className="text-sm font-bold text-white/70 mt-2">segundos</div>
          </motion.div>
        </motion.div>
      </div>

      {/* Input area */}
      {isMyTurn ? (
        <div className="px-4 py-6 bg-black/40 backdrop-blur-sm border-t-4 border-[#FFD700]">
          <div className="max-w-2xl mx-auto">
            {feedback && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className={`mb-3 p-3 rounded-lg font-bold text-center ${
                  feedback.type === 'success'
                    ? 'bg-[#4ECB71]/20 text-[#4ECB71]'
                    : 'bg-[#FF4757]/20 text-[#FF4757]'
                }`}
              >
                {feedback.message}
              </motion.div>
            )}

            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Sua palavra..."
                className="flex-1 px-4 py-3 rounded-xl border-4 border-[#1a0533] font-bold text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmitWord(inputValue)}
                className="bg-[#9B59F5] hover:bg-[#8B48E5] text-white font-black px-6 py-3 rounded-xl border-4 border-[#1a0533] flex items-center gap-2 transition-all"
              >
                <Send size={20} />
                Enviar
              </motion.button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 bg-black/40 backdrop-blur-sm border-t-4 border-[#FF5A95] text-center">
          <div className="text-white font-bold">
            Aguardando <span className="text-[#FFD700]">{currentPlayer?.nickname}</span> responder...
          </div>
          <motion.div
            animate={{ opacity: [0.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="mt-2 text-2xl"
          >
            ⏳
          </motion.div>
        </div>
      )}
    </div>
  );
}
