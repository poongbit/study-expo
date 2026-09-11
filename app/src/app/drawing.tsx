import { useCallback, useRef, useState, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  PointerType,
} from 'react-native-gesture-handler';

import type { DrawingData, PartKey, StrokePoint, InputType, SketchFeatures, SketchFeaturesV1, TestSample } from '../types/drawing';
import { validateDrawing } from '../ml/validateDrawing';
import { extractFeatures } from '../ml/featureExtractor';
import { extractFeaturesV1 } from '../ml/featureExtractorV1';
import { applyScaler } from '../ml/scaler';
import { runMockInference, type InferenceResult } from '../ml/mockInference';
import { getFeedbackText } from '../ml/feedback';
import { detectErrorsV1, type MultiErrorAnalysis } from '../ml/multiErrorDetector';

// ── Constants ──────────────────────────────────────────────────────────────

const STEPS: { key: PartKey; label: string; prompt: string }[] = [
  { key: 'head', label: 'HEAD', prompt: '머리를 그려주세요.' },
  { key: 'eye_left', label: 'EYE_LEFT', prompt: '왼쪽 눈을 그려주세요.' },
  { key: 'eye_right', label: 'EYE_RIGHT', prompt: '오른쪽 눈을 그려주세요.' },
  { key: 'torso', label: 'TORSO', prompt: '몸통을 그려주세요.' },
];

interface DrawnPath {
  path: SkPath;
  part: PartKey;
}

// ── DrawingScreen ──────────────────────────────────────────────────────────

export default function DrawingScreen() {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const analysisLock = useRef(false);
  const [drawingData, setDrawingData] = useState<DrawingData>({
    drawingId: `draw_${Date.now()}`,
    inputType: 'TOUCH', // Default, updated on first stroke
    parts: { head: [], eye_left: [], eye_right: [], torso: [] },
  });
  
  // Renderable paths (SVG strings to avoid JSI object state crashes)
  const [drawnPaths, setDrawnPaths] = useState<{ pathSvg: string; part: PartKey }[]>([]);
  
  // Re-render trigger for Skia paths
  const [, setDrawTick] = useState(0);
  const tick = () => setDrawTick(v => v + 1);

  // Analysis result
  const [features, setFeatures] = useState<SketchFeatures | null>(null);
  const [featuresV1, setFeaturesV1] = useState<SketchFeaturesV1 | null>(null);
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [multiErrorResult, setMultiErrorResult] = useState<MultiErrorAnalysis | null>(null);

  // Validation Ground Truth Label
  const EXPECTED_LABELS = [
    'GOOD',
    'HEAD_TOO_WIDE',
    'EYES_TOO_WIDE',
    'EYES_UNBALANCED',
    'TORSO_TOO_LONG',
    'BODY_OFF_CENTER',
    'STROKE_TOO_FRAGMENTED'
  ];
  const [expectedLabel, setExpectedLabel] = useState<string>('GOOD');
  const [testSamples, setTestSamples] = useState<TestSample[]>([]);

  // Mutable refs for active drawing
  const canvasSize = useRef(0);
  const currentPath = useRef<SkPath | null>(null);
  const currentPoints = useRef<StrokePoint[]>([]);
  const strokeStartTime = useRef<number>(0);
  const committed = useRef(false);
  const firstStrokeRecorded = useRef(false);

  const currentStep = STEPS[currentStepIdx];

  // Helper to resolve pointer type
  const resolvePointerKind = (pt: number): InputType => {
    return pt === PointerType.STYLUS ? 'STYLUS' : 'TOUCH';
  };

  // ── Gesture 핸들러 (JS thread) ───────────────────────────────────────────

  const handleBegin = useCallback((event: any) => {
    if (features) return; // Disable drawing if analyzed
    
    committed.current = false;
    const kind = resolvePointerKind(event.pointerType);
    
    if (!firstStrokeRecorded.current) {
      setDrawingData(prev => ({ ...prev, inputType: kind }));
      firstStrokeRecorded.current = true;
    }

    strokeStartTime.current = Date.now();
    
    const path = Skia.Path.Make();
    path.moveTo(event.x, event.y);
    currentPath.current = path;

    const size = canvasSize.current || 1;
    
    currentPoints.current = [{
      x: Math.min(1, Math.max(0, event.x / size)),
      y: Math.min(1, Math.max(0, event.y / size)),
      t: 0,
    }];

    tick();
  }, [features]);

  const handleUpdate = useCallback((event: any) => {
    if (!currentPath.current || features) return;

    currentPath.current.lineTo(event.x, event.y);
    
    const size = canvasSize.current || 1;
    const elapsed = Date.now() - strokeStartTime.current;

    currentPoints.current.push({
      x: Math.min(1, Math.max(0, event.x / size)),
      y: Math.min(1, Math.max(0, event.y / size)),
      t: elapsed,
    });

    tick();
  }, [features]);

  const handleEnd = useCallback(() => {
    if (committed.current || !currentPath.current || features) return;
    committed.current = true;

    const pointsToSave = [...currentPoints.current];
    
    if (pointsToSave.length === 0) {
      currentPath.current = null;
      currentPoints.current = [];
      return;
    }
    
    console.log(`[SD Sketch Coach] Saved stroke for ${currentStep.key}, points count: ${pointsToSave.length}`);

    setDrawingData(prev => {
      const nextParts = { ...prev.parts };
      nextParts[currentStep.key] = [
        ...nextParts[currentStep.key],
        { points: pointsToSave }
      ];
      return { ...prev, parts: nextParts };
    });

    const pathSvg = currentPath.current.toSVGString();
    setDrawnPaths(prev => [...prev, { pathSvg, part: currentStep.key }]);

    currentPath.current = null;
    currentPoints.current = [];
    tick();
  }, [currentStep.key, features]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .runOnJS(true)
    .onBegin(handleBegin)
    .onUpdate(handleUpdate)
    .onEnd(handleEnd)
    .onFinalize(handleEnd);

  // ── 버튼 액션 ────────────────────────────────────────────────────────────

  const handleClearCurrentStep = useCallback(() => {
    setDrawingData(prev => {
      const nextParts = { ...prev.parts };
      nextParts[currentStep.key] = [];
      return { ...prev, parts: nextParts };
    });
    setDrawnPaths(prev => prev.filter(p => p.part !== currentStep.key));
    setFeatures(null);
  }, [currentStep.key]);

  const handleNext = () => {
    if (currentStepIdx < STEPS.length - 1) {
      setCurrentStepIdx(v => v + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx(v => v - 1);
      setFeatures(null); // Reset analysis if going back
    }
  };

  const handleAnalyze = async () => {
    if (analysisLock.current) return;
    const invalid = validateDrawing(drawingData);
    if (invalid) { setValidationError(invalid); return; }
    setValidationError('');
    analysisLock.current = true;
    setAnalyzing(true);
    try {
      const extracted = extractFeatures(drawingData);
      const extractedV1 = extractFeaturesV1(drawingData);
      setFeatures(extracted);
      setFeaturesV1(extractedV1);

      // Logging V0 and V1 as requested
      console.log('\n[V0 FEATURES]');
      Object.entries(extracted).forEach(([key, val]) => {
        console.log(`${key}: ${typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(4) : val}`);
      });

      console.log('\n[V1 RELATIVE FEATURES]');
      Object.entries(extractedV1).forEach(([key, val]) => {
        console.log(`${key}: ${typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(4) : val}`);
      });

      console.log('\n[V1 COMPACT JSON]');
      console.log(JSON.stringify({ expectedLabel, ...extractedV1 }));

      // 1. Feature array (Strict Order exactly matching python training for V0)
      const rawFeaturesArray = new Float32Array([
        extracted.head_width,
        extracted.head_height,
        extracted.eye_distance,
        extracted.eye_y_diff,
        extracted.torso_height,
        extracted.body_head_offset_x,
        extracted.fragmentation_ratio
      ]);

      // 2. Scaler (StandardScaler from scaler.json)
      const scaledFeatures = applyScaler(rawFeaturesArray);

      console.log('\n[RAW FEATURES]');
      console.log(rawFeaturesArray);
      console.log('\n[SCALED FEATURES]');
      console.log(scaledFeatures);

      // 3. Mock ONNX Inference (Replace with onnxruntime when ejected)
      const result = await runMockInference(scaledFeatures);
      setInferenceResult(result);

      // 4. Multi-error analysis V1
      const multiError = detectErrorsV1(extractedV1);
      setMultiErrorResult(multiError);

      console.log('\n[MULTI ERROR RESULT]');
      console.log(JSON.stringify(multiError.results.filter(r => r.detected), null, 2));

      console.log('\n[PRIMARY ERROR]');
      console.log(multiError.primaryError ? multiError.primaryError.label : 'GOOD');

      // Save to test samples
      const sample: TestSample = {
        drawingId: drawingData.drawingId,
        createdAt: Date.now(),
        inputType: drawingData.inputType,
        expectedLabel,
        rawFeatures: extracted,
        v1Features: extractedV1,
        prediction: {
          index: result.index,
          label: result.label,
          confidence: result.confidence
        }
      };
      setTestSamples(prev => [...prev, sample]);

      console.log(`\n[EXPECTED LABEL]\n${expectedLabel}`);

      console.log('\n[V0 MOCK RESULT — 실제 모델 미사용]');
      console.log(`predictionIndex: ${result.index}`);
      console.log(`predictionLabel: ${result.label}`);
      console.log('Mock output only; not model confidence.');
    } catch {
      setValidationError('분석 중 문제가 발생했어요. 다시 시도해 주세요.');
      setFeatures(null);
    } finally {
      analysisLock.current = false;
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (testSamples.length === 0) {
      console.log('\n[SD Sketch Coach] No samples to export.\n');
      return;
    }
    
    console.log('\n=======================================');
    console.log('[QUICK SUMMARY]');
    console.log(`Total Samples: ${testSamples.length}`);
    
    let correctCount = 0;
    const perLabelCount: Record<string, number> = {};
    const confusion: Record<string, Record<string, number>> = {};

    testSamples.forEach(s => {
      // Per label count
      perLabelCount[s.expectedLabel] = (perLabelCount[s.expectedLabel] || 0) + 1;
      
      // Accuracy
      if (s.expectedLabel === s.prediction.label) {
        correctCount++;
      }
      
      // Confusion
      if (!confusion[s.expectedLabel]) confusion[s.expectedLabel] = {};
      confusion[s.expectedLabel][s.prediction.label] = (confusion[s.expectedLabel][s.prediction.label] || 0) + 1;
    });

    console.log(`Overall Accuracy: ${((correctCount / testSamples.length) * 100).toFixed(1)}%`);
    console.log('\n- Per Expected Label Count:');
    console.log(JSON.stringify(perLabelCount, null, 2));
    console.log('\n- Confusion Matrix (Expected -> Predicted):');
    console.log(JSON.stringify(confusion, null, 2));
    
    console.log('\n[EXPORT TEST DATASET (JSON)]');
    console.log(JSON.stringify(testSamples));
    console.log('=======================================\n');
  };

  const handleReset = () => {
    setValidationError('');
    setDrawingData({
      drawingId: `draw_${Date.now()}`,
      inputType: 'TOUCH',
      parts: { head: [], eye_left: [], eye_right: [], torso: [] },
    });
    setDrawnPaths([]);
    setCurrentStepIdx(0);
    setFeatures(null);
    setFeaturesV1(null);
    setInferenceResult(null);
    setMultiErrorResult(null);
    firstStrokeRecorded.current = false;
  };

  const getPartColor = (part: PartKey) => {
    if (part === currentStep.key) return '#3b82f6'; // Active step color
    return '#94a3b8'; // Completed steps color
  };

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* ── 상단 인스트럭션 ── */}
      <View style={styles.header}>
        <View style={styles.stepIndicator}>
          {STEPS.map((step, idx) => (
            <View 
              key={step.key} 
              style={[
                styles.stepDot, 
                idx === currentStepIdx && styles.stepDotActive,
                idx < currentStepIdx && styles.stepDotCompleted
              ]} 
            />
          ))}
        </View>
        <Text style={styles.promptText}>{currentStep.prompt}</Text>
        <Text style={styles.stepTitle}>STEP {currentStepIdx + 1}: {currentStep.label}</Text>
        {!!validationError && <Text accessibilityRole="alert" style={{ color: "#fca5a5", marginTop: 8 }}>{validationError}</Text>}
      </View>

      {/* ── Expected Label Selector (Dev Mode) ── */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#1a1a2e', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#0f3460' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>[DEV] EXPECTED LABEL FOR VALIDATION</Text>
          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>Saved Samples: {testSamples.length}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EXPECTED_LABELS.map(label => (
            <Pressable 
              key={label}
              onPress={() => setExpectedLabel(label)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: expectedLabel === label ? '#3b82f6' : '#2e3a59',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable 
          onPress={handleExport}
          style={{ marginTop: 12, backgroundColor: '#3b82f6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Export Test Dataset</Text>
        </Pressable>
      </View>

      {/* ── 캔버스 ── */}
      <View
        style={[styles.canvasContainer, { justifyContent: 'center', alignItems: 'center' }]}
        onLayout={e => {
          const layout = e.nativeEvent.layout;
          canvasSize.current = Math.min(layout.width, layout.height) - 32; // 32 for padding
          tick(); 
        }}>
        {canvasSize.current > 0 && (
          <GestureDetector gesture={panGesture}>
            <View style={{ width: canvasSize.current, height: canvasSize.current, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
              <Canvas style={{ flex: 1 }}>
                {/* 완성된 stroke들 */}
                {drawnPaths.map((item, i) => (
                  <Path
                    key={i}
                    path={item.pathSvg}
                    color={getPartColor(item.part)}
                    style="stroke"
                    strokeWidth={5}
                    strokeCap="round"
                    strokeJoin="round"
                    antiAlias
                  />
                ))}

                {/* 현재 그리는 중인 stroke */}
                {currentPath.current && (
                  <Path
                    path={currentPath.current}
                    color="#3b82f6"
                    style="stroke"
                    strokeWidth={5}
                    strokeCap="round"
                    strokeJoin="round"
                    antiAlias
                  />
                )}
              </Canvas>
              
              {features && inferenceResult && (
                <View style={styles.featuresOverlay}>
                  <ScrollView contentContainerStyle={styles.resultScroll}>
                    <Text style={styles.resultTitle}>AI 분석 결과</Text>
                    
                    <View style={styles.predictionCard}>
                      <Text style={styles.predictionLabel}>
                        {multiErrorResult?.primaryError ? multiErrorResult.primaryError.label : 'WITHIN_TARGET_RANGE'}
                      </Text>
                      {multiErrorResult?.primaryError && (
                        <Text style={styles.confidence}>Severity: {(multiErrorResult.primaryError.severity * 100).toFixed(0)}%</Text>
                      )}
                    </View>

                    <Text style={styles.feedbackText}>
                      "{getFeedbackText(multiErrorResult?.primaryError ? multiErrorResult.primaryError.label : 'GOOD')}"
                    </Text>

                    <View style={styles.debugSection}>
                      <Text style={styles.debugTitle}>DEVELOPMENT MODE LOGS</Text>
                      
                      <Text style={[styles.featureItem, { marginTop: 12, color: '#fcd34d', fontWeight: 'bold' }]}>
                        [V1 FEATURES]
                      </Text>
                      {featuresV1 && Object.entries(featuresV1).map(([key, val]) => (
                        <Text style={styles.featureItem} key={`v1_${key}`}>
                          - {key}: {typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(4) : val}
                        </Text>
                      ))}

                      <Text style={[styles.featureItem, { marginTop: 12, color: '#38bdf8', fontWeight: 'bold' }]}>
                        [MULTI ERROR RESULT]
                      </Text>
                      {multiErrorResult?.detectedErrors.map((err) => (
                        <Text style={styles.featureItem} key={`multi_${err.label}`}>
                          - {err.label} (sev: {err.severity.toFixed(2)})
                        </Text>
                      ))}
                      {multiErrorResult?.detectedErrors.length === 0 && (
                        <Text style={styles.featureItem}>- 탐지된 오류 없음 (임시 규칙 기준)</Text>
                      )}

                      <Text style={[styles.featureItem, { marginTop: 12, color: '#f87171', fontWeight: 'bold' }]}>
                        [PRIMARY ERROR]
                      </Text>
                      <Text style={styles.featureItem}>
                        {multiErrorResult?.primaryError ? multiErrorResult.primaryError.label : 'WITHIN_TARGET_RANGE'}
                      </Text>

                      <Text style={[styles.featureItem, { marginTop: 12, color: '#a78bfa', fontWeight: 'bold' }]}>
                        [V0 MOCK RESULT — 실제 모델 미사용]
                      </Text>
                      <Text style={styles.featureItem}>
                        {inferenceResult.label} (모의 규칙 결과)
                      </Text>
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          </GestureDetector>
        )}
      </View>
      
      {/* ── 하단 컨트롤바 ── */}
      <View style={styles.toolbar}>
        <Pressable style={styles.navBtn} onPress={handlePrev} disabled={currentStepIdx === 0 || analyzing}>
          <Text style={[styles.navBtnText, currentStepIdx === 0 && styles.disabledText]}>Prev</Text>
        </Pressable>
        
        <View style={styles.centerActions}>
          <Pressable style={[styles.actionBtn, styles.clearBtn]} disabled={analyzing} onPress={features ? handleReset : handleClearCurrentStep}>
            <Text style={styles.actionBtnText}>{features ? 'Restart' : 'Clear Step'}</Text>
          </Pressable>
        </View>

        {currentStepIdx < STEPS.length - 1 ? (
          <Pressable style={styles.navBtn} disabled={analyzing} onPress={handleNext}>
            <Text style={styles.navBtnText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.navBtn, styles.analyzeBtn]} disabled={analyzing} onPress={handleAnalyze}>
            <Text style={styles.navBtnText}>{analyzing ? '분석 중…' : 'Analyze'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0f3460',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: '#10b981',
  },
  promptText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 1,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#f8f8fb',
    overflow: 'hidden',
  },
  featuresOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    padding: 24,
    justifyContent: 'center',
  },
  resultScroll: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  resultTitle: {
    color: '#3b82f6',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  predictionCard: {
    backgroundColor: '#2e3a59',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  predictionLabel: {
    color: '#10b981',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  confidence: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 28,
  },
  debugSection: {
    width: '100%',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  debugTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 1,
  },
  featureItem: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    fontFamily: 'Courier',
  },
  featureVal: {
    color: '#fff',
    fontWeight: '600',
  },
  toolbar: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: '#16213e',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#0f3460',
  },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#2e3a59',
    minWidth: 100,
    alignItems: 'center',
  },
  analyzeBtn: {
    backgroundColor: '#10b981',
  },
  navBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledText: {
    color: '#64748b',
  },
  centerActions: {
    flex: 1,
    alignItems: 'center',
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  clearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  actionBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
