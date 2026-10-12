"use client";

import {useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent} from "react";

type Point = {x: number; y: number};
type Props = {
  strokes: Point[][];
  color: string;
  onChange: (strokes: Point[][]) => void;
  onSizeChange?: (size: {width: number; height: number}) => void;
};

export function StudioSignaturePad({strokes, color, onChange, onSizeChange}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const colorRef = useRef(color);
  const activeRef = useRef<{id: number; rect: DOMRect; points: Point[]} | null>(null);
  const sizeRef = useRef({width: 0, height: 0});
  const onSizeChangeRef = useRef(onSizeChange);
  onSizeChangeRef.current = onSizeChange;

  function paint(points: Point[]) {
    const context = canvasRef.current?.getContext("2d");
    if (!context || points.length < 2) return;
    const {width, height} = sizeRef.current;
    context.strokeStyle = colorRef.current;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(points[0].x * width, points[0].y * height);
    for (let index = 1; index < points.length; index++) {
      context.lineTo(points[index].x * width, points[index].y * height);
    }
    context.stroke();
  }

  function redraw() {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    strokesRef.current.forEach(paint);
    if (activeRef.current) paint(activeRef.current.points);
  }

  useLayoutEffect(() => {
    strokesRef.current = strokes;
    colorRef.current = color;
    redraw();
  }, [strokes, color]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const {width, height} = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      sizeRef.current = {width, height};
      onSizeChangeRef.current?.({width, height});
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function append(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || event.pointerId !== active.id) return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    // Paint only the new segment; React receives the completed stroke on release.
    const segment = [active.points[active.points.length - 1]];
    for (const sample of samples.length ? samples : [event.nativeEvent]) {
      const point = {
        x: Math.max(0, Math.min(1, (sample.clientX - active.rect.left) / active.rect.width)),
        y: Math.max(0, Math.min(1, (sample.clientY - active.rect.top) / active.rect.height))
      };
      const last = active.points[active.points.length - 1];
      if (point.x === last.x && point.y === last.y) continue;
      active.points.push(point);
      segment.push(point);
    }
    paint(segment);
  }

  function finish(event: ReactPointerEvent<HTMLCanvasElement>) {
    const active = activeRef.current;
    if (!active || event.pointerId !== active.id) return;
    if (event.type === "pointerup") append(event);
    activeRef.current = null;
    if (active.points.length > 1) {
      const next = [...strokesRef.current, active.points];
      strokesRef.current = next;
      onChange(next);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return <div className="studio-signature-pad">
    <canvas ref={canvasRef} aria-label="Zone de dessin de signature"
      onPointerDown={(event) => {
        if (activeRef.current || event.button !== 0) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        activeRef.current = {id: event.pointerId, rect, points: [{
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height
        }]};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={append} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    />
  </div>;
}
