import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, Circle } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { newId, type PracticeStroke } from '../basics/straightLine';
import { sampleGuide, type BezierGuide } from '../basics/curveExercises';

export interface CurveCanvasProps {
  size: number;
  strokes: PracticeStroke[];
  disabled: boolean;
  onStroke: (stroke: PracticeStroke) => void;
  onActiveChange: (active: boolean) => void;
  guide: BezierGuide;
}

export default function CurveCanvas({ size, strokes, disabled, onStroke, onActiveChange, guide }: CurveCanvasProps) {
  const active = useRef<PracticeStroke | null>(null);
  const start = useRef(0);
  const [, render] = useState(0);
  const callbacks = useRef({ onStroke, onActiveChange, disabled, size });
  callbacks.current = { onStroke, onActiveChange, disabled, size };

  // Build Skia path for the bezier guide
  const guidePath = useMemo(() => {
    const path = Skia.Path.Make();
    const s = size;
    path.moveTo(guide.start.x * s, guide.start.y * s);
    path.cubicTo(
      guide.controlA.x * s, guide.controlA.y * s,
      guide.controlB.x * s, guide.controlB.y * s,
      guide.end.x * s, guide.end.y * s,
    );
    return path;
  }, [guide, size]);

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
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }} accessible accessibilityLabel={`커브 연습 캔버스. ${guide.instruction} 그리세요.`}>
      <Canvas style={{ flex: 1 }}>
        {/* Guide bezier */}
        <Path path={guidePath} color="#5a99cb" strokeWidth={1.5} style="stroke" />
        {/* Start and end dots */}
        <Circle cx={guide.start.x * size} cy={guide.start.y * size} r={6} color="#3570b5" />
        <Circle cx={guide.end.x * size} cy={guide.end.y * size} r={6} color="#3570b5" />
        {/* Drawn strokes */}
        {all.flatMap(s => s.points.slice(1).map((p, i) => {
          const before = s.points[i];
          return <Path key={`${s.strokeId}-${i}`} path={(() => { const pt = Skia.Path.Make(); pt.moveTo(before.x * size, before.y * size); pt.lineTo(p.x * size, p.y * size); return pt; })()} color="#24354a" strokeWidth={2.5} style="stroke" strokeCap="round" />;
        }))}
      </Canvas>
    </View>
  </GestureDetector>;
}
