import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect } from 'react-konva';
import Konva from 'konva';

// ─── Types ───────────────────────────────────────────────────────────
export interface DrawingLine {
  tool: 'pen' | 'eraser';
  color: string;
  strokeWidth: number;
  points: number[];
}

interface DrawingCanvasViewProps {
  isDrawer: boolean;
  onDraw: (line: DrawingLine) => void;
  onClear: () => void;
  externalLines: DrawingLine[];
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'eraser';
}

// ─── Virtual canvas size (shared coordinate space for all players) ───
const VIRTUAL_WIDTH = 800;
const VIRTUAL_HEIGHT = 600;

// ─── Component ───────────────────────────────────────────────────────
export function DrawingCanvasView({
  isDrawer,
  onDraw,
  onClear,
  externalLines,
  color,
  strokeWidth,
  tool,
}: DrawingCanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingRef = useRef(false);

  // Local lines drawn by THIS user in this session
  const [localLines, setLocalLines] = useState<DrawingLine[]>([]);
  // Currently being drawn line
  const [currentLine, setCurrentLine] = useState<DrawingLine | null>(null);

  // Responsive stage dimensions
  const [stageSize, setStageSize] = useState({ width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT });
  const [scale, setScale] = useState(1);

  // ─── Resize observer ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      // Fit the virtual canvas into the container keeping aspect ratio
      const scaleX = width / VIRTUAL_WIDTH;
      const scaleY = height / VIRTUAL_HEIGHT;
      const newScale = Math.min(scaleX, scaleY);

      setStageSize({
        width: VIRTUAL_WIDTH * newScale,
        height: VIRTUAL_HEIGHT * newScale,
      });
      setScale(newScale);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Clear handler (called by parent) ───────────────────────────
  // When externalLines becomes empty, reset local lines too
  useEffect(() => {
    if (externalLines.length === 0) {
      setLocalLines([]);
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
      x: pointer.x / scale,
      y: pointer.y / scale,
    };
  }, [scale]);

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
    setCurrentLine(newLine);
  }, [isDrawer, tool, color, strokeWidth, getVirtualPos]);

  const handlePointerMove = useCallback(() => {
    if (!isDrawingRef.current || !isDrawer) return;

    const pos = getVirtualPos();
    if (!pos || !currentLine) return;

    const updatedLine: DrawingLine = {
      ...currentLine,
      points: [...currentLine.points, pos.x, pos.y],
    };
    setCurrentLine(updatedLine);
  }, [isDrawer, currentLine, getVirtualPos]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current || !currentLine) {
      isDrawingRef.current = false;
      return;
    }
    isDrawingRef.current = false;

    // Only emit if line has at least 2 points (4 values = x,y x,y)
    if (currentLine.points.length >= 2) {
      setLocalLines(prev => [...prev, currentLine]);
      onDraw(currentLine);
    }
    setCurrentLine(null);
  }, [currentLine, onDraw]);

  // ─── All lines to render (external from others + local from me) ─
  const allLines = [...externalLines, ...localLines];

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={scale}
        scaleY={scale}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          cursor: isDrawer ? 'crosshair' : 'default',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <Layer>
          {/* White background */}
          <Rect x={0} y={0} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} fill="#ffffff" />

          {/* Completed lines */}
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

          {/* Line currently being drawn */}
          {currentLine && (
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
}