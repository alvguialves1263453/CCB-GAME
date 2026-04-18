import React, { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Edit2, Palette, Shirt, Music, Scissors, UserCircle2, X, Dices, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export interface AvatarConfig {
  skinColor: string;
  hairStyle: string;
  hairColor: string;
  clothing: string;
  clothingColor: string;
  gender: 'M' | 'F';
  instrument: string;
  seed: number;
}

const SKIN_COLORS = [
  "#FFDBAC", "#F1C27D", "#E0AC69", "#8D5524", "#C68642"
];

const HAIR_COLORS = [
  "#090806", "#2C1608", "#4E2708", "#B55239", "#A56B46", "#E6BE8A", "#D6C4C2"
];

const CLOTHING_COLORS = [
  "#FF4757", "#2F3542", "#1E90FF", "#2ED573", "#FFA502", "#747D8C", "#9B59F5"
];

const HAIR_STYLES = [
  "bald", "short", "spiky", "bob", "long", "curly"
];

const MALE_CLOTHING_STYLES = [
  "casual", "formal"
];

const FEMALE_CLOTHING_STYLES = [
  "casual", "formal", "dress"
];

const INSTRUMENTS = [
  "none", "violin", "trumpet", "saxophone", "organ", "flute"
];

const getColorName = (hex: string) => {
  const map: Record<string, string> = {
    "#FFDBAC": "light", "#F1C27D": "fair", "#E0AC69": "medium", "#8D5524": "dark", "#C68642": "tan",
    "#090806": "black", "#2C1608": "dark brown", "#4E2708": "brown", "#B55239": "red", "#A56B46": "light brown", "#E6BE8A": "blonde", "#D6C4C2": "grey",
    "#FF4757": "red", "#2F3542": "dark grey", "#1E90FF": "blue", "#2ED573": "green", "#FFA502": "orange", "#747D8C": "grey", "#9B59F5": "purple"
  };
  return map[hex] || "colorful";
}

export const generateAvatarUrl = (config: AvatarConfig) => {
  const genderStr = config.gender === 'M' ? 'male' : 'female';
  const skinStr = getColorName(config.skinColor);
  const hairStr = getColorName(config.hairColor);
  const clothingStr = getColorName(config.clothingColor);
  
  let prompt = `cartoon avatar, ${genderStr} character, ${skinStr} skin, ${config.hairStyle} ${hairStr} hair, ${clothingStr} ${config.clothing} outfit`;
  if (config.instrument !== 'none') {
    prompt += `, holding a ${config.instrument}`;
  }
  prompt += `, colorful, simple shapes, friendly character, flat design, clean outline, vibrant colors, big eyes, smiling, 2D game avatar, minimal shading, isolated, transparent background, character portrait, fun and playful style, NOT realistic`;
  
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=400&height=400&nologo=true&seed=${config.seed || 1}`;
};

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ config, size = 120, className }) => {
  const [loading, setLoading] = useState(true);
  const imageUrl = useMemo(() => generateAvatarUrl(config), [config]);

  useEffect(() => {
    setLoading(true);
  }, [imageUrl]);

  return (
    <div 
      className={cn("relative flex items-center justify-center bg-[#F8F8F8] rounded-full border-4 border-[#1a0533] overflow-hidden shadow-[4px_4px_0px_#1a0533] transition-all", className)}
      style={{ width: size, height: size }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F8F8F8] z-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#9B59F5]" />
        </div>
      )}
      <img 
        src={imageUrl} 
        alt="Avatar" 
        className={cn("w-full h-full object-cover transition-opacity duration-300", loading ? "opacity-0" : "opacity-100")}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
    </div>
  );
};

interface ProfileCreatorProps {
  onSave: (nickname: string, config: AvatarConfig) => void;
  initialNickname?: string;
  initialConfig?: AvatarConfig;
  onCancel?: () => void;
}

export const ProfileCreator: React.FC<ProfileCreatorProps> = ({ onSave, initialNickname = "", initialConfig, onCancel }) => {
  const [nickname, setNickname] = useState(initialNickname);
  const [config, setConfig] = useState<AvatarConfig>(initialConfig || {
    skinColor: SKIN_COLORS[0],
    hairStyle: HAIR_STYLES[1],
    hairColor: HAIR_COLORS[0],
    clothing: MALE_CLOTHING_STYLES[0],
    clothingColor: CLOTHING_COLORS[2],
    gender: 'M',
    instrument: 'none',
    seed: Math.floor(Math.random() * 100000)
  });

  const [activeTab, setActiveTab] = useState<'skin' | 'hair' | 'clothing' | 'instrument'>('skin');

  const handleRandomize = () => {
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const clothingStyles = gender === 'M' ? MALE_CLOTHING_STYLES : FEMALE_CLOTHING_STYLES;
    
    setConfig({
      skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
      hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      clothing: clothingStyles[Math.floor(Math.random() * clothingStyles.length)],
      clothingColor: CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)],
      gender: gender as 'M' | 'F',
      instrument: INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)],
      seed: Math.floor(Math.random() * 100000)
    });
  };

  const forceRegenerate = () => {
    setConfig({ ...config, seed: Math.floor(Math.random() * 100000) });
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white border-[6px] md:border-8 border-[#1a0533] p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[10px_10px_0px_#1a0533] max-w-xl w-full mx-auto relative max-h-[95vh] overflow-y-auto no-scrollbar flex flex-col"
    >
      {onCancel && (
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-[#F0F0F0] hover:bg-[#E0E0E0] rounded-full flex items-center justify-center border-4 border-[#1a0533] transition-transform hover:scale-110 z-50"
        >
          <X className="w-5 h-5 md:w-6 md:h-6 text-[#1a0533]" />
        </button>
      )}

      <div className="flex flex-col items-center gap-6 mb-8 mt-2 md:mt-4">
        <div className="relative">
          <Avatar config={config} size={140} />
          
          <button 
            onClick={forceRegenerate}
            className="absolute -bottom-1 -right-1 bg-[#9B59F5] hover:bg-[#8A4BE2] transition-colors p-2.5 rounded-full border-[3px] border-[#1a0533] text-white shadow-[2px_2px_0px_#1a0533] flex items-center justify-center"
            title="Regerar esta imagem"
          >
            <Dices className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={handleRandomize}
          className="flex items-center gap-2 bg-[#F0F0F0] text-[#1a0533] px-4 py-2 rounded-xl border-[3px] border-[#1a0533] font-black uppercase text-xs hover:bg-[#E0E0E0] transition-colors shadow-[2px_2px_0px_#1a0533] active:translate-y-1 active:shadow-none"
        >
          <Dices className="w-4 h-4" />
          Gerar Aleatório
        </button>

        <div className="w-full">
          <label className="block text-center text-sm font-black text-[#1a0533]/40 uppercase tracking-widest mb-2">Nickname</label>
          <div className="relative">
            <input 
              type="text" 
              maxLength={15}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Como quer ser chamado?"
              className="w-full bg-[#F0F0F0] border-4 border-[#1a0533] p-4 rounded-2xl text-xl font-black text-[#1a0533] focus:outline-none focus:ring-4 focus:ring-[#9B59F5]/20 placeholder:text-black/20 text-center"
            />
            <UserCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#1a0533]/20" />
          </div>
        </div>
      </div>

      <div className="bg-[#F0F0F0] border-4 border-[#1a0533] rounded-3xl overflow-hidden mb-4 md:mb-8 shrink-0 w-full">
        <div className="flex border-b-4 border-[#1a0533] bg-white">
          {[
            { id: 'skin', icon: Palette, label: 'Pele' },
            { id: 'hair', icon: Scissors, label: 'Cabelo' },
            { id: 'clothing', icon: Shirt, label: 'Roupa' },
            { id: 'instrument', icon: Music, label: 'Inst.' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 p-3 flex flex-col items-center gap-1 transition-colors",
                activeTab === tab.id ? "bg-[#9B59F5] text-white" : "text-[#1a0533] hover:bg-black/5"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 md:p-5 min-h-[180px] max-h-[220px] overflow-y-auto w-full flex flex-col justify-center">
          {activeTab === 'skin' && (
            <div className="flex flex-wrap gap-3 justify-center">
              {SKIN_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setConfig({ ...config, skinColor: color })}
                  className={cn(
                    "w-10 h-10 rounded-full border-4 transition-transform",
                    config.skinColor === color ? "border-[#9B59F5] scale-110" : "border-[#1a0533]"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}

          {activeTab === 'hair' && (
            <div className="space-y-5 w-full">
              <div className="flex flex-wrap gap-2 justify-center">
                {HAIR_STYLES.map(style => (
                  <button
                    key={style}
                    onClick={() => setConfig({ ...config, hairStyle: style })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border-[3px] font-black uppercase text-[10px]",
                      config.hairStyle === style ? "bg-[#9B59F5] text-white border-[#1a0533]" : "bg-white text-[#1a0533] border-[#1a0533]"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {HAIR_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, hairColor: color })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2",
                      config.hairColor === color ? "border-[#9B59F5] scale-110 shadow-lg" : "border-[#1a0533]"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'clothing' && (
            <div className="space-y-4 w-full">
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setConfig({ ...config, gender: 'M', clothing: MALE_CLOTHING_STYLES[0] })}
                  className={cn("px-4 py-2 rounded-xl border-[3px] font-black uppercase text-[10px]", config.gender === 'M' ? "bg-[#9B59F5] text-white border-[#1a0533]" : "bg-white text-[#1a0533] border-[#1a0533]")}
                >Masculino</button>
                <button
                  onClick={() => setConfig({ ...config, gender: 'F', clothing: FEMALE_CLOTHING_STYLES[0] })}
                  className={cn("px-4 py-2 rounded-xl border-[3px] font-black uppercase text-[10px]", config.gender === 'F' ? "bg-[#9B59F5] text-white border-[#1a0533]" : "bg-white text-[#1a0533] border-[#1a0533]")}
                >Feminino</button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {(config.gender === 'M' ? MALE_CLOTHING_STYLES : FEMALE_CLOTHING_STYLES).map(style => (
                  <button
                    key={style}
                    onClick={() => setConfig({ ...config, clothing: style })}
                    className={cn("px-3 py-1.5 rounded-lg border-[3px] font-black uppercase text-[10px]", config.clothing === style ? "bg-[#9B59F5] text-white border-[#1a0533]" : "bg-white text-[#1a0533] border-[#1a0533]")}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 justify-center pt-2">
                {CLOTHING_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setConfig({ ...config, clothingColor: color })}
                    className={cn("w-8 h-8 rounded-full border-4", config.clothingColor === color ? "border-[#9B59F5] scale-110" : "border-[#1a0533]")}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'instrument' && (
            <div className="flex flex-wrap gap-2 justify-center">
              {INSTRUMENTS.map(inst => (
                <button
                  key={inst}
                  onClick={() => setConfig({ ...config, instrument: inst })}
                  className={cn(
                    "px-4 py-2 rounded-xl border-[3px] font-black uppercase text-[10px]",
                    config.instrument === inst ? "bg-[#9B59F5] text-white border-[#1a0533]" : "bg-white text-[#1a0533] border-[#1a0533]"
                  )}
                >
                  {inst}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {onCancel && (
          <button 
            onClick={onCancel}
            className="flex-1 btn-cartoon bg-white text-[#1a0533] py-3 text-lg"
          >
            Sair
          </button>
        )}
        <button 
          onClick={() => onSave(nickname, config)}
          disabled={!nickname.trim()}
          className="flex-[2] btn-cartoon bg-[#4ECB71] text-white py-4 text-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-[6px_6px_0px_#1a0533] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
        >
          <Check className="w-7 h-7" />
          <span>Salvar Perfil</span>
        </button>
      </div>
    </motion.div>
  );
};
