import type { DrawingData, SketchFeaturesV1 } from "../types/drawing";
import {
  extractFeatures as extractFeaturesV0,
  getBoundingBox,
} from "./featureExtractor";

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

  const leftEyeStrokes = drawingData.parts.eye_left || [];
  const rightEyeStrokes = drawingData.parts.eye_right || [];

  const leftEyeBBox = getBoundingBox(leftEyeStrokes);
  const rightEyeBBox = getBoundingBox(rightEyeStrokes);

  const leftEyeBBoxCenterX = (leftEyeBBox.minX + leftEyeBBox.maxX) / 2;
  const rightEyeBBoxCenterX = (rightEyeBBox.minX + rightEyeBBox.maxX) / 2;

  let eye_bbox_center_distance_ratio = 0;
  let inter_eye_gap = 0;
  let inter_eye_gap_ratio = 0;

  const hasLeftEye = leftEyeStrokes.length > 0;
  const hasRightEye = rightEyeStrokes.length > 0;

  if (hasLeftEye && hasRightEye) {
    const bbox_dist = Math.abs(rightEyeBBoxCenterX - leftEyeBBoxCenterX);
    eye_bbox_center_distance_ratio = safeDivide(bbox_dist, v0.head_width);

    // 3. 실제 미간 간격 feature
    inter_eye_gap = rightEyeBBox.minX - leftEyeBBox.maxX;
    inter_eye_gap_ratio = safeDivide(inter_eye_gap, v0.head_width);

    console.log("\n[DEBUG EYE FEATURES]");
    console.log(
      `LEFT EYE BBOX:\nminX: ${leftEyeBBox.minX.toFixed(4)}\nmaxX: ${leftEyeBBox.maxX.toFixed(4)}\ncenterX: ${leftEyeBBoxCenterX.toFixed(4)}`,
    );
    console.log(
      `RIGHT EYE BBOX:\nminX: ${rightEyeBBox.minX.toFixed(4)}\nmaxX: ${rightEyeBBox.maxX.toFixed(4)}\ncenterX: ${rightEyeBBoxCenterX.toFixed(4)}`,
    );
    console.log(`INTER EYE GAP: ${inter_eye_gap.toFixed(4)}`);
    console.log(`INTER EYE GAP RATIO: ${inter_eye_gap_ratio.toFixed(4)}`);

    if (inter_eye_gap < 0) {
      console.log(
        `[WARNING] inter_eye_gap is negative! The bounding boxes of the eyes are overlapping or inverted.`,
      );
    }
  }

  return {
    head_aspect_ratio,
    eye_distance_ratio,
    eye_distance_ratio_height,
    eye_bbox_center_distance_ratio,
    inter_eye_gap_ratio,
    eye_y_diff_ratio,
    torso_head_ratio,
    body_offset_ratio,
    fragmentation_ratio,
  };
}
