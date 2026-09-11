import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LessonChoices({ onBack }: { onBack: () => void }) {
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>다음 연습을 선택하세요</Text>
    <Text style={styles.body}>직선은 짧은 준비 운동으로 다시 연습하면 됩니다. 오늘은 여기서 마쳐도 괜찮아요.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>02 · C곡선</Text>
      <Text style={styles.body}>직선을 한 번에 잇던 움직임을 둥근 흐름으로 연결하는 다음 레슨입니다.</Text>
      <Text style={styles.note}>준비 중 · 곡선 가이드와 교정 기능은 아직 제공하지 않아요.</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>배운 선을 그림에 적용하기</Text>
      <Text style={styles.body}>기존 SD 드로잉에서 머리와 눈, 몸통을 그려보세요. 정확도를 서두르기보다 한 획의 흐름을 떠올려보세요.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push('/drawing')}><Text style={styles.buttonText}>SD 드로잉 열기</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" style={styles.button} onPress={onBack}><Text style={styles.buttonText}>직선 연습으로 돌아가기</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#f6f4fa'}, page:{padding:24,paddingBottom:100,gap:20,maxWidth:800,width:'100%',alignSelf:'center'},
  title:{fontSize:26,fontWeight:'700',color:'#293149'}, heading:{fontSize:20,fontWeight:'700',color:'#293149'},
  body:{fontSize:16,lineHeight:25,color:'#666c80'}, note:{fontSize:14,lineHeight:22,color:'#7351b7'},
  card:{backgroundColor:'#fff',padding:24,borderRadius:20,gap:16}, button:{backgroundColor:'#7351b7',padding:16,borderRadius:14,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'700',fontSize:16},
});
