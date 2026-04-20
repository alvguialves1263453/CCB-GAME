import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Pencil, Eraser, Undo2, Trash2 } from "lucide-react";
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

const COLORS = ["#000000", "#FF4757", "#FFD700", "#4ECB71", "#9B59F5", "#38bdf8", "#f97316", "#FF69B4"];

export function DrawingCanvasView({ prompt, timeLeft, onSubmit, onTimeUp, isSubmitted }: DrawingCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");

  // Use ResizeObserver to properly handle canvas sizing
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      if (width > 0 && height > 0) {
        // Save current content
        const ctx = canvas.getContext("2d");
        const imageData = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
        
        // Resize canvas
        canvas.width = width;
        canvas.height = height;
        
        // Restore content
        if (imageData) {
          ctx?.putImageData(imageData, 0, 0);
        } else {
          // Fill white background
          const newCtx = canvas.getContext("2d");
          if (newCtx) {
            newCtx.fillStyle = "#FFFFFF";
            newCtx.fillRect(0, 0, width, height);
          }
        }
        
        // Redraw all paths
        redrawAll();
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    
    // Initial resize with delay to ensure container has size
    setTimeout(resize, 100);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !isSubmitted) {
      onTimeUp();
    }
  }, [timeLeft, isSubmitted, onTimeUp]);

  const redrawAll = useCallback(() => {
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
  }, [paths]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSubmitted) return;
    e.preventDefault();
    e.stopPropagation();
    
    const point = getPoint(e);
    if (point) {
      setIsDrawing(true);
      setCurrentPos(point);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted || !currentPos) return;
    e.preventDefault();
    e.stopPropagation();
    
    const point = getPoint(e);
    if (point) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.beginPath();
      ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
      ctx.lineWidth = tool === "eraser" ? brushSize * 2 : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(currentPos.x, currentPos.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      
      setCurrentPos(point);
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPos) {
      const newPath: Path = {
        points: [currentPos],
        color: tool === "eraser" ? "#FFFFFF" : color,
        width: tool === "eraser" ? brushSize * 2 : brushSize
      };
      setPaths(prev => [...prev, newPath]);
    }
    setCurrentPos(null);
  };

  const undo = () => {
    if (paths.length === 0) return;
    setPaths(prev => prev.slice(0, -1));
  };

  const clear = () => {
    setPaths([]);
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
      <div ref={containerRef} className="flex-1 relative bg-white border-4 border-[#1a0533] m-2 rounded-xl overflow-hidden shadow-[4px_4px_0px_#1a0533]">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair absolute inset-0"
          style={{ touchAction: 'none', display: 'block' }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        
        {isSubmitted && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-white border-4 border-[#1a0533] px-8 py-4 rounded-2xl">
              <p className="text-2xl font-black text-[#4ECB71]">ENVIADO!</p>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white border-4 border-[#1a0533] mx-2 mb-2 rounded-xl p-3 flex flex-col gap-2">
        {/* Cores */}
        <div className="flex items-center justify-center gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool("pencil"); }}
              className={cn(
                "w-8 h-8 rounded-full border-3 border-[#1a0533]",
                color === c && tool === "pencil" && "ring-4 ring-[#FFD700]"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Ferramentas */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setTool("pencil")}
            className={cn(
              "p-2 rounded-lg border-2 border-[#1a0533]",
              tool === "pencil" ? "bg-[#9B59F5] text-white" : "bg-gray-100"
            )}
          >
            <Pencil className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setTool("eraser")}
            className={cn(
              "p-2 rounded-lg border-2 border-[#1a0533]",
              tool === "eraser" ? "bg-[#9B59F5] text-white" : "bg-gray-100"
            )}
          >
            <Eraser className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300" />

          <button onClick={undo} disabled={paths.length === 0} className="p-2 rounded-lg border-2 border-[#1a0533] bg-gray-100 disabled:opacity-30">
            <Undo2 className="w-5 h-5" />
          </button>
          <button onClick={clear} className="p-2 rounded-lg border-2 border-[#1a0533] bg-gray-100">
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="w-px h-8 bg-gray-300" />

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
            "w-full py-3 rounded-lg border-4 border-[#1a0533] font-black text-lg tracking-widest",
            isSubmitted 
              ? "bg-gray-400 text-gray-200" 
              : "bg-[#4ECB71] text-white shadow-[3px_3px_0px_#1a0533]"
          )}
        >
          {isSubmitted ? "ENVIADO!" : "ENVIAR"}
        </button>
      </div>
    </div>
  );
}