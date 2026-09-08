/**
 * PencilCanvas — PencilKit(PKCanvasView) 기반 Native Module 래퍼.
 *
 * ⚠️  커스텀 Native Module이므로 Development Build 전용입니다.
 *      Expo Go에서는 이 컴포넌트를 렌더링하지 마세요.
 *      드로잉 기능은 drawing.tsx의 Skia 기반 구현을 사용합니다.
 */
import {
  NativeModules,
  Platform,
  requireNativeComponent,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

// ── 타입 정의 ─────────────────────────────────────────────────────────────

export interface StrokePoint {
  x: number;
  y: number;
  timeOffset: number;
  force: number;
  azimuth: number;
  altitude: number;
}

export interface Stroke {
  stroke_id: string;
  points: StrokePoint[];
}

export interface StrokesExportedPayload {
  canvas_w: number;
  canvas_h: number;
  stroke_count: number;
  strokes: Stroke[];
  error?: string;
}

interface PencilCanvasNativeProps {
  style?: ViewStyle;
  onStrokesExported?: (event: { nativeEvent: StrokesExportedPayload }) => void;
  onDrawingChanged?: (event: { nativeEvent: Record<string, never> }) => void;
}

// ── Native View (Development Build 전용) ─────────────────────────────────

// Expo Go에서는 requireNativeComponent 자체가 에러를 던지므로 조건부 로드
const PencilCanvasViewNative = Platform.OS === 'ios'
  ? (() => {
      try {
        return requireNativeComponent<PencilCanvasNativeProps>('PencilCanvasView');
      } catch {
        return null;
      }
    })()
  : null;

// ── Native Module ─────────────────────────────────────────────────────────

const PencilCanvasNativeModule = NativeModules.PencilCanvas as {
  exportStrokes: () => void;
  clearCanvas: () => void;
} | null;

// ── Public Commands ───────────────────────────────────────────────────────

export const PencilCanvasCommands = {
  exportStrokes: () => PencilCanvasNativeModule?.exportStrokes(),
  clearCanvas: () => PencilCanvasNativeModule?.clearCanvas(),
};

// ── Component ─────────────────────────────────────────────────────────────

interface PencilCanvasProps {
  style?: ViewStyle;
  onStrokesExported?: (payload: StrokesExportedPayload) => void;
  onDrawingChanged?: () => void;
}

export function PencilCanvas({
  style,
  onStrokesExported,
  onDrawingChanged,
}: PencilCanvasProps) {
  if (!PencilCanvasViewNative) {
    return (
      <View style={[styles.container, style, styles.fallback]}>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <PencilCanvasViewNative
        style={StyleSheet.absoluteFill}
        onStrokesExported={
          onStrokesExported
            ? (e) => onStrokesExported(e.nativeEvent)
            : undefined
        }
        onDrawingChanged={
          onDrawingChanged ? () => onDrawingChanged() : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: '#f8f8fb',
  },
});
