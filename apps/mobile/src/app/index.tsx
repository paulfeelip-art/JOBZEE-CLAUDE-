import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Screen } from '@/components/Screen';
import { Button, Card, Logo, Row, T } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

const FACES = [require('../../assets/demo/andrei.jpg'), require('../../assets/demo/ioana.jpg'), require('../../assets/demo/radu.jpg')];

export default function Welcome() {
  const { session, ready, setMode, isDemo } = useStore();
  const p = usePalette();
  if (ready && session) return <Redirect href="/(tabs)" />;

  const go = (mode: 'help' | 'earn') => {
    setMode(mode);
    router.push('/auth/phone');
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Am nevoie de ajutor" icon="arrow" onPress={() => go('help')} />
          <Button title="Vreau să câștig ca Jobzer" icon="arrow" variant="line" onPress={() => go('earn')} />
          <T v="xs" mute style={{ textAlign: 'center' }}>
            {isDemo ? 'Mod demonstrativ: persoanele și plățile sunt simulate.' : 'Doar pentru adulți. Plățile sunt procesate de un furnizor autorizat.'}
          </T>
        </>
      }
    >
      <Logo size={30} />
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: p.surface, borderRadius: 999, paddingHorizontal: 12, height: 34 }}>
        <Icon name="spark" size={15} color={p.or} />
        <T v="label">Cererea o completează Jobzee AI</T>
      </View>
      <T style={{ fontFamily: font.extrabold, fontSize: 40, lineHeight: 44, letterSpacing: -1.4 }}>
        Ai ceva de făcut?{'\n'}Găsește un <T style={{ fontFamily: font.extrabold, fontSize: 40, color: p.orWord }}>Jobzer.</T>
      </T>
      <T mute style={{ fontSize: 18, lineHeight: 25 }}>Descrii. Confirmi. Cineva potrivit te ajută, acum sau când îți convine.</T>
      <Row gap={10}>
        {FACES.map((f, i) => (
          <Image key={i} source={f} style={{ flex: 1, height: 110, borderRadius: 16 }} contentFit="cover" accessibilityIgnoresInvertColors />
        ))}
      </Row>
      <Card style={{ gap: 14 }}>
        {([
          ['chat', 'Spune ce ai nevoie', 'Scrie, vorbește sau adaugă o poză.'],
          ['user', 'Alege Jobzerul potrivit', 'Recenzii reale, nivel și experiență.'],
          ['check', 'Confirmă finalizarea', 'Plătești doar după ce confirmi.'],
        ] as Array<[IconName, string, string]>).map(([ic, t, d]) => (
          <Row key={t} gap={14}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: p.fill, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ic} color={p.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="h3">{t}</T>
              <T v="small" mute>{d}</T>
            </View>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
