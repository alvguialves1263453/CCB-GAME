import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Pencil, Eraser, Undo2, Redo2, Trash2, Send } from "lucide-react";
import { cn } from "../lib/utils";

interface Point { x: number; y: number; }

interface Path {
  points: Point[];
  color: string;
  width: number;
}

interface DrawingCanvasViewProps {
  prompt: string;
  timeLeft: number;
  onSubmit: (drawingData: string) => void;
  onTimeUp: () => void;
  isSubmitted: boolean;
}

const COLORS = [
  "#000000", "#FF4757", "#FFD700", "#4ECB71", 
  "#9B59F5", "#38bdf8", "#f97316", "#FF69B4"
];

export function DrawingCanvasView({ prompt, timeLeft, onSubmit, onTimeUp, isSubmitted }: DrawingCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [history, setHistory] = useState<Path[]>([]);
  const [redoStack, setRedoStack] = useState<Path[]>([]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawAll();
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Time up
  useEffect(() => {
    if (timeLeft <= 0 && !isSubmitted) {
      onTimeUp();
    }
  }, [timeLeft, isSubmitted, onTimeUp]);

  const redrawAll = () => {
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
      
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    redrawAll();
  }, [paths]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return null;
    }
    
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSubmitted) return;
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getPos(e);
    if (pos) {
      setIsDrawing(true);
      setCurrentPath([pos]);
    }
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getPos(e);
    if (pos) {
      setCurrentPath(prev => [...prev, pos]);
      
      // Draw immediately
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || currentPath.length < 1) return;
      
      ctx.beginPath();
      ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : currentColor;
      ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const prevPos = currentPath[currentPath.length - 1];
      ctx.moveTo(prevPos.x, prevPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentPath.length > 1) {
      const newPath: Path = {
        points: currentPath,
        color: tool === "eraser" ? "#FFFFFF" : currentColor,
        width: tool === "eraser" ? brushSize * 2 : brushSize
      };
      setPaths(prev => [...prev, newPath]);
      setHistory(prev => [...prev, newPath]);
      setRedoStack([]);
    }
    setCurrentPath([]);
  };

  const undo = () => {
    if (paths.length === 0) return;
    const last = paths[paths.length - 1];
    setPaths(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, last]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setPaths(prev => [...prev, next]);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const clear = () => {
    setPaths([]);
    setHistory([]);
    setRedoStack([]);
    redrawAll();
  };

  const submit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(JSON.stringify({ paths, imageData: dataUrl }));
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Canvas */}
      <div className="flex-1 relative bg-white border-4 border-[#1a0533] m-2 rounded-xl overflow-hidden shadow-[4px_4px_0px_#1a0533]">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
        
        {isSubmitted && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-white border-4 border-[#1a0533] px-8 py-4 rounded-2xl shadow-[4px_4px_0px_#1a0533]">
              <p className="text-2xl font-black text-[#4ECB71]">ENVIADO!</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar - Clean Style */}
      <div className="bg-white border-4 border-[#1a0533] mx-2 mb-2 rounded-xl p-3 flex flex-col gap-2 shadow-[4px_4px_0px_#1a0533]">
        {/* Cores */}
        <div className="flex items-center justify-center gap-2">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => { setCurrentColor(color); setTool("pencil"); }}
              className={cn(
                "w-8 h-8 rounded-full border-3 border-[#1a0533] transition-transform hover:scale-110",
                currentColor === color && tool === "pencil" && "ring-4 ring-[#FFD700] ring-offset-2"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Ferramentas */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setTool("pencil")}
            className={cn(
              "p-2 rounded-lg border-2 border-[#1a0533] font-bold text-sm",
              tool === "pencil" ? "bg-[#9B59F5] text-white" : "bg-gray-100 text-[#1a0533]"
            )}
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "p-2 rounded-lg border-2 border-[#1a0533] font-bold text-sm",
              tool === "eraser" ? "bg-[#9B59F5] text-white" : "bg-gray-100 text-[#1a0533]"
            )}
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300" />

          <button onClick={undo} disabled={paths.length === 0} className="p-2 rounded-lg border-2 border-[#1a0533] bg-gray-100 disabled:opacity-30">
            <Undo2 className="w-5 h-5" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="p-2 rounded-lg border-2 border-[#1a0533] bg-gray-100 disabled:opacity-30">
            <Redo2 className="w-5 h-5" />
          </button>
          <button onClick={clear} className="p-2 rounded-lg border-2 border-[#1a0533] bg-gray-100">
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300" />

          {/* Tamanho */}
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-lg border-2 border-[#1a0533]">
            <div className="rounded-full bg-[#1a0533]" style={{ width: brushSize, height: brushSize }} />
            <input
              type="range"
              min={2}
              max={30}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16 accent-[#9B59F5]"
            />
          </div>
        </div>

        {/* Enviar */}
        <button
          onClick={submit}
          disabled={isSubmitted}
          className={cn(
            "w-full py-3 rounded-lg border-4 border-[#1a0533] font-black text-lg tracking-widest shadow-[3px_3px_0px_#1a0533] transition-transform",
            isSubmitted 
              ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
              : "bg-[#4ECB71] text-white hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#1a0533]"
          )}
        >
          {isSubmitted ? "ENVIADO!" : "✓ ENVIAR DESENHO"}
        </button>
      </div>
    </div>
  );
}