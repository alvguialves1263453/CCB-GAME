import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Edit2, X, UserCircle2, Grid } from "lucide-react";
import { cn } from "../lib/utils";

// Configuração de Avatares (Cloudinary ou Local)
// Se suas imagens estão na REDE (Cloudinary):
const CLOUDINARY_BASE = "https://res.cloudinary.com/dhhims97u/image/upload/";

// Configuração de Avatares (Cloudinary ou Local)
const LOCAL_BASE = "/ccb/";
const AVATAR_BASE_URL = LOCAL_BASE; 

// Gerar listas dinâmicas
const IRMAOS_LIST = Array.from({ length: 40 }, (_, i) => `irmaos/${i + 1}.png`);
const IRMAS_LIST = Array.from({ length: 15 }, (_, i) => `irmas/irma_${i + 1}.png`);
const LEGACY_AVATAR_LIST = Array.from({ length: 24 }, (_, i) => `${i + 1}.png`);

interface AvatarProps {
  url: string;
  size?: number;
  className?: string;
  selected?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ url, size = 120, className, selected }) => {
  // Se a URL já contiver o caminho da pasta, não adicionamos base duplicada
  const fullUrl = url.includes('/') ? `${AVATAR_BASE_URL}${url}` : `${AVATAR_BASE_URL}${url}`;
  
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center bg-[#E5E5E5] rounded-[2rem] border-4 border-[#1a0533] overflow-hidden transition-all duration-300 shadow-[4px_4px_0px_#1a0533]",
        selected && "border-[#9B59F5] shadow-[0_0_20px_rgba(155,89,245,0.4)] scale-105",
        className
      )}
      style={{ width: size, height: size }}
    >
      <img 
        src={fullUrl} 
        alt="Avatar" 
        className="w-full h-full object-cover scale-[1.1]"
        loading="lazy"
        onError={(e) => {
          // Fallback if image fails
          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${url}`;
        }}
      />
    </div>
  );
};

interface ProfileCreatorProps {
  onSave: (nickname: string, avatarUrl: string) => void;
  initialNickname?: string;
  initialAvatarUrl?: string;
  onCancel?: () => void;
}

export const ProfileCreator: React.FC<ProfileCreatorProps> = ({ onSave, initialNickname = "", initialAvatarUrl, onCancel }) => {
  const [nickname, setNickname] = useState(initialNickname);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarUrl || IRMAOS_LIST[0]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"m" | "f" | null>(null);

  // Determinar qual lista mostrar
  const currentAvatarList = selectedGender === "m" ? IRMAOS_LIST : selectedGender === "f" ? IRMAS_LIST : [...LEGACY_AVATAR_LIST];

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white border-[6px] md:border-8 border-[#1a0533] p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-[12px_12px_0px_#1a0533] max-w-xl md:max-w-4xl w-full mx-auto relative max-h-[92vh] flex flex-col"
    >
      {onCancel && (
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-[#F0F0F0] hover:bg-[#E0E0E0] rounded-full flex items-center justify-center border-4 border-[#1a0533] transition-transform hover:scale-110 z-50 text-[#1a0533]"
        >
          <X className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      )}

      <div className="flex flex-col items-center gap-6 mb-8 mt-2 md:mt-4 overflow-y-auto no-scrollbar pb-4 p-1">
        {/* BIG AVATAR DISPLAY (Clicável agora) */}
        <button 
          onClick={() => setIsSelectorOpen(true)}
          className="relative group cursor-pointer hover:scale-105 transition-transform active:scale-95"
        >
          <Avatar url={selectedAvatar} size={200} />
          
          <div className="absolute -bottom-2 -right-2 bg-[#FFD700] p-4 rounded-2xl border-4 border-[#1a0533] text-[#1a0533] shadow-[4px_4px_0px_#1a0533]">
            <Edit2 className="w-6 h-6 stroke-[3px]" />
          </div>
        </button>
      </div>

      <div className="flex gap-4 p-1">
        <button 
          onClick={() => onSave(nickname, selectedAvatar)}
          className="flex-1 btn-cartoon bg-[#4ECB71] text-white py-5 rounded-[2rem] text-2xl font-black flex items-center justify-center gap-3 shadow-[8px_8px_0px_#1a0533] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          <Check className="w-8 h-8 stroke-[4px]" />
          CONCLUIR
        </button>
      </div>

      {/* AVATAR SELECTOR MODAL (OVERLAY) */}
      <AnimatePresence>
        {isSelectorOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 z-[100] bg-white rounded-[3rem] p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-[#1a0533] uppercase italic">
                {selectedGender === null ? "Escolha o Gênero" : selectedGender === "m" ? "Irmãos" : "Irmãs"}
              </h2>
              <button 
                onClick={() => {
                  setIsSelectorOpen(false);
                  setSelectedGender(null);
                }}
                className="w-12 h-12 bg-[#F0F0F0] rounded-2xl flex items-center justify-center border-4 border-[#1a0533]"
              >
                <X className="w-8 h-8 text-[#1a0533]" />
              </button>
            </div>

            {selectedGender === null ? (
              /* SELEÇÃO DE GÊNERO */
              <div className="flex-1 flex flex-col gap-4 justify-center">
                <button
                  onClick={() => setSelectedGender("m")}
                  className="flex-1 bg-[#4EA8CB] border-4 border-[#1a0533] rounded-[2rem] flex items-center justify-between px-8 transition-transform hover:scale-[1.02] active:scale-95 shadow-[6px_6px_0px_#1a0533]"
                >
                  <span className="text-3xl font-black text-white italic uppercase cartoon-text">IRMÃO</span>
                  <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                     <Grid className="w-12 h-12 text-white" />
                  </div>
                </button>
                <button
                  onClick={() => setSelectedGender("f")}
                  className="flex-1 bg-[#F59EBA] border-4 border-[#1a0533] rounded-[2rem] flex items-center justify-between px-8 transition-transform hover:scale-[1.02] active:scale-95 shadow-[6px_6px_0px_#1a0533]"
                >
                  <span className="text-3xl font-black text-white italic uppercase cartoon-text">IRMÃ</span>
                  <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                     <Grid className="w-12 h-12 text-white" />
                  </div>
                </button>
              </div>
            ) : (
              /* LISTA DE FOTOS */
              <div className="flex-1 flex flex-col min-h-0">
                <button 
                  onClick={() => setSelectedGender(null)}
                  className="mb-4 text-[#9B59F5] font-black uppercase text-sm flex items-center gap-2"
                >
                  ← Voltar para Gênero
                </button>
                <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-4 pb-6 custom-scrollbar">
                  {currentAvatarList.map((url) => (
                    <button
                      key={url}
                      onClick={() => {
                        setSelectedAvatar(url);
                        setIsSelectorOpen(false);
                      }}
                      className="flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                    >
                      <Avatar url={url} size={window.innerWidth < 768 ? 90 : 160} selected={selectedAvatar === url} className="rounded-[2.5rem] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
