import type { DrawingData, SketchFeaturesV1 } from '../types/drawing';
import { extractFeatures as extractFeaturesV0 } from './featureExtractor';

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function extractFeaturesV1(drawingData: DrawingData): SketchFeaturesV1 {
  // Reuse absolute features from V0 extractor
  const v0 = extractFeaturesV0(drawingData);
  
  const head_aspect_ratio = safeDivide(v0.head_width, v0.head_height);
  const eye_distance_ratio = safeDivide(v0.eye_distance, v0.head_width);
  const eye_distance_ratio_height = safeDivide(v0.eye_distance, v0.head_height);
  const eye_y_diff_ratio = safeDivide(v0.eye_y_diff, v0.head_height);
  const torso_head_ratio = safeDivide(v0.torso_height, v0.head_height);
  const body_offset_ratio = safeDivide(v0.body_head_offset_x, v0.head_width);
  const fragmentation_ratio = v0.fragmentation_ratio;

  return {
    head_aspect_ratio,
    eye_distance_ratio,
    eye_distance_ratio_height,
    eye_y_diff_ratio,
    torso_head_ratio,
    body_offset_ratio,
    fragmentation_ratio,
  };
}
