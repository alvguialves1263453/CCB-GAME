import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Play, Settings, Copy, Check, ArrowLeft, Heart } from 'lucide-react';
import { soundService } from '../lib/soundService';

interface Player {
  id: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
}

interface WordBombLobbyProps {
  roomId: string;
  players: Player[];
  localPlayerId: string;
  lives: number;
  setLives: (lives: number) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export function WordBombLobby({
  roomId,
  players,
  localPlayerId,
  lives,
  setLives,
  onStartGame,
  onLeaveRoom,
}: WordBombLobbyProps) {
  const isHost = players.find(p => p.id === localPlayerId)?.isHost ?? false;
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    soundService.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    if (!isHost) return;
    soundService.playClick();
    onStartGame();
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gradient-to-br from-[#6d28d9] via-[#db2777] to-[#f97316] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="text-5xl"
        >
          💣
        </motion.div>

        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-[3px_3px_0px_#1a0533] mb-2">
            WORD BOMB
          </h1>
          <p className="text-white/80 font-bold">Adivinhe palavras antes da bomba explodir!</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLeaveRoom}
          className="p-3 bg-[#FF4757] hover:bg-[#FF3838] rounded-full transition-all text-white"
        >
          <ArrowLeft size={24} />
        </motion.button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left: Room info */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-white/95 rounded-3xl border-4 border-[#1a0533] p-6 flex flex-col gap-4 shadow-lg"
        >
          <div>
            <p className="text-sm font-bold text-[#1a0533]/60 mb-1">CÓDIGO DA SALA</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={copyRoomCode}
              className="w-full bg-gradient-to-r from-[#9B59F5] to-[#FF5A95] text-white font-black text-2xl py-3 px-4 rounded-xl border-3 border-[#1a0533] tracking-widest flex items-center justify-center gap-2 hover:shadow-lg transition-all"
            >
              {roomId}
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </motion.button>
            {copied && (
              <p className="text-sm text-[#4ECB71] font-bold mt-2">✓ Copiado!</p>
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-[#1a0533]/60 mb-2">CONFIGURAÇÕES</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSettings(!showSettings)}
              className="w-full bg-[#FFD700] hover:bg-[#FFC700] text-[#1a0533] font-black py-3 px-4 rounded-xl border-3 border-[#1a0533] flex items-center justify-center gap-2 transition-all"
            >
              <Settings size={20} />
              Vidas: {lives}
            </motion.button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  {[1, 2, 3].map(livesOption => (
                    <motion.button
                      key={livesOption}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setLives(livesOption);
                        soundService.playClick();
                      }}
                      className={`w-full py-2 px-3 rounded-lg border-2 font-bold transition-all flex items-center gap-2 justify-center ${
                        lives === livesOption
                          ? 'bg-[#9B59F5] text-white border-[#1a0533]'
                          : 'bg-white/50 text-[#1a0533] border-[#1a0533]/30 hover:bg-white/70'
                      }`}
                    >
                      {[...Array(livesOption)].map((_, i) => (
                        <span key={i}>❤️</span>
                      ))}
                      {livesOption} vida{livesOption > 1 ? 's' : ''}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isHost && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="w-full mt-auto bg-gradient-to-r from-[#4ECB71] to-[#2EAA4E] hover:from-[#3EBB61] hover:to-[#1E9A3E] disabled:from-gray-400 disabled:to-gray-400 text-white font-black py-4 px-6 rounded-xl border-4 border-[#1a0533] flex items-center justify-center gap-3 text-lg transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
            >
              <Play size={24} />
              Começar Partida
            </motion.button>
          )}

          {!isHost && (
            <div className="mt-auto p-4 bg-[#FFD700]/20 rounded-lg text-center">
              <p className="text-sm font-bold text-[#1a0533]">
                Aguardando o host iniciar a partida...
              </p>
            </div>
          )}
        </motion.div>

        {/* Right: Players list */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white/95 rounded-3xl border-4 border-[#1a0533] p-6 shadow-lg overflow-y-auto"
        >
          <h2 className="text-2xl font-black text-[#1a0533] mb-4 flex items-center gap-2">
            <Users size={28} />
            Jogadores ({players.length})
          </h2>

          <div className="space-y-3">
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="bg-gradient-to-r from-[#9B59F5]/10 to-[#FF5A95]/10 rounded-2xl border-3 border-[#1a0533]/30 p-4 flex items-center justify-between hover:border-[#1a0533]/60 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9B59F5] to-[#FF5A95] flex items-center justify-center text-xl font-black border-2 border-[#1a0533] flex-shrink-0">
                      {player.avatar || '👤'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[#1a0533] truncate">
                        {player.nickname}
                      </p>
                      {player.id === localPlayerId && (
                        <span className="text-xs font-bold text-[#4ECB71]">
                          (Você)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Host badge */}
                  {player.isHost && (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-xl"
                    >
                      👑
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {players.length < 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 p-4 bg-[#FF5A95]/20 rounded-xl text-center"
            >
              <p className="text-sm font-bold text-[#FF5A95]">
                Aguardando mais jogadores... Mínimo 2 necessários!
              </p>
            </motion.div>
          )}

          {/* Game rules */}
          <div className="mt-8 pt-6 border-t-2 border-[#1a0533]/20">
            <h3 className="text-lg font-black text-[#1a0533] mb-3">📋 Regras</h3>
            <ul className="space-y-2 text-sm text-[#1a0533]/80">
              <li className="flex gap-2">
                <span className="flex-shrink-0">💣</span>
                <span><strong>Bomba:</strong> 8 segundos que diminuem a cada rodada</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">🔤</span>
                <span><strong>Letras:</strong> Digite uma palavra com as letras mostradas</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">❌</span>
                <span><strong>Tempo:</strong> Responda antes da bomba explodir!</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">❤️</span>
                <span><strong>Vidas:</strong> Perde 1 vida a cada explosão</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0">🏆</span>
                <span><strong>Vencedor:</strong> Último jogador sobrevivente</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
