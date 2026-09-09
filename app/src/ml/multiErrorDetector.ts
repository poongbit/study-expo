import type { SketchFeaturesV1 } from "../types/drawing";
import { THRESHOLDS } from "./multiErrorConfig";

export interface ErrorDetectionResult {
  label: string;
  detected: boolean;
  severity: number; // 0 to 1
  featureValue: number;
}

export interface MultiErrorAnalysis {
  results: ErrorDetectionResult[];
  detectedErrors: ErrorDetectionResult[];
  primaryError: ErrorDetectionResult | null;
  isGood: boolean;
}

function calculateSeverity(
  value: number,
  threshold: number,
  max: number,
): number {
  if (value <= threshold) return 0;
  // linearly map threshold..max to 0..1
  const severity = (value - threshold) / (max - threshold);
  return Math.min(Math.max(severity, 0), 1);
}

export function detectErrorsV1(features: SketchFeaturesV1): MultiErrorAnalysis {
  const results: ErrorDetectionResult[] = [];

  // HEAD_TOO_WIDE
  const headW = features.head_aspect_ratio;
  results.push({
    label: "HEAD_TOO_WIDE",
    detected: headW > THRESHOLDS.HEAD_TOO_WIDE.value,
    severity: calculateSeverity(
      headW,
      THRESHOLDS.HEAD_TOO_WIDE.value,
      THRESHOLDS.HEAD_TOO_WIDE.max,
    ),
    featureValue: headW,
  });

  // EYES_TOO_WIDE
  const eyeDist = features.eye_distance_ratio;
  results.push({
    label: "EYES_TOO_WIDE",
    detected: eyeDist > THRESHOLDS.EYES_TOO_WIDE.value,
    severity: calculateSeverity(
      eyeDist,
      THRESHOLDS.EYES_TOO_WIDE.value,
      THRESHOLDS.EYES_TOO_WIDE.max,
    ),
    featureValue: eyeDist,
  });

  // EYES_UNBALANCED
  const eyeYDiff = features.eye_y_diff_ratio;
  results.push({
    label: "EYES_UNBALANCED",
    detected: eyeYDiff > THRESHOLDS.EYES_UNBALANCED.value,
    severity: calculateSeverity(
      eyeYDiff,
      THRESHOLDS.EYES_UNBALANCED.value,
      THRESHOLDS.EYES_UNBALANCED.max,
    ),
    featureValue: eyeYDiff,
  });

  // TORSO_TOO_LONG
  const torsoH = features.torso_head_ratio;
  results.push({
    label: "TORSO_TOO_LONG",
    detected: torsoH > THRESHOLDS.TORSO_TOO_LONG.value,
    severity: calculateSeverity(
      torsoH,
      THRESHOLDS.TORSO_TOO_LONG.value,
      THRESHOLDS.TORSO_TOO_LONG.max,
    ),
    featureValue: torsoH,
  });

  // BODY_OFF_CENTER
  const bodyOffset = features.body_offset_ratio;
  results.push({
    label: "BODY_OFF_CENTER",
    detected: bodyOffset > THRESHOLDS.BODY_OFF_CENTER.value,
    severity: calculateSeverity(
      bodyOffset,
      THRESHOLDS.BODY_OFF_CENTER.value,
      THRESHOLDS.BODY_OFF_CENTER.max,
    ),
    featureValue: bodyOffset,
  });

  // STROKE_TOO_FRAGMENTED
  const frag = features.fragmentation_ratio;
  results.push({
    label: "STROKE_TOO_FRAGMENTED",
    detected: frag > THRESHOLDS.STROKE_TOO_FRAGMENTED.value,
    severity: calculateSeverity(
      frag,
      THRESHOLDS.STROKE_TOO_FRAGMENTED.value,
      THRESHOLDS.STROKE_TOO_FRAGMENTED.max,
    ),
    featureValue: frag,
  });

  const detectedErrors = results.filter((r) => r.detected);

  // Sort detected errors by severity in descending order
  detectedErrors.sort((a, b) => b.severity - a.severity);

  const primaryError = detectedErrors.length > 0 ? detectedErrors[0] : null;
  const isGood = detectedErrors.length === 0;

  return {
    results,
    detectedErrors,
    primaryError,
    isGood,
  };
}
