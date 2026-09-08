import {
  NativeModules,
  requireNativeComponent,
  StyleSheet,
  View,
  ViewStyle,
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

// ── Native View ───────────────────────────────────────────────────────────

const PencilCanvasViewNative =
  requireNativeComponent<PencilCanvasNativeProps>('PencilCanvasView');

// ── Native Module ─────────────────────────────────────────────────────────

const PencilCanvasNativeModule = NativeModules.PencilCanvas as {
  exportStrokes: () => void;
  clearCanvas: () => void;
} | null;

// ── Public API ────────────────────────────────────────────────────────────

export const PencilCanvasCommands = {
  /** 현재 그림의 stroke JSON을 onStrokesExported 콜백으로 전달 */
  exportStrokes: () => {
    PencilCanvasNativeModule?.exportStrokes();
  },
  /** 캔버스 전체 초기화 */
  clearCanvas: () => {
    PencilCanvasNativeModule?.clearCanvas();
  },
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
  return (
    <View style={[styles.container, style]}>
      <PencilCanvasViewNative
        style={StyleSheet.absoluteFill}
        onStrokesExported={
          onStrokesExported
            ? (e) => onStrokesExported(e.nativeEvent)
            : undefined
        }
        onDrawingChanged={onDrawingChanged ? () => onDrawingChanged() : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
