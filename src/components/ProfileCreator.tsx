import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Edit2, X, UserRound, Grid, ArrowLeft, Image as ImageIcon, Camera, ZoomIn, ZoomOut, RotateCcw, FlipHorizontal, Loader2, CloudUpload } from "lucide-react";
import { cn } from "../lib/utils";
import { imageKitService } from "../services/imageKitService";

const LOCAL_BASE = "/ccb/";
const AVATAR_BASE_URL = LOCAL_BASE;

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
  const isDataUrl = url.startsWith("data:");
  const isHttp = url.startsWith("http");
  const fullUrl = isDataUrl || isHttp ? url : (url.includes('/') ? `${AVATAR_BASE_URL}${url}` : `${AVATAR_BASE_URL}${url}`);
  // WebP gerado lado a lado (q92): navegador usa WebP (~93% menor), PNG fica de fallback.
  const webpUrl = !isDataUrl && !isHttp && fullUrl.endsWith('.png') ? fullUrl.slice(0, -4) + '.webp' : null;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center bg-slate-100 rounded-2xl border-2 border-slate-200 overflow-hidden transition-all duration-200",
        selected && "border-indigo-500 ring-4 ring-indigo-500/20 scale-105 shadow-lg shadow-indigo-500/20",
        !selected && "shadow-md shadow-slate-900/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {webpUrl ? (
        <picture className="w-full h-full contents">
          <source srcSet={webpUrl} type="image/webp" />
          <img
            src={fullUrl}
            alt="Avatar"
            width={size}
            height={size}
            className="w-full h-full object-cover scale-[1.1]"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${url}`;
            }}
          />
        </picture>
      ) : (
        <img
          src={fullUrl}
          alt="Avatar"
          width={size}
          height={size}
          className="w-full h-full object-cover scale-[1.1]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${url}`;
          }}
        />
      )}
    </div>
  );
};

interface ProfileCreatorProps {
  onSave: (nickname: string, avatarUrl: string, fileId?: string) => void;
  initialNickname?: string;
  initialAvatarUrl?: string;
  onCancel?: () => void;
}

export const ProfileCreator: React.FC<ProfileCreatorProps> = ({ onSave, initialNickname = "", initialAvatarUrl, onCancel }) => {
  const [nickname, setNickname] = useState(initialNickname);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarUrl || IRMAOS_LIST[0]);
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>(() => {
    try { const p = JSON.parse(localStorage.getItem("ccb_quiz_profile")||"{}"); return p.avatarFileId; } catch { return undefined }
  });
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"m" | "f" | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Foto custom
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const currentAvatarList = selectedGender === "m" ? IRMAOS_LIST : selectedGender === "f" ? IRMAS_LIST : [...LEGACY_AVATAR_LIST];

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Selecione uma imagem válida");
    if (file.size > 8 * 1024 * 1024) return alert("Imagem muito grande (máx 8MB)");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setOriginalSrc(dataUrl);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setIsFlipped(false);
        setShowPhotoOptions(false);
        setShowCropper(true);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const CONTAINER = 280;
  const OUTPUT = 512;

  // Base que cobre o container quadrado (cover) - SEM zoom ainda
  const getBaseScalePreview = () => {
    if (!naturalSize) return 1;
    return Math.max(CONTAINER / naturalSize.w, CONTAINER / naturalSize.h);
  };
  const getBaseScaleOutput = () => {
    if (!naturalSize) return 1;
    return Math.max(OUTPUT / naturalSize.w, OUTPUT / naturalSize.h);
  };
  // Tamanho base (cover) sem zoom
  const getBaseSizePreview = () => {
    if (!naturalSize) return { w: CONTAINER, h: CONTAINER };
    const s = getBaseScalePreview();
    return { w: naturalSize.w * s, h: naturalSize.h * s };
  };
  // Máximo que pode arrastar sem deixar borda vazia (considerando zoom via transform scale)
  const getMaxOffset = () => {
    if (!naturalSize) return { x: 0, y: 0 };
    const base = getBaseSizePreview();
    const scaledW = base.w * zoom;
    const scaledH = base.h * zoom;
    return {
      x: Math.max(0, (scaledW - CONTAINER) / 2),
      y: Math.max(0, (scaledH - CONTAINER) / 2),
    };
  };

  const clampOffset = (x: number, y: number) => {
    const max = getMaxOffset();
    return {
      x: Math.max(-max.x, Math.min(max.x, x)),
      y: Math.max(-max.y, Math.min(max.y, y)),
    };
  };

  // Pinch-zoom para mobile (dois dedos)
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const getTouchDist = (touches: React.TouchList | TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = getTouchDist(e.touches);
      pinchRef.current = { startDist: d, startZoom: zoom };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = getTouchDist(e.touches);
      const scale = d / pinchRef.current.startDist;
      const newZoom = Math.max(1, Math.min(3, pinchRef.current.startZoom * scale));
      setZoom(newZoom);
      // re-clamp offset
      setTimeout(() => setOffset(o => clampOffset(o.x, o.y)), 0);
    }
  };
  const handleTouchEnd = () => {
    if (pinchRef.current) {
      pinchRef.current = null;
      setTimeout(() => setOffset(o => clampOffset(o.x, o.y)), 0);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // ignora se for pinch (2 dedos já é touch)
    if (pinchRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart.current || pinchRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const next = clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy);
    setOffset(next);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  const handleZoomChange = (v: number) => {
    setZoom(v);
    // re-clamp offset after zoom
    setTimeout(() => setOffset(o => clampOffset(o.x, o.y)), 0);
  };

  const handleCropConfirm = async () => {
    if (!originalSrc || !naturalSize) return;
    setIsUploading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = originalSrc!;
      });
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
      const baseOutput = getBaseScaleOutput();
      const imgWOut = naturalSize.w * baseOutput * zoom;
      const imgHOut = naturalSize.h * baseOutput * zoom;
      const ratio = OUTPUT / CONTAINER;
      const xOut = OUTPUT / 2 - imgWOut / 2 + offset.x * ratio;
      const yOut = OUTPUT / 2 - imgHOut / 2 + offset.y * ratio;
      if (isFlipped) {
        ctx.save();
        ctx.translate(OUTPUT, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, OUTPUT - xOut - imgWOut, yOut, imgWOut, imgHOut);
        ctx.restore();
      } else {
        ctx.drawImage(img, xOut, yOut, imgWOut, imgHOut);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      try {
        const { url, fileId } = await imageKitService.uploadAvatar(dataUrl, `avatar_${Date.now()}.jpg`);
        setSelectedAvatar(url);
        setSelectedFileId(fileId);
      } catch (uploadErr: any) {
        console.warn("ImageKit falhou, usando dataURL local:", uploadErr);
        setSelectedAvatar(dataUrl);
        setSelectedFileId(undefined);
      }
      setShowCropper(false);
      setOriginalSrc(null);
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (e: any) {
      alert("Erro ao processar imagem: " + (e.message || String(e)));
    } finally {
      setIsUploading(false);
    }
  };

  // Tamanho base (sem zoom) para render - zoom via CSS transform scale, não via width
  const baseSizePreview = getBaseSizePreview();
  const imgWPreview = baseSizePreview.w;
  const imgHPreview = baseSizePreview.h;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0, y: 12 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl shadow-slate-900/30 max-w-xl md:max-w-3xl w-full mx-auto relative max-h-[92vh] flex flex-col border border-slate-200/60"
    >
      <div className="flex items-center justify-center gap-2 mb-4 mt-1">
        <UserRound className="w-5 h-5 text-indigo-500" />
        <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
          Editar jogador
        </h2>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors z-50 text-slate-500"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="flex flex-col items-center gap-4 mb-5 mt-1 overflow-y-auto no-scrollbar pb-1 p-1">
        {/* Avatar preview */}
        <div className="relative group">
          <Avatar url={selectedAvatar} size={160} />
          <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/30">
            <Edit2 className="w-4 h-4" />
          </div>
        </div>

        {/* 2 botões principais */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-3 mt-1">
          <button
            onClick={() => setIsSelectorOpen(true)}
            className="py-3.5 px-3 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 flex flex-col items-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
          >
            <Grid className="w-8 h-8 text-blue-500" strokeWidth={2.2} />
            <span className="text-xs font-black uppercase tracking-widest text-slate-800">Ver avatares</span>
            <span className="text-[10px] font-semibold text-slate-500">55 opções</span>
          </button>

          <button
            onClick={() => setShowPhotoOptions(true)}
            className="py-3.5 px-3 rounded-2xl bg-white border-2 border-violet-200 hover:border-violet-300 hover:bg-violet-50 flex flex-col items-center gap-1.5 transition-all active:scale-[0.98] shadow-sm"
          >
            <Camera className="w-8 h-8 text-violet-600" strokeWidth={2.2} />
            <span className="text-xs font-black uppercase tracking-widest text-slate-800">Adicionar foto</span>
            <span className="text-[10px] font-semibold text-slate-500">Galeria ou câmera</span>
          </button>
        </div>

        {/* inputs ocultos */}
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />

        <div className="w-full max-w-sm">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 text-center">
            Nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={16}
            placeholder="Seu nickname..."
            className="input-cartoon text-center text-base placeholder:normal-case"
          />
        </div>
      </div>

      <div className="flex gap-3 p-1">
        <button
          onClick={() => onSave(nickname.trim() || "Jogador", selectedAvatar, selectedFileId)}
          className="flex-1 btn-cartoon btn-green py-4 text-base flex items-center justify-center gap-2.5"
        >
          <Check className="w-5 h-5" />
          CONCLUIR
        </button>
      </div>

      {/* Action sheet: Galeria ou Câmera */}
      <AnimatePresence>
        {showPhotoOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-end p-4"
            onClick={() => setShowPhotoOptions(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full bg-white rounded-3xl border-2 border-slate-200 shadow-2xl p-4 flex flex-col gap-3"
            >
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto" />
              <h3 className="text-center font-black uppercase tracking-widest text-sm text-slate-800">Adicionar foto</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => galleryRef.current?.click()}
                  className="py-5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 flex flex-col items-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <ImageIcon className="w-8 h-8 text-indigo-600" />
                  <span className="text-xs font-black uppercase text-indigo-700">Galeria</span>
                  <span className="text-[10px] font-semibold text-indigo-500">Escolher arquivo</span>
                </button>
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="py-5 rounded-2xl bg-violet-600 hover:bg-violet-700 border-2 border-violet-600 flex flex-col items-center gap-2 transition-colors active:scale-[0.98] shadow-md"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                    <Camera className="w-7 h-7 text-violet-600" strokeWidth={2.5} />
                  </div>
                  <span className="text-xs font-black uppercase text-white">Câmera</span>
                  <span className="text-[10px] font-semibold text-white/80">Tirar foto</span>
                </button>
              </div>
              <button
                onClick={() => setShowPhotoOptions(false)}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cropper modal */}
      <AnimatePresence>
        {showCropper && originalSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center"
            onClick={() => setShowCropper(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-5 md:p-6 flex flex-col w-full max-w-md shadow-2xl border border-slate-200 gap-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-base font-black uppercase tracking-widest text-slate-800">Ajustar foto</h3>
                <button onClick={() => setShowCropper(false)} className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center">
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <p className="text-xs font-semibold text-slate-500 text-center -mt-1">Arraste para posicionar • Pinça ou slider para zoom</p>

              <p className="text-[11px] font-bold text-violet-600 text-center -mt-2 md:hidden">📱 Pinça com 2 dedos para zoom • Arraste com 1 dedo</p>
              {/* Preview quadrado - zoom NORMAL via scale, sem espelhar por padrão */}
              <div
                className="mx-auto relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 select-none touch-none"
                style={{ width: CONTAINER, height: CONTAINER, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={() => setIsDragging(false)}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={originalSrc}
                  alt="preview"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: imgWPreview,
                    height: imgHPreview,
                    // ZOOM normal uniforme + flip opcional (sem espelhar por padrão)
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom}) ${isFlipped ? 'scaleX(-1)' : ''}`,
                    transformOrigin: 'center center',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  } as React.CSSProperties}
                />
                {/* overlay grade 3x3 */}
                <div className="absolute inset-0 pointer-events-none border border-white/20">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                </div>
                {/* máscara cantos */}
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-black/5" />
              </div>

              {/* Controles zoom + espelhar */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-2xl px-3 py-3 border border-slate-200">
                <button
                  onClick={() => handleZoomChange(Math.max(1, zoom - 0.2))}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 shadow-sm shrink-0"
                >
                  <ZoomOut className="w-4 h-4 text-slate-700" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={e => handleZoomChange(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-500 min-w-0"
                />
                <button
                  onClick={() => handleZoomChange(Math.min(3, zoom + 0.2))}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 shadow-sm shrink-0"
                >
                  <ZoomIn className="w-4 h-4 text-slate-700" />
                </button>
                <div className="w-px h-6 bg-slate-200 shrink-0" />
                <button
                  onClick={() => setIsFlipped(v => !v)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center active:scale-95 shadow-sm shrink-0 transition-colors ${isFlipped ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                  title={isFlipped ? "Desespelhar" : "Espelhar"}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); setIsFlipped(false); }}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 shadow-sm shrink-0"
                  title="Resetar"
                >
                  <RotateCcw className="w-4 h-4 text-slate-700" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowCropper(false)}
                  disabled={isUploading}
                  className="py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-xs tracking-widest transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={isUploading}
                  className="py-3.5 rounded-xl bg-[#23395B] hover:bg-[#2A446E] text-white font-black uppercase text-xs tracking-widest shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                  {isUploading ? "Enviando..." : "Usar foto"}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center font-medium">A imagem será salva com qualidade e recorte quadrado</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seletor de avatares */}
      <AnimatePresence>
        {isSelectorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center"
            onClick={() => { setIsSelectorOpen(false); setSelectedGender(null); }}
            style={{ touchAction: 'none' }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-5 md:p-6 flex flex-col w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] shadow-2xl shadow-slate-900/40 border border-slate-200/60"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedGender === null ? "Escolha o gênero" : selectedGender === "m" ? "Irmãos" : "Irmãs"}
                </h2>
                <button
                  onClick={() => {
                    setIsSelectorOpen(false);
                    setSelectedGender(null);
                  }}
                  className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {selectedGender === null ? (
                <div className="flex-1 flex flex-col gap-4 justify-center">
                  <button
                    onClick={() => setSelectedGender("m")}
                    style={{ touchAction: 'manipulation' }}
                    className="flex-1 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-between px-6 md:px-8 py-6 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-blue-800"
                  >
                    <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Irmão</span>
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Grid className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedGender("f")}
                    style={{ touchAction: 'manipulation' }}
                    className="flex-1 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-between px-6 md:px-8 py-6 transition-all active:scale-[0.98] shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:from-pink-600 hover:to-rose-600"
                  >
                    <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Irmã</span>
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                      <Grid className="w-10 h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <button
                    onClick={() => setSelectedGender(null)}
                    className="mb-4 text-indigo-500 font-semibold text-sm flex items-center gap-1.5 hover:text-indigo-600 transition-colors self-start"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para gênero
                  </button>
                  <div
                    className="flex-1 overflow-y-auto overscroll-contain pr-1 grid grid-cols-3 sm:grid-cols-4 gap-3 md:gap-4 pb-6 custom-scrollbar"
                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                  >
                    {currentAvatarList.map((url) => (
                      <button
                        key={url}
                        onClick={() => {
                          setSelectedAvatar(url);
                          setSelectedFileId(undefined);
                          if (navigator.vibrate) navigator.vibrate(20);
                          setTimeout(() => setIsSelectorOpen(false), 80);
                        }}
                        onTouchEnd={(e) => { e.preventDefault(); setSelectedAvatar(url); setSelectedFileId(undefined); if (navigator.vibrate) navigator.vibrate(20); setTimeout(() => setIsSelectorOpen(false), 80); }}
                        className="flex items-center justify-center p-1 transition-transform active:scale-95"
                        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Avatar url={url} size={isMobile ? 84 : 110} selected={selectedAvatar === url} className="rounded-2xl shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
