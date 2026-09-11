import { View, ViewProps, StyleSheet, useColorScheme } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

export function Card({ style, children, ...props }: ViewProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardSecondary }, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#1F1B2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
});
