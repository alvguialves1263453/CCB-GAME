import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { X, Undo2, Redo2, Pencil, Eraser, Circle, Star, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

interface Point {
  x: number;
  y: number;
}

interface Path {
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

interface DrawingCanvasViewProps {
  prompt: string;
  timeLeft: number;
  onSubmit: (drawingData: string) => void;
  onTimeUp: () => void;
  isSubmitted: boolean;
  simple?: boolean;
}

const COLORS = [
  "#000000", "#FFFFFF", "#FF4757", "#FFD700",
  "#4ECB71", "#9B59F5", "#38bdf8", "#f97316",
  "#FF5A95", "#8B4513", "#00CED1", "#FF69B4"
];

export function DrawingCanvasView({ prompt, timeLeft, onSubmit, onTimeUp, isSubmitted, simple = false }: DrawingCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [opacity, setOpacity] = useState(1);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [history, setHistory] = useState<Path[]>([]);
  const [redoStack, setRedoStack] = useState<Path[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !isSubmitted) {
      onTimeUp();
    }
  }, [timeLeft, isSubmitted, onTimeUp]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (const path of paths) {
      if (path.points.length < 2) continue;
      
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = path.opacity;
      
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }, [paths]);

  useEffect(() => {
    redrawCanvas();
  }, [paths, redrawCanvas]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSubmitted) return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setIsDrawing(true);
    setCurrentPath([point]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setCurrentPath(prev => [...prev, point]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    if (currentPath.length > 1) {
      const newPath: Path = {
        points: currentPath,
        color: tool === "eraser" ? "#FFFFFF" : currentColor,
        width: tool === "eraser" ? brushSize * 3 : brushSize,
        opacity
      };
      
      setPaths(prev => [...prev, newPath]);
      setHistory(prev => [...prev, newPath]);
      setRedoStack([]);
    }
    
    setCurrentPath([]);
  };

  const undo = () => {
    if (paths.length === 0) return;
    
    const lastPath = paths[paths.length - 1];
    setPaths(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastPath]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    
    const pathToRedo = redoStack[redoStack.length - 1];
    setPaths(prev => [...prev, pathToRedo]);
    setRedoStack(prev => prev.slice(0, -1));
    redrawCanvas();
  };

  const clearCanvas = () => {
    setPaths([]);
    setHistory([]);
    setRedoStack([]);
    redrawCanvas();
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(JSON.stringify({ paths, imageData: dataUrl }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex-1 min-h-0 max-w-6xl flex flex-col gap-2 overflow-hidden relative"
    >
      <div className="flex items-center justify-between px-2 gap-2 h-10 shrink-0">
        <div className="bg-white border-4 border-[#1a0533] px-3 py-1 rounded-xl">
          <span className="text-xs font-black text-[#9B59F5]">Desenhe:</span>
        </div>
        <div className="bg-white border-4 border-[#1a0533] px-3 py-1 rounded-xl">
          <span className="text-lg font-black text-[#FF4757]">{timeLeft}s</span>
        </div>
      </div>

      <div className="cartoon-panel bg-[#9B59F5] p-2 mx-2 rounded-xl text-center">
        <p className="text-white font-black text-lg uppercase">{prompt}</p>
      </div>

      <div className="flex-1 relative mx-2 mb-2 border-4 border-[#1a0533] rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {isSubmitted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white border-4 border-[#1a0533] px-6 py-3 rounded-xl">
              <p className="font-black text-lg text-[#4ECB71]">ENVIADO!</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-2 pb-2 shrink-0">
        <div className="flex gap-1 flex-wrap max-w-[180px]">
          {COLORS.slice(0, 8).map(color => (
            <button
              key={color}
              onClick={() => { setCurrentColor(color); setTool("pencil"); }}
              className={cn(
                "w-5 h-5 rounded-full border-2 border-[#1a0533]",
                currentColor === color && tool === "pencil" && "ring-2 ring-offset-1 ring-[#FFD700]"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setTool("pencil")}
            className={cn(
              "p-1.5 rounded border-2 border-[#1a0533]",
              tool === "pencil" ? "bg-[#9B59F5] text-white" : "bg-white"
            )}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "p-1.5 rounded border-2 border-[#1a0533]",
              tool === "eraser" ? "bg-[#9B59F5] text-white" : "bg-white"
            )}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Circle className="w-3 h-3" />
          <input
            type="range"
            min={2}
            max={20}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-12"
          />
        </div>

        <div className="flex gap-1">
          <button onClick={undo} className="p-1.5 rounded border-2 border-[#1a0533] bg-white">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} className="p-1.5 rounded border-2 border-[#1a0533] bg-white">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={clearCanvas} className="p-1.5 rounded border-2 border-[#1a0533] bg-white">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {!isSubmitted && (
          <button
            onClick={handleSubmit}
            className="btn-cartoon btn-green px-3 py-1.5 text-sm"
          >
            ENVIAR
          </button>
        )}
      </div>
    </motion.div>
  );
}

interface VotingViewProps {
  submission: {
    id: number;
    playerNickname: string;
    drawingData: string;
  };
  timeLeft: number;
  currentVote: number;
  onVote: (stars: number) => void;
  hasVoted: boolean;
  onNext: () => void;
}

export function DrawingVotingView({ submission, timeLeft, currentVote, onVote, hasVoted, onNext }: VotingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (submission.drawingData && canvasRef.current) {
      try {
        const data = JSON.parse(submission.drawingData);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx && data.imageData) {
          const img = new Image();
          img.onload = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = data.imageData;
        }
      } catch {
        // Ignore
      }
    }
  }, [submission]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex-1 min-h-0 max-w-6xl flex flex-col items-center gap-4 p-4"
    >
      <div className="flex items-center gap-4">
        <span className="text-white font-black text-xl">Avalie este desenho</span>
        <div className="bg-white border-4 border-[#1a0533] px-3 py-1 rounded-xl">
          <span className="text-lg font-black text-[#FF4757]">{timeLeft}s</span>
        </div>
      </div>

      <div className="w-full aspect-square max-w-xs border-4 border-[#1a0533] rounded-xl bg-white overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => !hasVoted && onVote(star)}
            disabled={hasVoted}
            className={cn("p-1 transition-transform", currentVote >= star && "scale-110")}
          >
            <Star
              className={cn(
                "w-10 h-10",
                currentVote >= star ? "fill-[#FFD700] text-[#FFD700]" : "text-gray-300"
              )}
            />
          </button>
        ))}
      </div>

      {hasVoted && (
        <button onClick={onNext} className="btn-cartoon btn-purple px-8 py-3 text-lg">
          PRÓXIMO
        </button>
      )}
    </motion.div>
  );
}

interface RevealViewProps {
  submission: {
    id: number;
    playerNickname: string;
    drawingData: string;
  };
  showAuthor: boolean;
  onNext: () => void;
}

export function DrawingRevealView({ submission, showAuthor, onNext }: RevealViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timer = setTimeout(onNext, 3000);
    return () => clearTimeout(timer);
  }, [onNext]);

  useEffect(() => {
    if (submission.drawingData && canvasRef.current) {
      try {
        const data = JSON.parse(submission.drawingData);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (ctx && data.imageData) {
          const img = new Image();
          img.onload = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = data.imageData;
        }
      } catch {
        // Ignore
      }
    }
  }, [submission]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex-1 min-h-0 max-w-6xl flex flex-col items-center gap-4 p-4"
    >
      <div className="w-full aspect-square max-w-xs border-4 border-[#1a0533] rounded-xl bg-white overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={showAuthor ? { y: 0, opacity: 1 } : {}}
        className="bg-[#9B59F5] border-4 border-[#1a0533] px-6 py-2 rounded-xl"
      >
        <p className="text-white font-black text-xl">Feito por: {submission.playerNickname}</p>
      </motion.div>
    </motion.div>
  );
}

interface RankingPlayer {
  id: string;
  nickname: string;
  avatar?: string;
  totalScore: number;
}

interface RankingViewProps {
  players: RankingPlayer[];
  roundCount: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function DrawingRankingView({ players, roundCount, onPlayAgain, onExit }: RankingViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full flex-1 min-h-0 max-w-4xl flex flex-col items-center gap-4 p-4"
    >
      <h2 className="text-4xl font-black italic uppercase text-[#FFD700] cartoon-text-white">
        VITÓRIA!
      </h2>

      <p className="text-white font-black">{roundCount} rodadas completadas</p>

      <div className="w-full flex-1 overflow-y-auto space-y-2">
        {players.map((p, idx) => (
          <div
            key={p.id}
            className={cn(
              "p-3 border-4 border-[#1a0533] rounded-xl flex items-center justify-between",
              idx === 0 ? "bg-[#FFD700] shadow-[4px_4px_0px_#1a0533]" : "bg-white/90"
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#1a0533] font-black",
                idx === 0 ? "bg-white" : "bg-gray-100"
              )}>
                #{idx + 1}
              </div>
              <span className="font-black text-lg">{p.nickname}</span>
            </div>
            <div className="bg-[#9B59F5] text-white border-2 border-[#1a0533] px-3 py-0.5 rounded-lg font-black text-lg">
              {p.totalScore}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 w-full">
        <button onClick={onPlayAgain} className="btn-cartoon btn-purple flex-1 py-3 text-lg">
          JOGAR NOVAMENTE
        </button>
        <button onClick={onExit} className="btn-cartoon btn-white flex-1 py-3 text-lg">
          SAIR
        </button>
      </div>
    </motion.div>
  );
}