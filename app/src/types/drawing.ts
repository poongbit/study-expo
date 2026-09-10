// ── Part / Input types ────────────────────────────────────────────────────

export type PartKey = "head" | "eye_left" | "eye_right" | "torso";
export type InputType = "TOUCH" | "STYLUS";

// ── Stroke data (포인트 단위) ─────────────────────────────────────────────

export interface StrokePoint {
  x: number; // 0–1 normalized (canvas 기준)
  y: number; // 0–1 normalized
  t: number; // stroke 시작 기준 경과 ms
}

export interface Stroke {
  points: StrokePoint[];
}

// ── 전체 드로잉 ───────────────────────────────────────────────────────────

export interface DrawingData {
  drawingId: string;
  inputType: InputType;
  parts: Record<PartKey, Stroke[]>;
}

// ── ML Feature 벡터 ───────────────────────────────────────────────────────

export interface SketchFeatures {
  head_width: number;
  head_height: number;
  eye_distance: number;
  eye_y_diff: number;
  torso_height: number;
  body_head_offset_x: number;
  fragmentation_ratio: number;
  head_aspect_ratio: number;
}

export interface SketchFeaturesV1 {
  head_aspect_ratio: number;
  eye_distance_ratio: number;
  eye_distance_ratio_height: number;
  eye_bbox_center_distance_ratio: number;
  inter_eye_gap_ratio: number;
  eye_y_diff_ratio: number;
  torso_head_ratio: number;
  body_offset_ratio: number;
  fragmentation_ratio: number;
}
