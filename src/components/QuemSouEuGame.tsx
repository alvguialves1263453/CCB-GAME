import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Play, Plus, X, Shuffle, Check, Trophy, Crown,
  RotateCcw, Users, Timer, Eye, EyeOff, SkipForward, PartyPopper,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { soundService } from "../lib/soundService";
import {
  QS_TIMER_SECONDS, QS_GOAL_POINTS, QS_SWAPS_PER_ROUND,
  QS_MIN_PLAYERS, QS_MAX_PLAYERS,
  type QSWord, type QSPlayer,
  makePlayerId, calcPontos, calcPontosMimico, shuffle, formatTime,
  FALLBACK_WORDS,
} from "../data/quemSouEu";

type QSPhase = "setup" | "roleta" | "vezde" | "revelar" | "mimica" | "fim";

const ACCENT = "#F472B6";

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {}
}

export function QuemSouEuGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<QSPhase>("setup");
  const [players, setPlayers] = useState<QSPlayer[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [deck, setDeck] = useState<QSWord[]>([]);
  const [wordPos, setWordPos] = useState(0);
  const [actorIdx, setActorIdx] = useState(0);
  const [swapsLeft, setSwapsLeft] = useState(QS_SWAPS_PER_ROUND);
  const [timeLeft, setTimeLeft] = useState(QS_TIMER_SECONDS);
  const [rouletteIdx, setRouletteIdx] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [rouletteDone, setRouletteDone] = useState(false);
  const [flash, setFlash] = useState<{ guesserId: string; pts: number; mimePts: number } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [roundNo, setRoundNo] = useState(1);

  const timerRef = useRef<number | null>(null);
  const spinTimeout = useRef<number | null>(null);
  const lastWhole = useRef<number>(QS_TIMER_SECONDS);
  const playersRef = useRef<QSPlayer[]>([]);
  playersRef.current = players;

  // Banco de palavras: Supabase com fallback offline
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("quemsou_palavras").select("texto,categoria");
        if (!error && data && data.length > 0 && alive) {
          setDeck(shuffle(data.map((d: any) => ({ texto: String(d.texto), categoria: String(d.categoria || "Bíblia") }))));
          return;
        }
      } catch {}
      if (alive) setDeck(shuffle(FALLBACK_WORDS));
    })();
    return () => { alive = false; };
  }, []);

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spinTimeout.current) clearTimeout(spinTimeout.current);
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const currentWord: QSWord | null = deck.length > 0 ? deck[wordPos % deck.length] : null;

  const drawNextWord = () => {
    const next = wordPos + 1;
    if (next >= deck.length && deck.length > 0) {
      // Baralho esgotado: reembaralha e recomeça (evita travar a partida)
      setDeck((d) => shuffle(d));
      setWordPos(0);
    } else {
      setWordPos(next);
    }
  };

  // ---------- setup ----------
  const addPlayer = () => {
    const nome = nameInput.trim().slice(0, 16);
    if (!nome || players.length >= QS_MAX_PLAYERS) return;
    if (players.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) return;
    soundService.playClick();
    setPlayers((ps) => [...ps, { id: makePlayerId(), nome, pontos: 0, trocasUsadas: 0 }]);
    setNameInput("");
  };

  const removePlayer = (id: string) => {
    soundService.playClick();
    setPlayers((ps) => ps.filter((p) => p.id !== id));
  };

  const startGame = () => {
    if (players.length < QS_MIN_PLAYERS) return;
    soundService.playGameStart();
    setRouletteIdx(0);
    setSpinning(false);
    setRouletteDone(false);
    setPhase("roleta");
  };

  // ---------- roleta ----------
  const spin = () => {
    if (spinning || players.length === 0) return;
    soundService.playClick();
    setSpinning(true);
    setRouletteDone(false);
    const n = players.length;
    const start = rouletteIdx;
    const target = Math.floor(Math.random() * n);
    const base = n * 2 + 3;
    const total = base + ((target - start) % n + n) % n;
    let ticks = 0;
    const step = () => {
      ticks++;
      setRouletteIdx((i) => (i + 1) % n);
      soundService.playTick();
      if (ticks >= total) {
        setSpinning(false);
        setRouletteDone(true);
        soundService.playGameStart();
        vibrate(60);
      } else {
        spinTimeout.current = window.setTimeout(step, ticks < total - 5 ? 85 : 240);
      }
    };
    step();
  };

  // ---------- round ----------
  // Toda troca de turno cai primeiro na tela cheia "VEZ DE..." para
  // dar tempo de passar o celular. Só depois o mímico vê a palavra.
  const startRound = (idx: number) => {
    stopTimer();
    setFlash(null);
    setTimedOut(false);
    setActorIdx(idx);
    setSwapsLeft(QS_SWAPS_PER_ROUND);
    setTimeLeft(QS_TIMER_SECONDS);
    lastWhole.current = QS_TIMER_SECONDS;
    setRoundNo((r) => r + 1);
    setPhase("vezde");
  };

  const trocarPalavra = () => {
    if (swapsLeft <= 0 || !currentWord) return;
    soundService.playClick();
    setSwapsLeft((s) => s - 1);
    drawNextWord();
  };

  const pularVez = () => {
    // Pula a vez: palavra volta pro fim da fila e a vez passa adiante
    soundService.playClick();
    if (currentWord) setDeck((d) => [...d.filter((_, i) => i !== (wordPos % d.length)), currentWord]);
    setWordPos(0);
    const next = (actorIdx + 1) % players.length;
    startRound(next);
  };

  const confirmarPalavra = () => {
    if (!currentWord) return;
    soundService.playGameStart();
    setTimeLeft(QS_TIMER_SECONDS);
    lastWhole.current = QS_TIMER_SECONDS;
    setTimedOut(false);
    setFlash(null);
    setPhase("mimica");
  };

  // ---------- timer da mímica ----------
  useEffect(() => {
    if (phase !== "mimica" || flash || timedOut) return;
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        const nt = Math.max(0, t - 0.25);
        const whole = Math.ceil(nt);
        if (whole !== lastWhole.current) {
          lastWhole.current = whole;
          if (whole <= 5 && whole > 0) soundService.playCountdown();
        }
        if (nt <= 0) {
          stopTimer();
          soundService.playBuzzer();
          vibrate([120, 80, 120]);
          setTimedOut(true);
        }
        return nt;
      });
    }, 250);
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, flash, timedOut, actorIdx, roundNo]);

  // ---------- acerto ----------
  const marcarAcerto = (guesserId: string) => {
    if (flash || timedOut || phase !== "mimica") return;
    stopTimer();
    const pts = calcPontos(timeLeft);
    const mimePts = calcPontosMimico(pts);
    const guesser = playersRef.current.find((p) => p.id === guesserId);
    if (!guesser) return;
    soundService.playCorrect();
    vibrate(40);
    setPlayers((ps) =>
      ps.map((p) =>
        p.id === guesserId
          ? { ...p, pontos: p.pontos + pts }
          : p.id === playersRef.current[actorIdx]?.id
            ? { ...p, pontos: p.pontos + mimePts }
            : p
      )
    );
    setFlash({ guesserId, pts, mimePts });
    const guesserIdx = playersRef.current.findIndex((p) => p.id === guesserId);
    const totalGuesser = (guesser?.pontos || 0) + pts;
    window.setTimeout(() => {
      if (totalGuesser >= QS_GOAL_POINTS) {
        soundService.playVictory();
        try {
          confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
        } catch {}
        setFlash(null);
        setPhase("fim");
      } else {
        drawNextWord();
        startRound(guesserIdx >= 0 ? guesserIdx : (actorIdx + 1) % playersRef.current.length);
      }
    }, 1800);
  };

  // ---------- fim ----------
  const jogarDeNovo = () => {
    soundService.playClick();
    setPlayers((ps) => ps.map((p) => ({ ...p, pontos: 0, trocasUsadas: 0 })));
    setWordPos(0);
    setRoundNo(1);
    setRouletteIdx(0);
    setSpinning(false);
    setRouletteDone(false);
    setFlash(null);
    setTimedOut(false);
    setPhase("roleta");
  };

  const trocarJogadores = () => {
    soundService.playClick();
    stopTimer();
    setPlayers([]);
    setNameInput("");
    setWordPos(0);
    setRoundNo(1);
    setSpinning(false);
    setRouletteDone(false);
    setFlash(null);
    setTimedOut(false);
    setPhase("setup");
  };

  const sair = () => {
    soundService.playClick();
    stopTimer();
    onExit();
  };

  const ranking = [...players].sort((a, b) => b.pontos - a.pontos);
  const actor = players[actorIdx];
  const guessers = players.filter((_, i) => i !== actorIdx);
  const timerPct = Math.max(0, Math.min(100, (timeLeft / QS_TIMER_SECONDS) * 100));
  const timerColor = timeLeft > 30 ? "#34D399" : timeLeft > 10 ? "#FBBF24" : "#EF4444";

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <button onClick={sair} className="btn-icon" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="eyebrow" style={{ color: ACCENT }}>Quem sou eu?</p>
          <h2 className="display-md text-white">
            {phase === "setup" && "Quem vai jogar?"}
            {phase === "roleta" && "Quem começa?"}
            {phase === "vezde" && "Passe o celular"}
            {phase === "revelar" && `Vez de ${actor?.nome || "..."}`}
            {phase === "mimica" && `${actor?.nome || "..."} mimica!`}
            {phase === "fim" && "Resultado"}
          </h2>
        </div>
        <div
          className="px-3 py-1.5 rounded-xl border text-xs font-black shrink-0"
          style={{ borderColor: `${ACCENT}50`, color: ACCENT }}
        >
          META {QS_GOAL_POINTS}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ============ SETUP ============ */}
        {phase === "setup" && (
          <motion.div
            key="qs-setup"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addPlayer(); }}
                  maxLength={16}
                  placeholder="Nome do jogador"
                  className="input-cartoon flex-1"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={addPlayer}
                  disabled={!nameInput.trim() || players.length >= QS_MAX_PLAYERS}
                  className="btn-cartoon btn-green px-4 py-2 text-sm disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </motion.button>
              </div>

              {players.length === 0 ? (
                <p className="text-center text-sm text-zinc-500 font-medium py-3">
                  Escreva o nome e clique no + para adicionar.
                  <br />Mínimo de {QS_MIN_PLAYERS} jogadores.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {players.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: `${ACCENT}20`, color: ACCENT }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 font-bold text-white truncate">{p.nome}</span>
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-white/5"
                        aria-label={`Remover ${p.nome}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <motion.button
              whileTap={players.length >= QS_MIN_PLAYERS ? { scale: 0.98 } : {}}
              onClick={startGame}
              disabled={players.length < QS_MIN_PLAYERS}
              className="btn-cartoon btn-green w-full p-3 text-xl tracking-widest gap-2 disabled:opacity-60"
            >
              <Play className="w-5 h-5 fill-current" />
              COMEÇAR
            </motion.button>
            {players.length < QS_MIN_PLAYERS && (
              <p className="text-center text-xs text-zinc-500 font-semibold">
                Faltam {QS_MIN_PLAYERS - players.length} jogador(es)
              </p>
            )}
          </motion.div>
        )}

        {/* ============ ROLETA ============ */}
        {phase === "roleta" && (
          <motion.div
            key="qs-roleta"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 items-center">
              <p className="eyebrow text-zinc-500 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Roleta inicial
              </p>
              <div className="flex flex-wrap justify-center gap-2 w-full">
                {players.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border-2 font-black text-sm transition-all duration-150",
                      i === rouletteIdx
                        ? "scale-110 text-white"
                        : "border-white/10 text-zinc-500 bg-white/[0.03]"
                    )}
                    style={i === rouletteIdx ? { borderColor: ACCENT, background: `${ACCENT}25`, color: "#fff" } : undefined}
                  >
                    {p.nome}
                  </div>
                ))}
              </div>
              <AnimatePresence>
                {rouletteDone && players[rouletteIdx] && (
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-lg font-black text-white flex items-center gap-2"
                  >
                    <PartyPopper className="w-5 h-5" style={{ color: ACCENT }} />
                    {players[rouletteIdx].nome} começa!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {!rouletteDone ? (
              <motion.button
                whileTap={!spinning ? { scale: 0.98 } : {}}
                onClick={spin}
                disabled={spinning}
                className="btn-cartoon w-full p-3 text-xl tracking-widest gap-2 disabled:opacity-70"
                style={{ background: ACCENT }}
              >
                <Shuffle className="w-5 h-5" />
                {spinning ? "GIRANDO..." : "GIRAR"}
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { soundService.playClick(); startRound(rouletteIdx); }}
                className="btn-cartoon btn-green w-full p-3 text-xl tracking-widest gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                VAMOS LÁ!
              </motion.button>
            )}
          </motion.div>
        )}

        {/* ============ VEZ DE... (tela cheia p/ passar o celular) ============ */}
        {phase === "vezde" && actor && (
          <motion.div
            key={`qs-vezde-${roundNo}-${actor.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-[50dvh] flex flex-col items-center justify-center gap-4 rounded-2xl border-2 p-6 text-center"
            style={{ borderColor: `${ACCENT}60`, background: "#121215" }}
          >
            <motion.span
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="text-6xl"
            >
              📱
            </motion.span>
            <p className="eyebrow text-zinc-400">Passe o celular para</p>
            <motion.p
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="font-display font-bold text-white leading-tight"
              style={{ fontSize: "2.75rem" }}
            >
              VEZ DE
              <br />
              <span style={{ color: ACCENT }}>{actor.nome}</span>
            </motion.p>
            <p className="text-sm text-zinc-500 font-semibold max-w-[260px]">
              Entregue o aparelho para {actor.nome}. Ninguém mais pode olhar a próxima tela!
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { soundService.playClick(); setPhase("revelar"); }}
              className="btn-cartoon btn-green w-full p-3 text-lg tracking-widest gap-2 mt-2"
            >
              <Eye className="w-5 h-5" />
              SOU {actor.nome.toUpperCase()}! VER PALAVRA
            </motion.button>
          </motion.div>
        )}

        {/* ============ REVELAR (só o mímico olha) ============ */}
        {phase === "revelar" && actor && currentWord && (
          <motion.div
            key={`qs-revelar-${roundNo}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-3"
          >
            <PlacarStrip players={players} highlightId={actor.id} />

            <div className="bg-[#121215] border-2 rounded-2xl p-5 flex flex-col gap-2 items-center text-center" style={{ borderColor: `${ACCENT}60` }}>
              <p className="eyebrow text-zinc-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Só {actor.nome} olha!
              </p>
              <p className="text-3xl md:text-4xl font-black text-white leading-tight">{currentWord.texto}</p>
              <span className="text-[0.65rem] font-black uppercase tracking-widest px-3 py-1 rounded-full border" style={{ borderColor: `${ACCENT}50`, color: ACCENT }}>
                {currentWord.categoria}
              </span>
              <p className="text-xs text-zinc-500 font-semibold mt-1">
                Trocas neste round: {swapsLeft}/{QS_SWAPS_PER_ROUND}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={swapsLeft > 0 ? { scale: 0.97 } : {}}
                onClick={trocarPalavra}
                disabled={swapsLeft <= 0}
                className="btn-cartoon btn-white p-3 text-sm gap-2 disabled:opacity-50"
              >
                <Shuffle className="w-4 h-4" />
                TROCAR ({swapsLeft})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={pularVez}
                className="btn-cartoon p-3 text-sm gap-2 bg-white/[0.06] border-white/15 text-zinc-300"
              >
                <SkipForward className="w-4 h-4" />
                PULAR VEZ
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={confirmarPalavra}
              className="btn-cartoon btn-green w-full p-3 text-xl tracking-widest gap-2"
            >
              <Check className="w-5 h-5" />
              CONFIRMAR E COMEÇAR
            </motion.button>
            <p className="text-center text-xs text-zinc-500 font-semibold">
              Esconda a tela e faça a mímica em {formatTime(QS_TIMER_SECONDS)}!
            </p>
          </motion.div>
        )}

        {/* ============ MÍMICA (timer + quem acertou) ============ */}
        {phase === "mimica" && actor && (
          <motion.div
            key={`qs-mimica-${roundNo}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-[#121215] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 items-center">
              <p className="eyebrow text-zinc-500 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" /> {actor.nome} está mimicando
              </p>
              <p className="font-display font-bold leading-none tabular-nums" style={{ color: timerColor, fontSize: "3.5rem" }}>
                {formatTime(timeLeft)}
              </p>
              <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{ width: `${timerPct}%`, background: timerColor }}
                />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" /> palavra escondida · {currentWord?.categoria}
              </p>
            </div>

            <AnimatePresence>
              {flash && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-[#121215] border-2 rounded-2xl p-4 text-center"
                  style={{ borderColor: "#34D399" }}
                >
                  <p className="text-lg font-black text-white">
                    {players.find((p) => p.id === flash.guesserId)?.nome} acertou! +{flash.pts}
                  </p>
                  <p className="text-sm font-bold text-zinc-400">
                    {actor.nome} (mímica) +{flash.mimePts}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {timedOut ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#121215] border-2 border-red-500/60 rounded-2xl p-4 text-center flex flex-col gap-3"
                >
                  <p className="text-2xl font-black text-white">⏰ ACABOU!</p>
                  <p className="text-sm font-bold text-zinc-400">
                    Ninguém acertou "{currentWord?.texto}". Vez passa adiante.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { soundService.playClick(); drawNextWord(); startRound((actorIdx + 1) % players.length); }}
                    className="btn-cartoon btn-green w-full p-3 text-lg tracking-widest"
                  >
                    CONTINUAR
                  </motion.button>
                </motion.div>
              ) : (
                !flash && (
                  <motion.div key="qs-guessers" exit={{ opacity: 0 }} className="flex flex-col gap-2">
                    <p className="eyebrow text-zinc-500 text-center">Quem acertou? Toque no nome 👇</p>
                    <div className="grid grid-cols-2 gap-2">
                      {guessers.map((p) => (
                        <motion.button
                          key={p.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => marcarAcerto(p.id)}
                          className="bg-[#121215] border border-white/10 hover:border-white/25 rounded-xl px-3 py-3 flex flex-col items-center gap-0.5 transition-colors"
                        >
                          <span className="font-black text-white truncate max-w-full">{p.nome}</span>
                          <span className="text-xs font-bold text-zinc-500 tabular-nums">{p.pontos} pts</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ============ FIM / RANKING ============ */}
        {phase === "fim" && (
          <motion.div
            key="qs-fim"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-3"
          >
            <div className="bg-[#121215] border-2 rounded-2xl p-5 text-center flex flex-col gap-1 items-center" style={{ borderColor: `${ACCENT}60` }}>
              <Crown className="w-8 h-8" style={{ color: ACCENT }} />
              <p className="text-2xl font-black text-white">🏆 {ranking[0]?.nome} venceu!</p>
              <p className="text-sm font-bold text-zinc-400 tabular-nums">{ranking[0]?.pontos} pontos</p>
            </div>

            <div className="flex flex-col gap-2">
              {ranking.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 border",
                    i === 0 ? "bg-white/[0.07] border-white/20" : "bg-[#121215] border-white/10"
                  )}
                >
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 bg-white/[0.06] text-zinc-300">
                    {i + 1}º
                  </span>
                  {i === 0 && <Trophy className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />}
                  <span className="flex-1 font-bold text-white truncate">{p.nome}</span>
                  <span className="font-black tabular-nums" style={{ color: i === 0 ? ACCENT : "#a1a1aa" }}>{p.pontos}</span>
                </div>
              ))}
            </div>

            <motion.button whileTap={{ scale: 0.98 }} onClick={jogarDeNovo} className="btn-cartoon btn-green w-full p-3 text-lg tracking-widest gap-2">
              <RotateCcw className="w-5 h-5" />
              JOGAR DE NOVO
            </motion.button>
            <div className="grid grid-cols-2 gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={trocarJogadores} className="btn-cartoon btn-white p-3 text-sm gap-2">
                <Users className="w-4 h-4" />
                TROCAR JOGADORES
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={sair} className="btn-cartoon p-3 text-sm gap-2 bg-white/[0.06] border-white/15 text-zinc-300">
                <ArrowLeft className="w-4 h-4" />
                SAIR
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlacarStrip({ players, highlightId }: { players: QSPlayer[]; highlightId?: string }) {
  const sorted = [...players].sort((a, b) => b.pontos - a.pontos);
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {sorted.map((p) => (
        <div
          key={p.id}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5",
            p.id === highlightId ? "border-white/25 bg-white/[0.07] text-white" : "border-white/10 bg-[#121215] text-zinc-400"
          )}
        >
          <span className="truncate max-w-[80px]">{p.nome}</span>
          <span className="tabular-nums" style={{ color: ACCENT }}>{p.pontos}</span>
        </div>
      ))}
    </div>
  );
}
