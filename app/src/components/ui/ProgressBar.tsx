import { View, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../constants/theme';

export function ProgressBar({ current, total = 20 }: { current: number; total?: number }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  
  const segments = Array.from({ length: total }, (_, i) => i);
  
  return (
    <View style={styles.container}>
      {segments.map(i => (
        <View 
          key={i} 
          style={[
            styles.segment, 
            { backgroundColor: i < current ? c.primary : c.backgroundSelected }
          ]} 
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    flex: 1,
  },
  segment: {
    flex: 1,
    borderRadius: 3,
  }
});
