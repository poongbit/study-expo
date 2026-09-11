import LessonChoices from '../../components/LessonChoices';
import { attemptsInSet, latestSetId, SET_RULE_VERSION, SET_SIZE, summarizeSet } from '../../basics/practiceSet';
import { requestAiFeedback, type AiFeedback } from '../../basics/aiFeedback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import PracticeCanvas from '../../components/PracticeCanvas';
import { loadAttempts, saveAttempt } from '../../basics/attemptStore';
import { createAttempt, METRIC_LABELS, METRIC_VERSION, newId, validateStrokes, type Attempt, type PracticeStroke } from '../../basics/straightLine';
import { guideForIndex, LINE_GUIDES, PRESSURE_COPY, pressureTaskForIndex } from '../../basics/lineExercises';
import { useRouter } from 'expo-router';
import { PracticeShell } from '../../components/PracticeShell';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Colors } from '../../constants/theme';
import { getCanonicalStrokes } from '../../basics/canonicalOverlay';

export default function LineScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [history, setHistory] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [strokes, setStrokes] = useState<PracticeStroke[]>([]);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [setId, setSetId] = useState(newId);
  const [showSummary, setShowSummary] = useState(false);
  const [choosingLesson, setChoosingLesson] = useState(false);
  const [courseMode, setCourseMode] = useState<'direction' | 'pressure'>('direction');
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'success' | 'fallback'>('idle');
  const [feedbackRun, setFeedbackRun] = useState(0);
  const [overlayFilter, setOverlayFilter] = useState<'all' | 'best' | 'worst'>('all');

  const readHistory = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await loadAttempts();
      setHistory(data.attempts);
      const restoredId = latestSetId(data.attempts);
      if (restoredId) {
        setSetId(restoredId);
        const restored = attemptsInSet(data.attempts, restoredId);
        setShowSummary(restored.length >= SET_SIZE);
        setCourseMode(restored[0]?.pressureTask ? 'pressure' : 'direction');
      }
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);
  
  useEffect(() => { void readHistory(); }, [readHistory]);
  
  const setAttempts = useMemo(() => attemptsInSet(history, setId), [history, setId]);
  const summary = useMemo(() => summarizeSet(setAttempts), [setAttempts]);
  
  const previousBatch = useMemo(() => {
    const candidates = [...new Set(history.filter(attempt => attempt.practiceSetId && attempt.practiceSetId !== setId && attempt.setRuleVersion === SET_RULE_VERSION)
      .sort((a, b) => b.createdAt - a.createdAt).map(attempt => attempt.practiceSetId!))];
    for (const candidate of candidates) {
      const previous = summarizeSet(attemptsInSet(history, candidate));
      if (previous.complete) return previous.batch;
    }
    return undefined;
  }, [history, setId]);

  useEffect(() => {
    if (!showSummary || !summary.complete) return;
    const controller = new AbortController();
    setAiFeedback(null);
    setAiStatus('loading');
    void requestAiFeedback(setId, summary.batch, previousBatch, controller.signal)
      .then(feedback => {
        if (!controller.signal.aborted) {
          setAiFeedback(feedback);
          setAiStatus('success');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAiStatus('fallback');
      });
    return () => controller.abort();
  }, [feedbackRun, previousBatch, setId, showSummary, summary]);

  const currentIndex = Math.min(setAttempts.length, SET_SIZE - 1);
  const scheduledGuide = guideForIndex(currentIndex);
  const currentGuide = result && 'id' in result.guide ? result.guide : scheduledGuide;
  const pressureTask = result?.pressureTask ?? (courseMode === 'pressure' ? pressureTaskForIndex(currentIndex) : undefined);
  const pressureBaseline = setAttempts.find(a => a.pressureTask === 'natural')?.pressureAnalysis?.mean;
  const previous = result ? history.find(a => a.attemptId === result.previousAttemptId) ?? null : setAttempts.at(-1) ?? null;

  const addStroke = useCallback((stroke: PracticeStroke) => setStrokes(current => [...current, stroke]), []);
  
  const analyze = async () => {
    if (summary.complete || lock.current || active || loading || loadError) return;
    const invalid = validateStrokes(strokes);
    if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const attempt = result ?? { ...createAttempt(strokes, previous, { guide: currentGuide, pressureTask, pressureBaseline }), practiceSetId: setId, setRuleVersion: SET_RULE_VERSION };
      setResult(attempt);
      await saveAttempt(attempt);
      setHistory(current => current.some(a => a.attemptId === attempt.attemptId) ? current : [...current, attempt]);
      setStrokes([]); setResult(null);
      if (setAttempts.length + 1 >= SET_SIZE) setShowSummary(true);
    } catch { setError('기록을 저장하지 못했어요. 아래 버튼으로 저장을 다시 시도해 주세요.'); }
    finally { lock.current = false; setBusy(false); }
  };

  const startSet = () => {
    if (busy || lock.current) return;
    setSetId(newId()); setShowSummary(false); setStrokes([]); setResult(null);
    setError(''); setAiFeedback(null); setAiStatus('idle'); setFeedbackRun(0);
    setOverlayFilter('all');
  };

  const disabled = busy || loading || loadError || active;

  if (choosingLesson) return <LessonChoices onBack={() => setChoosingLesson(false)} />;

  const isResultPhase = showSummary && summary.complete;

  // --- Overlay Filter Logic ---
  const overlayAttempts = useMemo(() => {
    if (!isResultPhase) return [];
    if (overlayFilter === 'all') return setAttempts;
    
    // Find best and worst based on deviation
    const sorted = [...setAttempts].sort((a, b) => a.analysis.metrics.deviation - b.analysis.metrics.deviation);
    if (overlayFilter === 'best') return [sorted[0]];
    if (overlayFilter === 'worst') return [sorted[sorted.length - 1]];
    return setAttempts;
  }, [isResultPhase, overlayFilter, setAttempts]);

  const overlayStrokes = useMemo(() => {
    if (!isResultPhase) return [];
    return overlayAttempts.flatMap(a => getCanonicalStrokes(a.strokes, a.guide));
  }, [isResultPhase, overlayAttempts]);

  // --- Render Sections ---
  const renderCanvas = () => {
    if (isResultPhase) {
      return (
        <View style={styles.canvasWrapper}>
          <View style={styles.overlayTabs}>
            <Pressable onPress={() => setOverlayFilter('all')} style={[styles.tab, overlayFilter === 'all' && { borderBottomColor: c.primary }]}><Text style={[styles.tabText, overlayFilter === 'all' && { color: c.primary, fontWeight: '700' }]}>전체 (20획)</Text></Pressable>
            <Pressable onPress={() => setOverlayFilter('best')} style={[styles.tab, overlayFilter === 'best' && { borderBottomColor: c.success }]}><Text style={[styles.tabText, overlayFilter === 'best' && { color: c.success, fontWeight: '700' }]}>최선</Text></Pressable>
            <Pressable onPress={() => setOverlayFilter('worst')} style={[styles.tab, overlayFilter === 'worst' && { borderBottomColor: c.warning }]}><Text style={[styles.tabText, overlayFilter === 'worst' && { color: c.warning, fontWeight: '700' }]}>최악</Text></Pressable>
          </View>
          <PracticeCanvas 
            size={400} 
            strokes={overlayStrokes} 
            disabled={true} 
            guide={LINE_GUIDES[0]} // horizontal-right
            showPressure={false} 
          />
        </View>
      );
    }
    
    return (
      <View style={styles.canvasWrapper}>
        <View style={styles.canvasHeader}>
          <Chip label={currentGuide.label} color={c.primaryDeep} bg={c.primarySoft} />
          {pressureTask && <Chip label={PRESSURE_COPY[pressureTask].label} bg={c.backgroundSelected} />}
        </View>
        <PracticeCanvas 
          size={400} 
          strokes={strokes} 
          disabled={!!result || loading || busy || loadError} 
          onStroke={addStroke} 
          onActiveChange={setActive} 
          guide={currentGuide} 
          showPressure={courseMode === 'pressure'} 
        />
        <View style={styles.canvasFooter}>
          <Text style={[styles.footerText, { color: c.textMuted }]}>{currentGuide.instruction}</Text>
          <Text style={[styles.footerText, { color: c.textMuted }]}>{strokes.length}번 그었어요</Text>
        </View>
      </View>
    );
  };

  const renderRightPanel = () => {
    if (isResultPhase) {
      return (
        <ScrollView contentContainerStyle={styles.panelScroll}>
          <View style={styles.aiBox}>
            <Text style={[styles.aiTitle, { color: c.primary }]}>
              {aiStatus === 'loading' ? 'AI 코치가 피드백을 정리하는 중...' : '코칭 피드백'}
            </Text>
            
            {aiFeedback ? (
              <View style={styles.feedbackContent}>
                <View style={styles.feedbackItem}>
                  <Text style={[styles.feedbackLabel, { color: c.primary }]}>핵심 문제</Text>
                  <Text style={[styles.feedbackText, { color: c.text, fontWeight: '700' }]}>{aiFeedback.coreProblem}</Text>
                </View>
                <View style={styles.feedbackItem}>
                  <Text style={[styles.feedbackLabel, { color: c.primary }]}>숫자 근거</Text>
                  <Text style={[styles.feedbackText, { color: c.textSecondary }]}>{aiFeedback.evidence}</Text>
                </View>
                <View style={[styles.feedbackItem, styles.nextActionBox, { backgroundColor: c.primaryTint }]}>
                  <Text style={[styles.feedbackLabel, { color: c.primary }]}>다음 20획에서 바꿀 행동</Text>
                  <Text style={[styles.feedbackText, { color: c.primaryDeep, fontWeight: '600' }]}>{aiFeedback.nextAction}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.feedbackContent}>
                <ActivityIndicator color={c.primary} style={{ alignSelf: 'flex-start', marginVertical: 20 }} />
              </View>
            )}
            
            {aiStatus === 'fallback' && (
              <View style={styles.fallbackBox}>
                <Text style={[styles.fallbackText, { color: c.warning }]}>AI 코치에 연결하지 못해 기기 분석을 사용했습니다.</Text>
                <Pressable onPress={() => setFeedbackRun(r => r + 1)}>
                  <Text style={[styles.retryText, { color: c.primary }]}>다시 시도</Text>
                </Pressable>
              </View>
            )}
          </View>
          
          <View style={styles.actionGroup}>
            <Button label="한 세트 더 연습" onPress={startSet} style={{ marginBottom: 12 }} />
            <Button label="기초 연습 목록" variant="secondary" onPress={() => router.back()} />
          </View>
        </ScrollView>
      );
    }
    
    return (
      <View style={styles.panelScroll}>
        <Text style={[styles.panelTitle, { color: c.text }]}>지금은 판단 없이 획을 모으고 있어요.</Text>
        <Text style={[styles.panelDesc, { color: c.textSecondary }]}>
          한 획을 기록하면 캔버스를 비우고 다음 방향을 안내합니다. 20획을 모두 모은 뒤 종합 피드백을 알려드려요.
        </Text>
        
        {!!error && <Text style={[styles.error, { color: c.warning }]}>{error}</Text>}
        
        <View style={styles.actionGroup}>
          <Button 
            label="이 획 기록하기" 
            onPress={analyze} 
            disabled={disabled || !strokes.length}
            style={{ marginBottom: 12 }}
          />
          <Button 
            label="지우기" 
            variant="secondary" 
            onPress={() => { setStrokes([]); setError(''); }} 
            disabled={disabled || !strokes.length}
          />
        </View>
        
        <View style={[styles.historyBox, { borderColor: c.backgroundSecondary }]}>
          <Text style={[styles.historyTitle, { color: c.textSecondary }]}>최근 진행 상황</Text>
          {setAttempts.slice(-4).reverse().map((a, i) => (
            <Text key={a.attemptId} style={[styles.historyRow, { color: i === 0 ? c.text : c.textMuted }]}>
              ✓ {'label' in a.guide ? a.guide.label : '직선'} 완료
            </Text>
          ))}
          {setAttempts.length === 0 && <Text style={{ color: c.textMuted }}>아직 기록된 획이 없습니다.</Text>}
        </View>
      </View>
    );
  };

  return (
    <PracticeShell 
      title="선 긋기" 
      currentStroke={setAttempts.length} 
      totalStrokes={SET_SIZE} 
      canvasContent={renderCanvas()} 
      rightPanelContent={renderRightPanel()} 
    />
  );
}

const styles = StyleSheet.create({
  canvasWrapper: { flex: 1, width: '100%', height: '100%', padding: 16 },
  canvasHeader: { flexDirection: 'row', gap: 8, marginBottom: 16, zIndex: 10 },
  canvasFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  footerText: { fontSize: 13, fontWeight: '600' },
  
  overlayTabs: { flexDirection: 'row', gap: 16, marginBottom: 16, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#8E89A6' },
  
  panelScroll: { flex: 1 },
  panelTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12, lineHeight: 28 },
  panelDesc: { fontSize: 15, lineHeight: 24, marginBottom: 32 },
  
  actionGroup: { marginTop: 'auto', paddingTop: 24 },
  error: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  
  historyBox: { marginTop: 32, paddingTop: 24, borderTopWidth: 1 },
  historyTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  historyRow: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  
  aiBox: { padding: 24, backgroundColor: '#FFFFFF', borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#FAF8FE' },
  aiTitle: { fontSize: 14, fontWeight: '800', marginBottom: 16 },
  feedbackContent: { gap: 20 },
  feedbackItem: { gap: 6 },
  feedbackLabel: { fontSize: 12, fontWeight: '800' },
  feedbackText: { fontSize: 16, lineHeight: 24 },
  nextActionBox: { padding: 16, borderRadius: 12, marginTop: 4 },
  
  fallbackBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#FAF8FE', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fallbackText: { fontSize: 12, flex: 1, marginRight: 12 },
  retryText: { fontSize: 13, fontWeight: '700' },
});
