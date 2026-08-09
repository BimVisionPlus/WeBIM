import { useEffect, useRef } from "react";
import { GridViewport } from "../viewport/GridViewport";

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewport = new GridViewport(canvas);
    return () => viewport.dispose();
  }, []);

  return <canvas ref={canvasRef} className="viewport-canvas" />;
}
