import { Redirect, Tabs } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { useStore } from '@/lib/store';
import { font, usePalette } from '@/lib/theme';

const TABS: Array<[string, string, IconName]> = [
  ['index', 'Acasă', 'home'],
  ['activity', 'Activitate', 'activity'],
  ['messages', 'Mesaje', 'chat'],
  ['account', 'Cont', 'user'],
];

export default function TabsLayout() {
  const p = usePalette();
  const { session, ready } = useStore();
  if (ready && !session) return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.orText,
        tabBarInactiveTintColor: p.mute,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line, height: 78, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11.5 },
        sceneStyle: { backgroundColor: p.bg },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} color={String(color)} size={23} /> }} />
      ))}
    </Tabs>
  );
}
