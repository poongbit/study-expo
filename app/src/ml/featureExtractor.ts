import type {
  DrawingData,
  SketchFeatures,
  StrokePoint,
} from "../types/drawing";

/**
 * Calculates the bounding box of a given set of strokes.
 */
export function getBoundingBox(strokes: { points: StrokePoint[] }[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  return {
    minX: minX === Infinity ? 0 : minX,
    maxX: maxX === -Infinity ? 0 : maxX,
    minY: minY === Infinity ? 0 : minY,
    maxY: maxY === -Infinity ? 0 : maxY,
  };
}

/**
 * Calculates the center (average x, y) of a given set of strokes.
 */
function getCenter(strokes: { points: StrokePoint[] }[]) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      sumX += point.x;
      sumY += point.y;
      count++;
    }
  }

  if (count === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: sumX / count,
    y: sumY / count,
  };
}

/**
 * Extracts 7 key features from the multi-part drawing data.
 */
export function extractFeatures(data: DrawingData): SketchFeatures {
  const headStrokes = data.parts.head || [];
  const eyeLeftStrokes = data.parts.eye_left || [];
  const eyeRightStrokes = data.parts.eye_right || [];
  const torsoStrokes = data.parts.torso || [];

  // 1 & 2: head_width, head_height
  const headBox = getBoundingBox(headStrokes);
  const head_width = headBox.maxX - headBox.minX;
  const head_height = headBox.maxY - headBox.minY;

  // 3 & 4: eye_distance, eye_y_diff
  const leftEyeCenter = getCenter(eyeLeftStrokes);
  const rightEyeCenter = getCenter(eyeRightStrokes);

  // If either eye is missing points, fallback to 0 to prevent NaN
  const hasLeftEye = leftEyeCenter.x !== 0 || leftEyeCenter.y !== 0;
  const hasRightEye = rightEyeCenter.x !== 0 || rightEyeCenter.y !== 0;

  const eye_distance =
    hasLeftEye && hasRightEye
      ? Math.abs(rightEyeCenter.x - leftEyeCenter.x)
      : 0;
  const eye_y_diff =
    hasLeftEye && hasRightEye
      ? Math.abs(rightEyeCenter.y - leftEyeCenter.y)
      : 0;

  // 5: torso_height
  const torsoBox = getBoundingBox(torsoStrokes);
  const torso_height = torsoBox.maxY - torsoBox.minY;

  // 6: body_head_offset_x
  const headCenter = getCenter(headStrokes);
  const torsoCenter = getCenter(torsoStrokes);

  const hasHead = headCenter.x !== 0 || headCenter.y !== 0;
  const hasTorso = torsoCenter.x !== 0 || torsoCenter.y !== 0;

  const body_head_offset_x =
    hasHead && hasTorso ? Math.abs(torsoCenter.x - headCenter.x) : 0;

  // 7: fragmentation_ratio (V0: head stroke count)
  const fragmentation_ratio = headStrokes.length;

  // 8: head_aspect_ratio
  const head_aspect_ratio = head_height > 0 ? head_width / head_height : 0;

  return {
    head_width,
    head_height,
    eye_distance,
    eye_y_diff,
    torso_height,
    body_head_offset_x,
    fragmentation_ratio,
    head_aspect_ratio,
  };
}
