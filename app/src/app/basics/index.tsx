import { ScrollView, StyleSheet, Text, View, useWindowDimensions, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Colors } from '../../constants/theme';

interface ExerciseCard {
  id: 'line' | 'curve' | 'circle';
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  route: string;
  time: string;
  icon: string;
}

const CARDS: ExerciseCard[] = [
  {
    id: 'line',
    title: '선 긋기',
    subtitle: '기초 연습 01',
    description: '8방향 직선을 각 방향별 2~3회씩 20획 연습합니다.',
    tags: ['8방향', '속도', '정확도'],
    route: '/basics/line',
    time: '약 2분',
    icon: '📏',
  },
  {
    id: 'curve',
    title: '커브 그리기',
    subtitle: '기초 연습 02',
    description: 'C·S 커브와 웨이브 8종을 20회 순환 연습합니다.',
    tags: ['리샘플링', '형태'],
    route: '/basics/curve',
    time: '약 3분',
    icon: '〰️',
  },
  {
    id: 'circle',
    title: '원 그리기',
    subtitle: '기초 연습 03',
    description: '시계·반시계 원과 타원 10종을 20회 순환 연습합니다.',
    tags: ['폐쇄 오차', '반지름'],
    route: '/basics/circle',
    time: '약 3분',
    icon: '⭕',
  },
];

export default function BasicsHub() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  
  const isWide = width > 768;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={[styles.brand, { color: c.text }]}>기초 연습</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            20획을 한 세트로 모아 방향·속도·리듬의 반복 패턴을 관찰해요.
          </Text>
        </View>
        
        <View style={[styles.cards, isWide && styles.cardsWide]}>
          {CARDS.map(card => (
            <Card key={card.id} style={[styles.cardContainer, isWide && styles.cardContainerWide]}>
              <View style={styles.cardHeader}>
                <Text style={styles.icon}>{card.icon}</Text>
                <Chip label={card.time} color={c.textSecondary} bg={c.backgroundSecondary} />
              </View>
              
              <Text style={[styles.cardSubtitle, { color: c.primary }]}>{card.subtitle}</Text>
              <Text style={[styles.cardTitle, { color: c.text }]}>{card.title}</Text>
              <Text style={[styles.cardDesc, { color: c.textSecondary }]}>{card.description}</Text>
              
              <View style={styles.tags}>
                {card.tags.map(tag => (
                  <Chip key={tag} label={tag} />
                ))}
              </View>
              
              <View style={styles.spacer} />
              
              <Button 
                label="연습 시작" 
                onPress={() => router.push(card.route as never)} 
              />
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { padding: 24, paddingBottom: 80, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  header: { marginBottom: 32 },
  brand: { fontWeight: '800', fontSize: 28 },
  subtitle: { marginTop: 6, fontSize: 16, lineHeight: 24 },
  cards: { gap: 20, flexDirection: 'column' },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cardContainer: { flex: 1, minHeight: 280 },
  cardContainerWide: { minWidth: 300, maxWidth: 400 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  icon: { fontSize: 32 },
  cardSubtitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  cardDesc: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  spacer: { minHeight: 16 },
});
