import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import Konva from 'konva';

// ─── Types ───────────────────────────────────────────────────────────
export interface DrawingLine {
  tool: 'pen' | 'eraser';
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
  tool: 'pen' | 'eraser';
}

// ─── Virtual canvas size (shared coordinate space for all players) ───
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 600;

// Throttle interval in ms (~50fps)
const MOVE_THROTTLE_MS = 20;

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

  // Stage dimensions = fill the container completely
  const [stageSize, setStageSize] = useState({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT });
  // Independent x/y scales so the stage always fills 100% of the container
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const scaleXRef = useRef(1);
  const scaleYRef = useRef(1);

  // ─── Keep localLinesRef in sync ──────────────────────────────────
  useEffect(() => {
    localLinesRef.current = localLines;
  }, [localLines]);

  // ─── Expose undo/redo/canUndo/canRedo via ref ────────────────────
  useImperativeHandle(ref, () => ({
    undo: () => {
      const lines = localLinesRef.current;
      if (lines.length === 0) return null;
      const popped = lines[lines.length - 1];
      const newLines = lines.slice(0, -1);
      redoStackRef.current = [popped, ...redoStackRef.current];
      setLocalLines(newLines);
      localLinesRef.current = newLines;
      return newLines;
    },
    redo: () => {
      const stack = redoStackRef.current;
      if (stack.length === 0) return null;
      const line = stack[0];
      redoStackRef.current = stack.slice(1);
      const newLines = [...localLinesRef.current, line];
      setLocalLines(newLines);
      localLinesRef.current = newLines;
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
      localLinesRef.current = [];
      redoStackRef.current = [];
      currentLineRef.current = null;
      setCurrentLine(null);
    }
  }, [externalLines]);

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
    isDrawingRef.current = true;

    const pos = getVirtualPos();
    if (!pos) return;

    const newLine: DrawingLine = {
      tool,
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth,
      points: [pos.x, pos.y],
    };
    currentLineRef.current = newLine;
    setCurrentLine(newLine);

    // Broadcast start immediately
    onDrawMove?.(newLine);
    lastMoveBroadcastRef.current = Date.now();
  }, [isDrawer, tool, color, strokeWidth, getVirtualPos, onDrawMove]);

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

    // Throttled real-time broadcast
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
      localLinesRef.current = newLines;
      redoStackRef.current = []; // New stroke clears redo history
      onDraw(line);
    }
    currentLineRef.current = null;
    setCurrentLine(null);
  }, [onDraw]);

  // ─── All committed lines ─────────────────────────────────────────
  const allLines = [...externalLines, ...localLines];

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
        <Layer>
          {/* White background fills the full virtual canvas */}
          <Rect x={0} y={0} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} fill="#ffffff" />

          {/* Committed lines (from all players) */}
          {allLines.map((line, i) => (
            <Line
              key={`line-${i}`}
              points={line.points}
              stroke={line.color}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                line.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          ))}

          {/* Remote drawer's in-progress line — real-time stream */}
          {activeExternalLine && activeExternalLine.points.length >= 2 && (
            <Line
              points={activeExternalLine.points}
              stroke={activeExternalLine.color}
              strokeWidth={activeExternalLine.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                activeExternalLine.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          )}

          {/* Local drawer's in-progress line — instant preview */}
          {currentLine && currentLine.points.length >= 2 && (
            <Line
              points={currentLine.points}
              stroke={currentLine.color}
              strokeWidth={currentLine.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                currentLine.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
});