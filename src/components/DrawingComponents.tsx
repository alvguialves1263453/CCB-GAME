import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Pencil, Eraser, Undo2, Redo2, Trash2, Send } from "lucide-react";
import { cn } from "../lib/utils";

interface Point { x: number; y: number; }

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
}

const COLORS = [
  "#000000", "#FF4757", "#FFD700", "#4ECB71", 
  "#9B59F5", "#38bdf8", "#f97316", "#FF69B4"
];

export function DrawingCanvasView({ prompt, timeLeft, onSubmit, onTimeUp, isSubmitted }: DrawingCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [paths, setPaths] = useState<Path[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [history, setHistory] = useState<Path[]>([]);
  const [redoStack, setRedoStack] = useState<Path[]>([]);

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const updateSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Time up handler
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
    e.preventDefault();
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setIsDrawing(true);
    setCurrentPath([point]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    e.preventDefault();
    
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
        width: tool === "eraser" ? brushSize * 2 : brushSize,
        opacity: 1
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

  // Render current path while drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || currentPath.length < 2) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : currentColor;
    ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    ctx.moveTo(currentPath[0].x, currentPath[0].y);
    for (let i = 1; i < currentPath.length; i++) {
      ctx.lineTo(currentPath[i].x, currentPath[i].y);
    }
    ctx.stroke();
  }, [currentPath, currentColor, brushSize, tool]);

  return (
    <div className="w-full h-full flex flex-col bg-[#F5F5F5]">
      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 bg-white m-2 rounded-lg overflow-hidden shadow-inner"
        style={{ touchAction: 'none' }}
      >
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
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-white px-8 py-4 rounded-2xl">
              <p className="text-2xl font-black text-[#4ECB71]">ENVIADO!</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar - Gartic Phone Style */}
      <div className="bg-[#2C2C2C] px-2 py-3 flex flex-col gap-2">
        {/* Colors Row */}
        <div className="flex items-center justify-center gap-1.5">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => { setCurrentColor(color); setTool("pencil"); }}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                currentColor === color && tool === "pencil" 
                  ? "border-white ring-2 ring-[#FFD700] ring-offset-2 ring-offset-[#2C2C2C]" 
                  : "border-gray-500"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Tools Row */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setTool("pencil")}
            className={cn(
              "p-2 rounded-lg transition-transform hover:scale-110",
              tool === "pencil" ? "bg-[#FFD700] text-black" : "bg-[#444] text-white"
            )}
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "p-2 rounded-lg transition-transform hover:scale-110",
              tool === "eraser" ? "bg-[#FFD700] text-black" : "bg-[#444] text-white"
            )}
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-600 mx-1" />

          <button
            onClick={undo}
            disabled={paths.length === 0}
            className="p-2 rounded-lg bg-[#444] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-transform hover:scale-110"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-lg bg-[#444] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-transform hover:scale-110"
          >
            <Redo2 className="w-5 h-5" />
          </button>
          
          <button
            onClick={clearCanvas}
            className="p-2 rounded-lg bg-[#444] text-white transition-transform hover:scale-110"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-600 mx-1" />

          {/* Brush Size */}
          <div className="flex items-center gap-1 bg-[#444] px-2 py-1 rounded-lg">
            <div 
              className="rounded-full bg-white"
              style={{ width: brushSize, height: brushSize }}
            />
            <input
              type="range"
              min={3}
              max={25}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-16 accent-[#FFD700]"
            />
          </div>
        </div>

        {/* Send Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isSubmitted}
          className={cn(
            "w-full py-3 rounded-xl font-black text-lg tracking-widest flex items-center justify-center gap-2",
            isSubmitted 
              ? "bg-gray-500 text-gray-300 cursor-not-allowed" 
              : "bg-[#4ECB71] text-white hover:bg-[#3db960]"
          )}
        >
          <Send className="w-5 h-5" />
          {isSubmitted ? "ENVIADO!" : "ENVIAR DESENHO"}
        </motion.button>
      </div>
    </div>
  );
}