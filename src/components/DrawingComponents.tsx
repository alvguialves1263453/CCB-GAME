import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Rect, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';

// ─── Types ───────────────────────────────────────────────────────────
export interface DrawingLine {
  tool: 'pen' | 'eraser' | 'bucket';
  color: string;
  strokeWidth: number;
  points: number[];
}

// Exposed API to parent (DrawingGame) via ref
export interface DrawingCanvasRef {
  /** Undo last committed line. Returns updated lines array, or null if nothing to undo. */
  undo: () => DrawingLine[] | null;
  /** Redo last undone line. Returns updated lines array, or null if nothing to redo. */
  redo: () => DrawingLine[] | null;
  /** Whether there is anything to undo */
  canUndo: () => boolean;
  /** Whether there is anything to redo */
  canRedo: () => boolean;
}

interface DrawingCanvasViewProps {
  isDrawer: boolean;
  onDraw: (line: DrawingLine) => void;
  /** Fires on every pointer move (throttled ~50fps) with the in-progress line */
  onDrawMove?: (line: DrawingLine) => void;
  onClear: () => void;
  externalLines: DrawingLine[];
  /** The in-progress line from the remote drawer, rendered in real-time */
  activeExternalLine?: DrawingLine | null;
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser' | 'bucket';
}

// ─── Virtual canvas size (shared coordinate space for all players) ───
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 600;

// Throttle interval in ms (~50fps)
const MOVE_THROTTLE_MS = 20;


// ─── Flood Fill Utility ─────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

function colorsMatch(c1: [number, number, number, number], c2: [number, number, number, number] | [number, number, number], threshold = 10): boolean {
  return Math.abs(c1[0] - c2[0]) < threshold &&
         Math.abs(c1[1] - c2[1]) < threshold &&
         Math.abs(c1[2] - c2[2]) < threshold;
}

function floodFill(canvas: HTMLCanvasElement, x: number, y: number, color: string) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const targetIdx = (y * width + x) * 4;
  const targetColor: [number, number, number, number] = [
    data[targetIdx],
    data[targetIdx + 1],
    data[targetIdx + 2],
    data[targetIdx + 3]
  ];
  const fillColor = hexToRgb(color);

  if (colorsMatch(targetColor, [...fillColor, 255] as [number, number, number, number])) return;

  const stack: [number, number][] = [[x, y]];
  const visited = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
    
    const idx = cy * width + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pIdx = idx * 4;
    const currentColor: [number, number, number, number] = [data[pIdx], data[pIdx + 1], data[pIdx + 2], data[pIdx + 3]];
    
    if (colorsMatch(currentColor, targetColor)) {
      data[pIdx] = fillColor[0];
      data[pIdx + 1] = fillColor[1];
      data[pIdx + 2] = fillColor[2];
      data[pIdx + 3] = 255;

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Component ───────────────────────────────────────────────────────
export const DrawingCanvasView = forwardRef<DrawingCanvasRef, DrawingCanvasViewProps>(
  function DrawingCanvasView(
    {
      isDrawer,
      onDraw,
      onDrawMove,
      onClear,
      externalLines,
      activeExternalLine,
      color,
      strokeWidth,
      tool,
    },
    ref
  ) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const isDrawingRef = useRef(false);
  const lastMoveBroadcastRef = useRef<number>(0);

  // Committed lines drawn by THIS user (local)
  const [localLines, setLocalLines] = useState<DrawingLine[]>([]);
  const localLinesRef = useRef<DrawingLine[]>([]);
  // Redo stack — lines that were undone and can be redone
  const redoStackRef = useRef<DrawingLine[]>([]);
  // In-progress line (local preview)
  const currentLineRef = useRef<DrawingLine | null>(null);
  const [currentLine, setCurrentLine] = useState<DrawingLine | null>(null);

  // We'll use a permanent canvas for all drawings (to make bucket tool work)
  const [mainCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }
    return canvas;
  });
  const [canvasUpdateToggle, setCanvasUpdateToggle] = useState(0);

  // Stage dimensions = fill the container completely
  const [stageSize, setStageSize] = useState({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT });
  // Independent x/y scales so the stage always fills 100% of the container
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const scaleXRef = useRef(1);
  const scaleYRef = useRef(1);

  // ─── Redraw logic ────────────────────────────────────────────────
  const redrawToCanvas = useCallback((lines: DrawingLine[]) => {
    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    lines.forEach(line => {
      if (line.tool === 'bucket') {
        floodFill(mainCanvas, Math.floor(line.points[0]), Math.floor(line.points[1]), line.color);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = line.tool === 'eraser' ? '#ffffff' : line.color;
        ctx.lineWidth = line.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
        
        const pts = line.points;
        if (pts.length >= 2) {
          ctx.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) {
            ctx.lineTo(pts[i], pts[i + 1]);
          }
        }
        ctx.stroke();
      }
    });
    setCanvasUpdateToggle(prev => prev + 1);
  }, [mainCanvas]);


  // ─── Sync lines ──────────────────────────────────────────────────
  useEffect(() => {
    localLinesRef.current = localLines;
    redrawToCanvas([...externalLines, ...localLines]);
  }, [localLines, externalLines, redrawToCanvas]);

  // ─── Expose undo/redo/canUndo/canRedo via ref ────────────────────
  useImperativeHandle(ref, () => ({
    undo: () => {
      const lines = localLinesRef.current;
      if (lines.length === 0) return null;
      const popped = lines[lines.length - 1];
      const newLines = lines.slice(0, -1);
      redoStackRef.current = [popped, ...redoStackRef.current];
      setLocalLines(newLines);
      return newLines;
    },
    redo: () => {
      const stack = redoStackRef.current;
      if (stack.length === 0) return null;
      const line = stack[0];
      redoStackRef.current = stack.slice(1);
      const newLines = [...localLinesRef.current, line];
      setLocalLines(newLines);
      return newLines;
    },
    canUndo: () => localLinesRef.current.length > 0,
    canRedo: () => redoStackRef.current.length > 0,
  }));

  // ─── Resize observer — fills the container entirely ─────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (!w || !h) return;

      const sx = w / VIRTUAL_WIDTH;
      const sy = h / VIRTUAL_HEIGHT;

      setStageSize({ width: w, height: h });
      setScaleX(sx);
      setScaleY(sy);
      scaleXRef.current = sx;
      scaleYRef.current = sy;
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Clear handler ───────────────────────────────────────────────
  useEffect(() => {
    if (externalLines.length === 0) {
      setLocalLines([]);
      redoStackRef.current = [];
      currentLineRef.current = null;
      setCurrentLine(null);
      
      const ctx = mainCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
      setCanvasUpdateToggle(prev => prev + 1);
    }
  }, [externalLines, mainCanvas]);


  // ─── Get pointer position in virtual coordinates ────────────────
  const getVirtualPos = useCallback((): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return {
      x: pointer.x / scaleXRef.current,
      y: pointer.y / scaleYRef.current,
    };
  }, []);

  // ─── Drawing handlers ──────────────────────────────────────────
  const handlePointerDown = useCallback(() => {
    if (!isDrawer) return;

    const pos = getVirtualPos();
    if (!pos) return;

    if (tool === 'bucket') {
      const newLine: DrawingLine = {
        tool: 'bucket',
        color,
        strokeWidth: 0,
        points: [pos.x, pos.y],
      };
      const newLines = [...localLinesRef.current, newLine];
      setLocalLines(newLines);
      onDraw(newLine);
      return;
    }

    isDrawingRef.current = true;
    const newLine: DrawingLine = {
      tool,
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
      points: [pos.x, pos.y],
    };
    currentLineRef.current = newLine;
    setCurrentLine(newLine);

    onDrawMove?.(newLine);
    lastMoveBroadcastRef.current = Date.now();
  }, [isDrawer, tool, color, strokeWidth, getVirtualPos, onDraw, onDrawMove]);

  const handlePointerMove = useCallback(() => {
    if (!isDrawingRef.current || !isDrawer) return;

    const pos = getVirtualPos();
    const line = currentLineRef.current;
    if (!pos || !line) return;

    const updatedLine: DrawingLine = {
      ...line,
      points: [...line.points, pos.x, pos.y],
    };
    currentLineRef.current = updatedLine;
    setCurrentLine(updatedLine);

    const now = Date.now();
    if (onDrawMove && now - lastMoveBroadcastRef.current >= MOVE_THROTTLE_MS) {
      lastMoveBroadcastRef.current = now;
      onDrawMove(updatedLine);
    }
  }, [isDrawer, getVirtualPos, onDrawMove]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) {
      isDrawingRef.current = false;
      return;
    }
    isDrawingRef.current = false;

    const line = currentLineRef.current;
    if (!line) return;

    if (line.points.length >= 4) {
      const newLines = [...localLinesRef.current, line];
      setLocalLines(newLines);
      redoStackRef.current = [];
      onDraw(line);
    }
    currentLineRef.current = null;
    setCurrentLine(null);
  }, [onDraw]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scaleX}
        scaleY={scaleY}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchCancel={handlePointerUp}
        style={{ cursor: isDrawer ? 'crosshair' : 'default', display: 'block' }}
      >
        <Layer ref={layerRef}>
          {/* White background Rect to ensure it's never black */}
          <Rect x={0} y={0} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} fill="#ffffff" />

          {/* We render the mainCanvas as a background image */}
          <KonvaImage
             image={mainCanvas}
             width={VIRTUAL_WIDTH}
             height={VIRTUAL_HEIGHT}
             listening={false}
             key={`canvas-${canvasUpdateToggle}`}
          />



          {/* Local drawer's in-progress line — instant preview */}
          {currentLine && currentLine.points.length >= 2 && (
            <Line
              points={currentLine.points}
              stroke={currentLine.tool === 'eraser' ? '#ffffff' : currentLine.color}
              strokeWidth={currentLine.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}


          {/* Remote drawer's in-progress line — real-time stream */}
          {activeExternalLine && activeExternalLine.points.length >= 2 && activeExternalLine.tool !== 'bucket' && (
            <Line
              points={activeExternalLine.points}
              stroke={activeExternalLine.tool === 'eraser' ? '#ffffff' : activeExternalLine.color}
              strokeWidth={activeExternalLine.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )}

        </Layer>
      </Stage>
    </div>
  );
});