import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

export function Chip({ label, color, bg }: { label: string; color?: string; bg?: string }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  
  return (
    <View style={[styles.chip, { backgroundColor: bg || c.primarySoft }]}>
      <Text style={[styles.label, { color: color || c.primaryDeep }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.chip,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  }
});
