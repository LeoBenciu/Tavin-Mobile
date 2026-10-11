import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useGetConversationsQuery,
  useGetProfileQuery,
  useMarkMessagesReadMutation,
  useSendMessageMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { ChatMessage } from '@/api/types';
import { useUser } from '@/auth/session';
import { NAV_BAR_HEIGHT, NavBar } from '@/components/LargeTitle';
import { useKeyboardVisible, useTabBarSpace } from '@/components/TabBar';
import { Avatar, EmptyState, ErrorState, Loading, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { formatRelative, initials } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { gradient, space, useColors } from '@/theme';

/** Messages further apart than this start a new group (and show their time). */
const GROUP_GAP_MS = 10 * 60_000;

export default function MessagesScreen() {
  const c = useColors();
  const t = useT();
  const user = useUser();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const keyboard = useKeyboardVisible();
  const { data, isLoading, error, refetch } = useGetConversationsQuery(undefined, {
    pollingInterval: focused ? 15_000 : 0,
  });
  const { data: profile } = useGetProfileQuery();
  const [send, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkMessagesReadMutation();
  const [text, setText] = useState('');
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const markedRef = useRef(new Set<number>());

  const conversation = data?.conversations[0];
  const accountingClientId = conversation?.id ?? profile?.accountingClientId;
  const messages = [...optimistic, ...(data?.messages ?? [])];

  // Opening the chat marks the accountant's messages as read.
  useEffect(() => {
    if (!focused || !data) return;
    const ids = data.messages
      .filter((m) => m.sender === 'accountant' && !m.read && !markedRef.current.has(m.id))
      .map((m) => m.id);
    if (ids.length) {
      ids.forEach((id) => markedRef.current.add(id));
      markRead(ids).catch(() => undefined);
    }
  }, [data, focused, markRead]);

  const submit = async () => {
    const content = text.trim();
    if (!content || !accountingClientId) return;
    haptic.light();
    setText('');
    const temp: ChatMessage = {
      id: -Date.now(),
      content,
      sender: 'client',
      senderName: '',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setOptimistic((o) => [temp, ...o]);
    try {
      await send({ accountingClientId, content }).unwrap();
      await refetch();
      // The server copy is in the list now; drop the local echo.
      setOptimistic((o) => o.filter((m) => m.id !== temp.id));
    } catch (e) {
      setOptimistic((o) => o.filter((m) => m.id !== temp.id));
      setText(content);
      notify(t('Mesajul nu a fost trimis', 'Message not sent'), errorMessage(e));
    }
  };

  const firmName = conversation?.accountingCompany.name ?? user.accountingCompany.name;
  const canSend = !!text.trim() && !sending && !!accountingClientId;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={{ flex: 1, paddingTop: insets.top + NAV_BAR_HEIGHT }}>
            <Loading />
          </View>
        ) : error && !data ? (
          <View style={{ flex: 1, paddingTop: insets.top + NAV_BAR_HEIGHT + space.lg }}>
            <ErrorState message={errorMessage(error)} onRetry={refetch} />
          </View>
        ) : (
          <FlatList
            inverted
            data={messages}
            keyExtractor={(m) => String(m.id)}
            keyboardDismissMode="interactive"
            // Inverted: paddingTop is the visual bottom, paddingBottom the top (under the bar).
            contentContainerStyle={[
              styles.list,
              { paddingTop: space.md, paddingBottom: insets.top + NAV_BAR_HEIGHT + space.lg },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="chatbubbles"
                  title={t('Scrie-i contabilului', 'Message your accountant')}
                  message={
                    firmName
                      ? t(`Mesajele ajung direct la ${firmName}.`, `Messages go straight to ${firmName}.`)
                      : t(
                          'Întrebări despre facturi, salarii sau taxe? Scrie aici.',
                          'Questions about invoices, payroll or taxes? Ask here.',
                        )
                  }
                />
              </View>
            }
            renderItem={({ item, index }) => {
              const mine = item.sender === 'client';
              // Inverted list: index - 1 is the message under this one, index + 1 the one above.
              const below = messages[index - 1];
              const above = messages[index + 1];
              const gap = (a?: ChatMessage) =>
                !a || Math.abs(new Date(a.timestamp).getTime() - new Date(item.timestamp).getTime()) > GROUP_GAP_MS;
              const endsGroup = !below || below.sender !== item.sender || gap(below);
              const startsGroup = !above || above.sender !== item.sender || gap(above);
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    mine ? styles.right : styles.left,
                    { marginTop: startsGroup ? space.md : 2 },
                  ]}>
                  {!mine && startsGroup && item.senderName ? (
                    <Txt variant="caption" tone="muted" weight="600" style={styles.sender}>
                      {item.senderName}
                    </Txt>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? [
                            { backgroundColor: c.accent },
                            gradient('linear-gradient(160deg, #5C74F5, #465FE9)'),
                            endsGroup ? styles.tailRight : null,
                          ]
                        : [{ backgroundColor: c.surface, boxShadow: c.cardShadow }, endsGroup ? styles.tailLeft : null],
                    ]}>
                    <Txt tone={mine ? 'onAccent' : 'default'} style={styles.bubbleText}>
                      {item.content}
                    </Txt>
                  </View>
                  {endsGroup ? (
                    <Txt variant="caption" tone="muted" style={[styles.time, mine ? { textAlign: 'right' } : null]}>
                      {item.id < 0
                        ? t('se trimite…', 'sending…')
                        : `${formatRelative(item.timestamp)}${mine && item.read ? ` · ${t('citit', 'read')}` : ''}`}
                    </Txt>
                  ) : null}
                </View>
              );
            }}
          />
        )}
        <View
          style={[
            styles.composer,
            {
              backgroundColor: c.bar,
              borderTopColor: c.separator,
              paddingBottom: keyboard ? space.sm : tabSpace || insets.bottom + space.sm,
            },
          ]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('Mesaj', 'Message')}
            placeholderTextColor={c.faint}
            selectionColor={c.accent}
            multiline
            // The web textarea otherwise opens two rows tall.
            {...(Platform.OS === 'web' ? { numberOfLines: 1 } : null)}
            style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.line }]}
          />
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('Trimite', 'Send')}
            style={({ pressed }) => [
              styles.send,
              canSend
                ? [{ backgroundColor: c.accent }, gradient('linear-gradient(160deg, #6B80F0, #465FE9)')]
                : { backgroundColor: c.fill },
              pressed && { opacity: 0.8 },
            ]}>
            <Ionicons name="arrow-up" size={20} color={canSend ? '#FFFFFF' : c.faint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <NavBar
        solid
        center={
          <View style={styles.contact}>
            <Avatar text={initials(firmName || 'T')} size={28} />
            <View style={{ flexShrink: 1 }}>
              <Txt variant="footnote" weight="700" numberOfLines={1}>
                {firmName}
              </Txt>
              <Txt variant="caption" tone="muted" numberOfLines={1}>
                {t('Contabilul tău', 'Your accountant')}
              </Txt>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: space.lg, flexGrow: 1 },
  emptyWrap: { flex: 1, transform: [{ scaleY: -1 }] },
  bubbleRow: { maxWidth: '80%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  sender: { marginLeft: 12, marginBottom: 3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  bubbleText: { fontSize: 17, lineHeight: 22 },
  tailRight: { borderBottomRightRadius: 6 },
  tailLeft: { borderBottomLeftRadius: 6 },
  time: { marginTop: 4, marginHorizontal: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 9 : 7,
    paddingBottom: Platform.OS === 'ios' ? 9 : 7,
    fontSize: 17,
  },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: '100%' },
});
