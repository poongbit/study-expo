export const THRESHOLDS = {
  HEAD_TOO_WIDE: { value: 1.2, max: 2.0 }, // (head_width / head_height)
  EYES_TOO_WIDE: { value: 0.5, max: 1.0 }, // (eye_distance / head_width)
  EYES_UNBALANCED: { value: 0.2, max: 0.5 }, // (eye_y_diff / head_height)
  TORSO_TOO_LONG: { value: 2.0, max: 4.0 }, // (torso_height / head_height)
  BODY_OFF_CENTER: { value: 0.3, max: 1.0 }, // (body_offset / head_width)
  STROKE_TOO_FRAGMENTED: { value: 0.4, max: 1.0 }, // (fragmentation_ratio)
};
