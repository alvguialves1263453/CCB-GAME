import React from "react";
import { motion } from "motion/react";
import { Music, BookOpen, Pencil, ArrowLeft, Play } from "lucide-react";

interface ModeSelectionProps {
  isSolo: boolean;
  roomId: string | null;
  soundService: any;
  setView: (v: string) => void;
  setIsSolo: (v: boolean) => void;
  setRoomId: (v: string | null) => void;
  setBibliaGameMode: (v: boolean) => void;
  setDrawingGameMode: (v: boolean) => void;
}

const ModeCard = ({
  onClick, disabled, icon, title, desc, gradient, badge, delay,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
  badge: string;
  delay: number;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    whileHover={disabled ? {} : { y: -3 }}
    whileTap={disabled ? {} : { scale: 0.985 }}
    onClick={onClick}
    disabled={disabled}
    className={`w-full rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center gap-4 text-left transition-all duration-200 ${
      disabled
        ? "bg-slate-100 border border-slate-200 opacity-50 cursor-not-allowed"
        : "bg-white border border-slate-200 hover:border-[#2D4A7A]/20 hover:bg-slate-50 cursor-pointer shadow-sm hover:shadow-md"
    }`}
  >
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${gradient} shadow-lg`}>
      {icon}
    </div>
    <div className="flex-1 text-center md:text-left">
      <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="text-slate-500 text-sm mt-0.5">{desc}</p>
    </div>
    <span
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors ${
        disabled
          ? "bg-slate-100 text-slate-400"
          : "bg-[#2D4A7A] text-white hover:bg-[#34548E]"
      }`}
    >
      {!disabled && <Play className="w-3.5 h-3.5 fill-current" />}
      {badge}
    </span>
  </motion.button>
);

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  isSolo, roomId, soundService, setView, setIsSolo, setRoomId,
  setBibliaGameMode, setDrawingGameMode,
}) => {
  const back = () => { soundService.playClick(); setView(isSolo ? "home" : "multiplayer_menu"); };

  return (
    <div className="flex flex-col w-full h-full relative z-10">
      <div className="flex items-center justify-between shrink-0 px-4 md:px-6 py-3">
        <button
          onClick={back}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#2D4A7A] transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight">Modo de Jogo</h2>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 md:px-6 pb-4 space-y-3">
        <ModeCard
          delay={0.05}
          onClick={() => { soundService.playClick(); setRoomId(null); setBibliaGameMode(false); setView("multiplayer_setup"); }}
          icon={<Music className="w-6 h-6 text-white" />}
          title="Qual é o Hino?"
          desc="Ouça o trecho e adivinhe o hino"
          gradient="from-indigo-500 to-violet-500"
          badge="JOGAR"
        />

        <ModeCard
          delay={0.12}
          onClick={() => { soundService.playClick(); setRoomId(null); setBibliaGameMode(true); setView("multiplayer_setup"); }}
          icon={<BookOpen className="w-6 h-6 text-white" />}
          title="Quiz da Bíblia"
          desc="Teste seus conhecimentos bíblicos"
          gradient="from-amber-500 to-orange-500"
          badge="JOGAR"
        />

        <ModeCard
          delay={0.19}
          disabled={isSolo}
          onClick={() => { soundService.playClick(); setRoomId(null); setBibliaGameMode(false); setDrawingGameMode(true); setView("drawing_setup"); }}
          icon={<Pencil className="w-6 h-6 text-white" />}
          title="Desenhe a Palavra"
          desc={isSolo ? "Disponível apenas em grupo" : "Desenhe e adivinhe a palavra"}
          gradient="from-pink-500 to-rose-500"
          badge={isSolo ? "GRUPO" : "JOGAR"}
        />
      </div>
    </div>
  );
};
