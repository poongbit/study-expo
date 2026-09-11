import { PracticeStroke } from './straightLine';
import { GuideGeometry, LineGuide } from './lineExercises';

/**
 * Transforms strokes drawn on an arbitrary 8-direction guide into a canonical horizontal representation
 * (left-to-right, starting at 0.15, 0.5 and ending at 0.85, 0.5).
 */
export function getCanonicalStrokes(strokes: PracticeStroke[], guide: GuideGeometry | LineGuide): PracticeStroke[] {
  const targetStart = { x: 0.15, y: 0.5 };
  const targetEnd = { x: 0.85, y: 0.5 };
  const targetDx = targetEnd.x - targetStart.x;
  const targetDy = targetEnd.y - targetStart.y;
  const targetLen = Math.hypot(targetDx, targetDy);
  
  const startX = guide.start.x;
  const startY = guide.start.y;
  const sourceDx = guide.end.x - guide.start.x;
  const sourceDy = guide.end.y - guide.start.y;
  const sourceLen = Math.hypot(sourceDx, sourceDy);
  
  const scale = targetLen / (sourceLen || 1);
  const targetAngle = Math.atan2(targetDy, targetDx);
  const sourceAngle = Math.atan2(sourceDy, sourceDx);
  const angle = targetAngle - sourceAngle;
  
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  return strokes.map(stroke => ({
    ...stroke,
    points: stroke.points.map(p => {
      // Translate start to origin
      let x = p.x - startX;
      let y = p.y - startY;
      
      // Scale
      x *= scale;
      y *= scale;
      
      // Rotate
      const nx = x * cos - y * sin;
      const ny = x * sin + y * cos;
      
      // Translate to canonical start
      return { ...p, x: nx + targetStart.x, y: ny + targetStart.y };
    })
  }));
}
