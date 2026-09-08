import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PencilCanvas,
  PencilCanvasCommands,
  type StrokesExportedPayload,
} from '@/components/PencilCanvas';

// ── DrawingScreen ─────────────────────────────────────────────────────────

export default function DrawingScreen() {
  const [strokeCount, setStrokeCount] = useState(0);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);

  // drawing 변경될 때마다 UI 업데이트용 (현재는 카운트만)
  const handleDrawingChanged = useCallback(() => {
    // 실제 stroke 수는 export 시 파악
  }, []);

  // Export 버튼 → JSON을 console에 출력
  const handleExport = useCallback(() => {
    PencilCanvasCommands.exportStrokes();
  }, []);

  // Clear 버튼 → 캔버스 초기화
  const handleClear = useCallback(() => {
    PencilCanvasCommands.clearCanvas();
    setStrokeCount(0);
    setLastExportAt(null);
  }, []);

  // Native에서 stroke 데이터가 넘어왔을 때
  const handleStrokesExported = useCallback(
    (payload: StrokesExportedPayload) => {
      if (payload.error) {
        console.warn('[DrawingScreen] export error:', payload.error);
        return;
      }

      setStrokeCount(payload.stroke_count);
      setLastExportAt(new Date().toLocaleTimeString());

      // ✅ 요구사항 8: React Native console에 JSON 출력
      console.log(
        '[SD Sketch Coach] Exported strokes JSON:',
        JSON.stringify(payload, null, 2)
      );
    },
    []
  );

  // iOS 전용 — 다른 플랫폼에서는 안내 메시지
  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.unsupported}>
        <Text style={styles.unsupportedText}>
          PencilKit은 iOS/iPadOS에서만 지원됩니다.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── 툴바 ── */}
      <View style={styles.toolbar}>
        <Text style={styles.title}>✏️ SD Sketch Coach</Text>

        <View style={styles.statsRow}>
          <Text style={styles.statsText}>
            strokes: {strokeCount}
            {lastExportAt ? `  |  exported: ${lastExportAt}` : ''}
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.exportBtn, pressed && styles.btnPressed]}
            onPress={handleExport}
            accessibilityLabel="Export strokes as JSON"
          >
            <Text style={styles.btnText}>Export</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btn, styles.clearBtn, pressed && styles.btnPressed]}
            onPress={handleClear}
            accessibilityLabel="Clear canvas"
          >
            <Text style={styles.btnText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      {/* ── 캔버스 ── */}
      <PencilCanvas
        style={styles.canvas}
        onStrokesExported={handleStrokesExported}
        onDrawingChanged={handleDrawingChanged}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const TOOLBAR_H = 64;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  toolbar: {
    height: TOOLBAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#16213E',
    borderBottomWidth: 1,
    borderBottomColor: '#0F3460',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.5,
  },
  statsRow: {
    flex: 1,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtn: {
    backgroundColor: '#3B82F6',
  },
  clearBtn: {
    backgroundColor: '#475569',
  },
  btnPressed: {
    opacity: 0.7,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  canvas: {
    flex: 1,
  },
  unsupported: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  unsupportedText: {
    color: '#94A3B8',
    fontSize: 16,
  },
});
