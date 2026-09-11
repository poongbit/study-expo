import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, Circle } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { newId, type PracticeStroke } from '../basics/straightLine';
import type { CircleGuide } from '../basics/circleExercises';

export interface CircleCanvasProps {
  size: number;
  strokes: PracticeStroke[];
  disabled: boolean;
  onStroke: (stroke: PracticeStroke) => void;
  onActiveChange: (active: boolean) => void;
  guide: CircleGuide;
}

export default function CircleCanvas({ size, strokes, disabled, onStroke, onActiveChange, guide }: CircleCanvasProps) {
  const active = useRef<PracticeStroke | null>(null);
  const start = useRef(0);
  const [, render] = useState(0);
  const callbacks = useRef({ onStroke, onActiveChange, disabled, size });
  callbacks.current = { onStroke, onActiveChange, disabled, size };

  // Build Skia path for the ellipse guide
  const guidePath = useMemo(() => {
    const path = Skia.Path.Make();
    const s = size;
    const cx = guide.cx * s, cy = guide.cy * s;
    const rx = guide.rx * s, ry = guide.ry * s;
    // Draw as 4-arc approximation of ellipse
    path.addOval({ x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 });
    return path;
  }, [guide, size]);

  // Starting point (top of ellipse, clockwise starts at top)
  const startX = guide.cx * size;
  const startY = (guide.cy - guide.ry) * size;

  const gesture = useMemo(() => {
    const add = (e: { x: number; y: number; pressure?: number }) => {
      if (!active.current) return;
      const s = callbacks.current.size;
      active.current.points.push({ x: Math.max(0, Math.min(1, e.x / s)), y: Math.max(0, Math.min(1, e.y / s)), t: Math.max(0, performance.now() - start.current), ...(Number.isFinite(e.pressure) ? { pressure: Math.max(0, Math.min(1, e.pressure!)) } : {}) });
      render(n => n + 1);
    };
    return Gesture.Pan().minDistance(0).maxPointers(1).runOnJS(true)
      .onBegin(e => {
        if (callbacks.current.disabled) return;
        start.current = performance.now();
        active.current = { strokeId: newId(), inputType: e.pointerType === PointerType.STYLUS ? 'STYLUS' : 'TOUCH', startedAt: Date.now(), points: [] };
        callbacks.current.onActiveChange(true);
        add(e);
        if (active.current) active.current.points[0].t = 0;
      })
      .onUpdate(add)
      .onEnd((e, success) => {
        if (success && active.current) { add(e); callbacks.current.onStroke(active.current); }
        active.current = null; callbacks.current.onActiveChange(false); render(n => n + 1);
      })
      .onFinalize(() => { active.current = null; callbacks.current.onActiveChange(false); render(n => n + 1); });
  }, []);

  const all = active.current ? [...strokes, active.current] : strokes;

  return <GestureDetector gesture={gesture}>
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }} accessible accessibilityLabel={`원 연습 캔버스. ${guide.instruction} 그리세요.`}>
      <Canvas style={{ flex: 1 }}>
        {/* Guide ellipse */}
        <Path path={guidePath} color="#5acb80" strokeWidth={1.5} style="stroke" />
        {/* Start dot */}
        <Circle cx={startX} cy={startY} r={6} color="#297045" />
        {/* Direction arrow marker (simplified: small circle offset) */}
        <Circle cx={guide.clockwise ? startX + 8 : startX - 8} cy={startY} r={3} color="#297045" />
        {/* Drawn strokes */}
        {all.flatMap(s => s.points.slice(1).map((p, i) => {
          const before = s.points[i];
          return <Path key={`${s.strokeId}-${i}`} path={(() => { const pt = Skia.Path.Make(); pt.moveTo(before.x * size, before.y * size); pt.lineTo(p.x * size, p.y * size); return pt; })()} color="#24354a" strokeWidth={2.5} style="stroke" strokeCap="round" />;
        }))}
      </Canvas>
    </View>
  </GestureDetector>;
}
