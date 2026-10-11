import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';

import {
  useGetConversationsQuery,
  useGetProfileQuery,
  useMarkMessagesReadMutation,
  useSendMessageMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { ChatMessage } from '@/api/types';
import { EmptyState, ErrorState, Loading, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { formatRelative } from '@/lib/format';
import { radius, space, useColors } from '@/theme';

export default function MessagesScreen() {
  const c = useColors();
  const t = useT();
  const focused = useIsFocused();
  const headerHeight = useHeaderHeight();
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

  const firmName = conversation?.accountingCompany.name;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="chatbubbles-outline"
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
          renderItem={({ item }) => {
            const mine = item.sender === 'client';
            return (
              <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: c.accent, borderBottomRightRadius: 4 }
                      : {
                          backgroundColor: c.surface,
                          borderColor: c.line,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderBottomLeftRadius: 4,
                        },
                  ]}>
                  {!mine && item.senderName ? (
                    <Txt variant="caption" tone="accent" weight="600" style={{ marginBottom: 2 }}>
                      {item.senderName}
                    </Txt>
                  ) : null}
                  <Txt tone={mine ? 'onAccent' : 'default'}>{item.content}</Txt>
                </View>
                <Txt variant="caption" tone="muted" style={[styles.time, mine ? { textAlign: 'right' } : null]}>
                  {item.id < 0 ? t('se trimite…', 'sending…') : formatRelative(item.timestamp)}
                </Txt>
              </View>
            );
          }}
        />
      )}
      <View style={[styles.composer, { backgroundColor: c.surface, borderTopColor: c.line }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Scrie un mesaj…', 'Write a message…')}
          placeholderTextColor={c.muted}
          multiline
          style={[styles.input, { color: c.text, backgroundColor: c.chip }]}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || sending || !accountingClientId}
          accessibilityLabel={t('Trimite', 'Send')}
          style={[styles.send, { backgroundColor: text.trim() ? c.accent : c.line }]}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, flexGrow: 1 },
  emptyWrap: { flex: 1, transform: [{ scaleY: -1 }] },
  bubbleRow: { marginVertical: 4, maxWidth: '82%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderRadius: radius.lg },
  time: { marginTop: 2, marginHorizontal: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    paddingHorizontal: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: space.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
