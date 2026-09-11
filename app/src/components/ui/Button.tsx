import { Pressable, Text, StyleSheet, PressableProps, useColorScheme, ViewStyle, TextStyle } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface Props extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle | ViewStyle[];
  labelStyle?: TextStyle;
}

export function Button({ label, variant = 'primary', style, labelStyle, ...props }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: c.primary },
        variant === 'secondary' && { backgroundColor: c.primarySoft },
        variant === 'outline' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.primaryTint },
        pressed && { opacity: 0.8 },
        props.disabled && { opacity: 0.5 },
        style
      ]}
      {...props}
    >
      <Text style={[
        styles.label,
        variant === 'primary' && { color: '#fff' },
        variant === 'secondary' && { color: c.primaryDeep },
        variant === 'outline' && { color: c.textSecondary },
        labelStyle
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    minWidth: 48,
    borderRadius: Radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  }
});
