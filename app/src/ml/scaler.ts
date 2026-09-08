// scaler.json data from python MLP training
const mean = [
  0.41364968395637974,
  0.413540296196618,
  0.14554925168380875,
  0.007311507510359475,
  0.20244681269223397,
  0.013524453152961406,
  1.104892761394102
];

const scale = [
  0.033504988717041904,
  0.03426674007140271,
  0.01519099119952419,
  0.014899455914609887,
  0.020485814779484347,
  0.022132659853670557,
  0.2922098281614539
];

/**
 * Applies StandardScaler transform identical to Python's scikit-learn.
 * @param features - Float32Array containing 7 raw features
 * @returns Float32Array containing 7 scaled features
 */
export function applyScaler(features: Float32Array): Float32Array {
  if (features.length !== mean.length) {
    throw new Error(`Scaler expects ${mean.length} features, but got ${features.length}`);
  }

  const scaled = new Float32Array(features.length);
  for (let i = 0; i < features.length; i++) {
    scaled[i] = (features[i] - mean[i]) / scale[i];
  }
  
  return scaled;
}
