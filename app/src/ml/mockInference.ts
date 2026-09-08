/**
 * Mock Inference Module
 * 
 * NOTE: Expo Go does not support native C++ modules (like onnxruntime-react-native).
 * This mock function simulates the ONNX model inference using simple threshold rules
 * to demonstrate the full data pipeline and UI feedback functionality.
 * 
 * Once ejected to a Development Build, you can replace this function's body
 * with actual ONNX Runtime execution.
 * 
 * Input Shape expected by MLP: [1, 7] Float32Array
 * Output: { index: number, label: string, confidence: number }
 */

export interface InferenceResult {
  index: number;
  label: string;
  confidence: number;
}

const LABELS = [
  'GOOD',
  'HEAD_TOO_WIDE',
  'HEAD_TOO_TALL',
  'EYES_TOO_WIDE',
  'EYES_UNBALANCED',
  'TORSO_TOO_LONG',
  'BODY_OFF_CENTER',
  'STROKE_TOO_FRAGMENTED'
];

export async function runMockInference(scaledFeatures: Float32Array): Promise<InferenceResult> {
  // Simulate network or processing delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // The scaler standardizes values so that mean=0, std=1.
  // We can use these scaled values to create a somewhat realistic mock logic.
  
  const [
    head_w,
    head_h,
    eye_dist,
    eye_y_diff,
    torso_h,
    body_offset,
    frag_ratio
  ] = scaledFeatures;

  // Find the feature that is most extremely positively deviant from the mean.
  let maxScore = 0;
  let predictionIndex = 0; // default to GOOD
  
  if (head_w > 1.5 && head_w > maxScore) { predictionIndex = 1; maxScore = head_w; }
  if (head_h > 1.5 && head_h > maxScore) { predictionIndex = 2; maxScore = head_h; }
  if (eye_dist > 1.5 && eye_dist > maxScore) { predictionIndex = 3; maxScore = eye_dist; }
  if (eye_y_diff > 1.5 && eye_y_diff > maxScore) { predictionIndex = 4; maxScore = eye_y_diff; }
  if (torso_h > 1.5 && torso_h > maxScore) { predictionIndex = 5; maxScore = torso_h; }
  if (body_offset > 1.5 && body_offset > maxScore) { predictionIndex = 6; maxScore = body_offset; }
  if (frag_ratio > 1.5 && frag_ratio > maxScore) { predictionIndex = 7; maxScore = frag_ratio; }

  // Confidence is simulated based on how far the value is from the mean
  let confidence = 0.85; // default for GOOD
  if (predictionIndex !== 0) {
    confidence = Math.min(0.99, 0.5 + (maxScore * 0.1));
  }

  return {
    index: predictionIndex,
    label: LABELS[predictionIndex],
    confidence: confidence
  };
}
