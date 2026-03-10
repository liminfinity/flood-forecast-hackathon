/**
 * ONNX Runtime inference service for CatBoost water level forecasting.
 * Models: 6h, 24h, 72h horizons.
 */
import * as ort from 'onnxruntime-web';

// Use WASM backend
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';

interface ModelEntry {
  session: ort.InferenceSession;
  featureCols: string[];
}

const models: Record<string, ModelEntry> = {};
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

const FEATURE_COLS: Record<string, string[]> = {
  '6h': [
    'lag_1','lag_3','lag_6','lag_12','lag_24','lag_48',
    'roll_mean_3','roll_mean_6','roll_mean_12','roll_mean_24','roll_mean_48',
    'roll_std_3','roll_std_6','roll_std_12','roll_std_24','roll_std_48',
  ],
  '24h': [
    'lag_1','lag_3','lag_6','lag_12','lag_24','lag_48',
    'roll_mean_3','roll_mean_6','roll_mean_12','roll_mean_24','roll_mean_48',
    'roll_std_3','roll_std_6','roll_std_12','roll_std_24','roll_std_48',
  ],
  '72h': [
    'lag_1','lag_3','lag_6','lag_12','lag_24','lag_48','lag_72',
    'roll_mean_3','roll_mean_6','roll_mean_12','roll_mean_24','roll_mean_48','roll_mean_72',
    'roll_std_3','roll_std_6','roll_std_12','roll_std_24','roll_std_48','roll_std_72',
  ],
};

export async function loadOnnxModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const horizons = ['6h', '24h', '72h'];
    await Promise.all(
      horizons.map(async (h) => {
        try {
          const session = await ort.InferenceSession.create(`/models/catboost_${h}.onnx`);
          models[h] = { session, featureCols: FEATURE_COLS[h] };
          console.log(`ONNX model ${h} loaded, inputs:`, session.inputNames);
        } catch (e) {
          console.error(`Failed to load ONNX model ${h}:`, e);
        }
      })
    );
    modelsLoaded = Object.keys(models).length > 0;
  })();

  return loadingPromise;
}

export function isOnnxReady(): boolean {
  return modelsLoaded;
}

/**
 * Compute features from a series of hourly water level values.
 * `values` should be the most recent N hours (at least 72), newest last.
 */
function computeFeatures(
  values: number[],
  featureCols: string[]
): Float32Array {
  const n = values.length;
  const features = new Float32Array(featureCols.length);

  for (let i = 0; i < featureCols.length; i++) {
    const col = featureCols[i];

    if (col.startsWith('lag_')) {
      const lag = parseInt(col.slice(4));
      features[i] = lag <= n ? values[n - lag] : values[0];
    } else if (col.startsWith('roll_mean_')) {
      const window = parseInt(col.slice(10));
      const start = Math.max(0, n - window);
      const slice = values.slice(start, n);
      features[i] = slice.reduce((s, v) => s + v, 0) / slice.length;
    } else if (col.startsWith('roll_std_')) {
      const window = parseInt(col.slice(9));
      const start = Math.max(0, n - window);
      const slice = values.slice(start, n);
      const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
      const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
      features[i] = Math.sqrt(variance);
    }
  }

  return features;
}

/**
 * Run prediction for a specific horizon.
 * @param recentValues - array of hourly water level values (raw, e.g. -2.3), newest last, at least 72 items
 * @param horizon - '6h' | '24h' | '72h'
 * @returns predicted value (same scale as input) or null
 */
export async function predict(
  recentValues: number[],
  horizon: '6h' | '24h' | '72h'
): Promise<number | null> {
  const model = models[horizon];
  if (!model) return null;

  const features = computeFeatures(recentValues, model.featureCols);

  try {
    // CatBoost ONNX expects float_input of shape [1, num_features]
    const inputName = model.session.inputNames[0];
    const tensor = new ort.Tensor('float32', features, [1, features.length]);
    const result = await model.session.run({ [inputName]: tensor });
    const outputName = model.session.outputNames[0];
    const output = result[outputName];
    return (output.data as Float32Array)[0];
  } catch (e) {
    console.error(`ONNX prediction failed for ${horizon}:`, e);
    return null;
  }
}

/**
 * Get predictions for all three horizons at once.
 */
export async function predictAll(
  recentValues: number[]
): Promise<{ h6: number | null; h24: number | null; h72: number | null }> {
  const [h6, h24, h72] = await Promise.all([
    predict(recentValues, '6h'),
    predict(recentValues, '24h'),
    predict(recentValues, '72h'),
  ]);
  return { h6, h24, h72 };
}
