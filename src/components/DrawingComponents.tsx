// Drawing components - temporarily disabled
import React from "react";

interface DrawingCanvasViewProps {
  prompt: string;
  timeLeft: number;
  onSubmit: (drawingData: string) => void;
  onTimeUp: () => void;
  isSubmitted: boolean;
}

export function DrawingCanvasView(_props: DrawingCanvasViewProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Modo desenho temporariamente indisponível</p>
    </div>
  );
}