import React from "react";
import { motion } from "motion/react";
import { Music, Sparkles, Settings, Users, ChevronRight, Cloud } from "lucide-react";
import { Avatar } from "./Avatar";
import { ImageKitTestButton } from "./ImageKitTestButton";

interface HomeProps {
  profile: { nickname: string; avatarUrl: string };
  setProfile: (p: any) => void;
  setIsEditingProfile: (v: boolean) => void;
  isSolo: boolean;
  setIsSolo: (v: boolean) => void;
  setView: (v: string) => void;
  setRoomId: (v: string | null) => void;
  setShowSettings: (v: boolean) => void;
  setShowHelp: (v: boolean) => void;
  soundService: any;
  reducedMotion: boolean;
}

export const Home: React.FC<HomeProps> = ({
  profile, setProfile, setIsEditingProfile,
  isSolo, setIsSolo, setView, setRoomId,
  setShowSettings, setShowHelp, soundService, reducedMotion,
}) => {
  const handlePlay = () => { soundService.playClick(); setView("mode_selection"); };
  const handleGroup = () => { soundService.playClick(); setIsSolo(false); setView("multiplayer_menu"); };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative z-10 px-4">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-6 md:mb-9"
      >
        <p className="text-[#2D4A7A]/70 text-xs md:text-sm font-semibold tracking-[0.18em] uppercase mb-2">
          Congregação Cristã no Brasil
        </p>
        <h1 className="text-[40px] sm:text-[52px] md:text-[64px] font-black tracking-[-0.04em] leading-none text-[#1E293B]">
          CCB
        </h1>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#C9A86A]/60" />
          <span className="text-sm md:text-base font-semibold tracking-[0.2em] uppercase text-slate-500">
            Hinário Quiz
          </span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#C9A86A]/60" />
        </div>
        <p className="text-xs text-slate-500 mt-2.5">Desenvolvido por Guilherme Alves</p>
      </motion.div>

      {/* Player card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12, duration: 0.45 }}
        className="flex flex-col items-center mb-6 md:mb-8 shrink-0"
      >
        <div className="premium-card px-6 py-5 flex flex-col items-center min-w-[180px]">
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#2D4A7A] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-lg shadow-[#2D4A7A]/20">
            Player 1
          </div>
          <Avatar url={profile?.avatarUrl || "irmaos/1.png"} size={window.innerWidth < 768 ? 72 : 96} />
          <p className="font-bold text-slate-800 mt-3 text-base text-center max-w-[160px] truncate">
            {profile?.nickname || "Maestro"}
          </p>
          <button
            onClick={() => setIsEditingProfile(true)}
            className="mt-2.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
          >
            Alterar
          </button>
        </div>
      </motion.div>

      {/* Main actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.45 }}
        className="flex flex-col gap-3 w-full max-w-xs mx-auto"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePlay}
          className="btn-cartoon btn-purple w-full py-4 gap-2.5 text-[15px]"
        >
          <Music className="w-5 h-5" />
          <span>JOGAR</span>
          <ChevronRight className="w-4 h-4 opacity-70" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGroup}
          className="btn-cartoon btn-yellow w-full py-4 gap-2.5 text-[15px]"
        >
          <Users className="w-5 h-5" />
          <span>GRUPO</span>
        </motion.button>
      </motion.div>

      {/* Utility icons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex gap-3 mt-7 flex-wrap justify-center"
      >
        <button
          onClick={() => { soundService.playClick(); setView("hymn_list"); }}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#2D4A7A] transition-all shadow-sm"
        >
          <Music className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#2D4A7A] transition-all shadow-sm"
        >
          <Sparkles className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#2D4A7A] transition-all shadow-sm"
        >
          <Settings className="w-5 h-5" />
        </button>
        <ImageKitTestButton compact />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-4 w-full max-w-xs">
        <ImageKitTestButton />
      </motion.div>
    </div>
  );
};
