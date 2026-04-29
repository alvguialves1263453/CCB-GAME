import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Edit2, X, UserCircle2, Grid } from "lucide-react";
import { cn } from "../lib/utils";

// Configuração de Avatares (Cloudinary ou Local)
// Se suas imagens estão na REDE (Cloudinary):
const CLOUDINARY_BASE = "https://res.cloudinary.com/dhhims97u/image/upload/";

// Se suas imagens estão no COMPUTADOR (pasta public/ccb):
const LOCAL_BASE = "/ccb/";

// ESCOLHA AQUI: Mude para CLOUDINARY_BASE ou LOCAL_BASE
const AVATAR_BASE_URL = LOCAL_BASE; 

// Lista de 24 avatares (1.png até 24.png)
const AVATAR_LIST = Array.from({ length: 24 }, (_, i) => `${i + 1}.png`);

interface AvatarProps {
  url: string;
  size?: number;
  className?: string;
  selected?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ url, size = 120, className, selected }) => {
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
        src={`${AVATAR_BASE_URL}${url}`} 
        alt="Avatar" 
        className="w-full h-full object-cover"
        loading="lazy"
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
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarUrl || AVATAR_LIST[0]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white border-[6px] md:border-8 border-[#1a0533] p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[12px_12px_0px_#1a0533] max-w-xl w-full mx-auto relative max-h-[90vh] flex flex-col"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-white rounded-[3rem] p-4 flex flex-col"
          >
            <div className="flex justify-between items-center mb-4 px-2">
              <h2 className="text-xl font-black text-[#1a0533] uppercase">Escolha seu Avatar</h2>
              <button 
                onClick={() => setIsSelectorOpen(false)}
                className="w-10 h-10 bg-[#F0F0F0] rounded-xl flex items-center justify-center border-4 border-[#1a0533]"
              >
                <X className="w-6 h-6 text-[#1a0533]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 no-scrollbar pb-4 ml-1">
              {AVATAR_LIST.map((url) => (
                <button
                  key={url}
                  onClick={() => {
                    setSelectedAvatar(url);
                    setIsSelectorOpen(false);
                  }}
                  className="flex items-center justify-center transition-transform hover:scale-105 active:scale-95 p-1"
                >
                  <Avatar url={url} size={84} selected={selectedAvatar === url} className="rounded-2xl" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
