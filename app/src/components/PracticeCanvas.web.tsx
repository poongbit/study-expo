import { useRef, useState, type PointerEvent } from 'react';
import { newId, type PracticeStroke } from '../basics/straightLine';
import type { PracticeCanvasProps } from './PracticeCanvas';

export default function PracticeCanvas({ size, strokes, disabled, onStroke, onActiveChange, guide, showPressure }: PracticeCanvasProps) {
  const active = useRef<PracticeStroke | null>(null);
  const pointer = useRef<number | null>(null);
  const start = useRef(0);
  const [, render] = useState(0);
  const add = (e: PointerEvent<SVGSVGElement>) => {
    if (!active.current || e.pointerId !== pointer.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    active.current.points.push({ x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)), t: Math.max(0, performance.now() - start.current), ...(e.pointerType === 'pen' ? { pressure: e.pressure } : {}) });
    render(n => n + 1);
  };
  const cancel = () => { active.current = null; pointer.current = null; onActiveChange(false); render(n => n + 1); };
  const all = active.current ? [...strokes, active.current] : strokes;
  return <svg width={size} height={size} viewBox="0 0 1 1" role="img" aria-label="직선 연습 캔버스" style={{ background: '#fff', borderRadius: 20, touchAction: 'none', cursor: disabled ? 'default' : 'crosshair', display: 'block' }}
    onPointerDown={e => {
      if (disabled || pointer.current !== null || e.button !== 0) return;
      pointer.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = performance.now();
      active.current = { strokeId: newId(), inputType: e.pointerType === 'pen' ? 'STYLUS' : 'TOUCH', startedAt: Date.now(), points: [] };
      onActiveChange(true); add(e); active.current.points[0].t = 0;
    }}
    onPointerMove={add}
    onPointerUp={e => {
      if (e.pointerId !== pointer.current || !active.current) return;
      add(e); onStroke(active.current); cancel();
      e.currentTarget.releasePointerCapture(e.pointerId);
    }}
    onPointerCancel={e => { if (e.pointerId === pointer.current) cancel(); }}
    onLostPointerCapture={() => { if (active.current) cancel(); }}>
    <line x1={guide.start.x} y1={guide.start.y} x2={guide.end.x} y2={guide.end.y} stroke="#8970cb" strokeWidth={1 / size} />
    {[guide.start, guide.end].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6 / size} fill="#7250bd" />)}
    {all.flatMap(s => s.points.slice(1).map((p, i) => { const before=s.points[i]; const pressure=showPressure && s.inputType==='STYLUS' ? (p.pressure ?? before.pressure ?? .25) : .25; return <line key={`${s.strokeId}-${i}`} x1={before.x} y1={before.y} x2={p.x} y2={p.y} stroke="#24354a" strokeWidth={(2+pressure*8)/size} strokeLinecap="round" />; }))}
  </svg>;
}
