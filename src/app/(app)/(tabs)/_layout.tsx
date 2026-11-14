import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useGetApprovalsQuery, useGetConversationsQuery, useGetTasksQuery } from '@/api/api';
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

/**
 * Four tabs around the scan button (FloatingTabBar puts it in the middle): what a client
 * does every day. The rest of the firm (bank, bills, reports, lists, settings) opens
 * from the company avatar on Acasă.
 */
export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  const space = useTabBarSpaceValue();
  const { data: conversations } = useGetConversationsQuery(undefined, { pollingInterval: 60_000 });
  const { data: approvals } = useGetApprovalsQuery();
  const { data: tasks } = useGetTasksQuery();
  // Everything the accountant is waiting on, plus unread messages.
  const waiting =
    (approvals?.data.length ?? 0) +
    (tasks?.tasks ?? []).filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS').length +
    (conversations?.conversations[0]?.unreadCount ?? 0);

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
          name="accountant"
          options={{
            title: t('Contabil', 'Accountant'),
            tabBarBadge: waiting > 0 ? waiting : undefined,
            tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
          }}
        />
      </Tabs>
    </TabBarSpaceContext.Provider>
  );
}
