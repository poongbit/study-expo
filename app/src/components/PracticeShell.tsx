import { View, StyleSheet, useWindowDimensions, Text, Pressable, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { ProgressBar } from './ui/ProgressBar';

interface PracticeShellProps {
  title: string;
  currentStroke: number;
  totalStrokes?: number;
  canvasContent: React.ReactNode;
  rightPanelContent: React.ReactNode;
}

export function PracticeShell({ title, currentStroke, totalStrokes = 20, canvasContent, rightPanelContent }: PracticeShellProps) {
  const { width, height } = useWindowDimensions();
  const isWide = width > height && width > 600;
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10} accessibilityLabel="뒤로 가기">
          <Text style={[styles.backIcon, { color: c.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      </View>

      <View style={[styles.container, isWide ? styles.containerRow : styles.containerCol]}>
        {!isWide && (
          <View style={styles.mobileProgress}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, { color: c.textSecondary }]}>진행도</Text>
              <Text style={[styles.progressCount, { color: c.text }]}>{String(currentStroke).padStart(2, '0')} / {totalStrokes}</Text>
            </View>
            <ProgressBar current={currentStroke} total={totalStrokes} />
          </View>
        )}

        <View style={[styles.canvasArea, isWide && styles.canvasAreaWide]}>
          <View style={[styles.canvasSquare, { backgroundColor: c.card, borderColor: c.cardSecondary }]}>
            {canvasContent}
          </View>
        </View>

        <View style={[styles.sidePanel, isWide && styles.sidePanelWide]}>
          {isWide && (
            <View style={styles.desktopProgress}>
              <View style={styles.progressRow}>
                <Text style={[styles.progressText, { color: c.textSecondary }]}>진행도</Text>
                <Text style={[styles.progressCount, { color: c.text }]}>{String(currentStroke).padStart(2, '0')} / {totalStrokes}</Text>
              </View>
              <ProgressBar current={currentStroke} total={totalStrokes} />
            </View>
          )}
          
          <View style={styles.panelContent}>
            {rightPanelContent}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: { marginRight: 16 },
  backIcon: { fontSize: 24, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700' },
  container: { flex: 1, padding: 24, gap: 24 },
  containerRow: { flexDirection: 'row' },
  containerCol: { flexDirection: 'column' },
  
  mobileProgress: { marginBottom: 8 },
  desktopProgress: { marginBottom: 32 },
  
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressText: { fontSize: 14, fontWeight: '600' },
  progressCount: { fontSize: 16, fontWeight: '700' },
  
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvasAreaWide: { flex: 2, alignItems: 'center', justifyContent: 'center' },
  canvasSquare: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 600,
    maxHeight: 600,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#1F1B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  
  sidePanel: { flex: 1, justifyContent: 'space-between' },
  sidePanelWide: { flex: 1, maxWidth: 360, marginLeft: 24 },
  panelContent: { flex: 1, gap: 20 },
});
