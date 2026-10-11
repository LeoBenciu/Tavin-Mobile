import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useGetConversationsQuery } from '@/api/api';
import { FloatingTabBar, TabBarSpaceContext, useTabBarSpaceValue } from '@/components/TabBar';
import { useT } from '@/i18n';
import { useColors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Filled glyph on the selected tab, outline on the others (iOS convention). */
function icon(filled: IconName, outline: IconName) {
  return function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? filled : outline} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  const space = useTabBarSpaceValue();
  const { data: conversations } = useGetConversationsQuery(undefined, { pollingInterval: 60_000 });
  const unread = conversations?.conversations[0]?.unreadCount ?? 0;

  return (
    <TabBarSpaceContext.Provider value={space}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.background },
        }}>
        <Tabs.Screen name="index" options={{ title: t('Acasă', 'Home'), tabBarIcon: icon('home', 'home-outline') }} />
        <Tabs.Screen
          name="documents"
          options={{ title: t('Documente', 'Documents'), tabBarIcon: icon('documents', 'documents-outline') }}
        />
        <Tabs.Screen
          name="invoices"
          options={{ title: t('Facturi', 'Invoices'), tabBarIcon: icon('receipt', 'receipt-outline') }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t('Mesaje', 'Messages'),
            tabBarBadge: unread > 0 ? unread : undefined,
            tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
          }}
        />
        <Tabs.Screen name="more" options={{ title: t('Mai mult', 'More'), tabBarIcon: icon('grid', 'grid-outline') }} />
      </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
