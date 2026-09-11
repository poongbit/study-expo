import type { DrawingData, PartKey } from '../types/drawing';
import { getBoundingBox } from './featureExtractor';
const PARTS: [PartKey, string][] = [['head', '머리'], ['eye_left', '왼쪽 눈'], ['eye_right', '오른쪽 눈'], ['torso', '몸통']];
export function validateDrawing(data: DrawingData): string | null {
  for (const [part, label] of PARTS) {
    const strokes = data.parts[part];
    if (!strokes.length || strokes.some(s => s.points.length < 2)) return `${label}을 선으로 그린 뒤 분석해 주세요.`;
    if (strokes.some(s => s.points.some((p, i) => ![p.x, p.y, p.t].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.t < 0 || (i > 0 && p.t < s.points[i - 1].t)))) return `${label}의 입력 기록이 올바르지 않아요. 해당 단계를 지우고 다시 그려주세요.`;
    const box = getBoundingBox(strokes);
    const w = box.maxX - box.minX, h = box.maxY - box.minY;
    if ((part === 'head' && (w < 0.01 || h < 0.01)) || (part === 'torso' && h < 0.01) || Math.hypot(w, h) < 0.01)
      return `${label}이 너무 작거나 납작해 분석하기 어려워요. 해당 단계를 다시 그려주세요.`;
  }
  return null;
}
