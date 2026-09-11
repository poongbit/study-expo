import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { newId, type PracticeStroke } from '../basics/straightLine';
import type { LineGuide } from '../basics/lineExercises';

export interface PracticeCanvasProps {
  size: number;
  strokes: PracticeStroke[];
  disabled: boolean;
  onStroke: (stroke: PracticeStroke) => void;
  onActiveChange: (active: boolean) => void;
  guide: LineGuide;
  showPressure: boolean;
}
export default function PracticeCanvas({ size, strokes, disabled, onStroke, onActiveChange, guide, showPressure }: PracticeCanvasProps) {
  const active = useRef<PracticeStroke | null>(null);
  const start = useRef(0);
  const [, render] = useState(0);
  const callbacks = useRef({ onStroke, onActiveChange, disabled, size });
  callbacks.current = { onStroke, onActiveChange, disabled, size };
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
        if (success && active.current) {
          add(e);
          callbacks.current.onStroke(active.current);
        }
        active.current = null;
        callbacks.current.onActiveChange(false);
        render(n => n + 1);
      })
      .onFinalize(() => {
        active.current = null;
        callbacks.current.onActiveChange(false);
        render(n => n + 1);
      });
  }, []);
  const all = active.current ? [...strokes, active.current] : strokes;
  return <GestureDetector gesture={gesture}>
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }} accessible accessibilityLabel={`직선 연습 캔버스. ${guide.instruction} 그리세요.`}>
      <Canvas style={{ flex: 1 }}>
        <Line p1={vec(guide.start.x * size, guide.start.y * size)} p2={vec(guide.end.x * size, guide.end.y * size)} color="#8970cb" strokeWidth={1} />
        {[guide.start, guide.end].map((p, i) => <Circle key={i} cx={p.x * size} cy={p.y * size} r={6} color="#7250bd" />)}
        {all.flatMap(s => s.points.slice(1).map((p, i) => {
          const before = s.points[i];
          const pressure = showPressure && s.inputType === 'STYLUS' ? (p.pressure ?? before.pressure ?? .25) : .25;
          return <Line key={`${s.strokeId}-${i}`} p1={vec(before.x * size, before.y * size)} p2={vec(p.x * size, p.y * size)} color="#24354a" strokeWidth={2 + pressure * 8} strokeCap="round" />;
        }))}
      </Canvas>
    </View>
  </GestureDetector>;
}
