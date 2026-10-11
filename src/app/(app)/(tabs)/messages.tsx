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
import { formatDay } from '@/components/DateSheet';
import { useLanguage, useT, type Language, type Translate } from '@/i18n';
import { notify } from '@/lib/confirm';
import { initials, isoDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { gradient, space, useColors } from '@/theme';

/** Messages further apart than this start a new group (and show their time). */
const GROUP_GAP_MS = 10 * 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function clockTime(ts: string): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = {
  ro: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/** "Azi", "Ieri", a weekday within the last week, otherwise the date. */
function dayLabel(ts: string, t: Translate, language: Language): string {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(today) - start(d)) / 86_400_000);
  if (days <= 0) return t('Azi', 'Today');
  if (days === 1) return t('Ieri', 'Yesterday');
  if (days < 7) return WEEKDAYS[language][d.getDay()];
  return formatDay(isoDay(d), language);
}

export default function MessagesScreen() {
  const c = useColors();
  const t = useT();
  const { language } = useLanguage();
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
  const accountants = (conversation?.accountants ?? [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(', ');
  // Only your newest message carries "Sent" / "Read", as in iMessage.
  const latestMine = messages.findIndex((m) => m.sender === 'client');
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
            ListFooterComponent={
              // Inverted: the footer sits at the top, above the oldest message.
              messages.length > 0 ? (
                <View style={[styles.intro, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
                  <Avatar text={initials(firmName || 'T')} size={56} />
                  <Txt variant="title" style={styles.center}>
                    {firmName}
                  </Txt>
                  <Txt variant="small" tone="muted" style={styles.center}>
                    {accountants
                      ? t(`Contabilul tău · ${accountants}`, `Your accountant · ${accountants}`)
                      : t('Contabilul tău', 'Your accountant')}
                  </Txt>
                  <Txt variant="footnote" tone="muted" style={[styles.center, { marginTop: space.xs }]}>
                    {t(
                      'Mesajele ajung direct la ei. Primești o notificare când îți răspund.',
                      'Messages go straight to them. You get a notification when they reply.',
                    )}
                  </Txt>
                </View>
              ) : null
            }
            renderItem={({ item, index }) => {
              const mine = item.sender === 'client';
              // Inverted list: index - 1 is the message under this one, index + 1 the one above.
              const below = messages[index - 1];
              const above = messages[index + 1];
              const gap = (a?: ChatMessage) =>
                !a || Math.abs(new Date(a.timestamp).getTime() - new Date(item.timestamp).getTime()) > GROUP_GAP_MS;
              const startsDay = !above || dayKey(above.timestamp) !== dayKey(item.timestamp);
              const endsGroup = !below || below.sender !== item.sender || gap(below);
              const startsGroup = startsDay || !above || above.sender !== item.sender || gap(above);
              const status =
                item.id < 0
                  ? t('Se trimite…', 'Sending…')
                  : index === latestMine
                    ? item.read
                      ? t('Citit', 'Read')
                      : t('Trimis', 'Sent')
                    : null;
              return (
                <View>
                  {startsDay ? (
                    <Txt variant="caption" tone="muted" weight="600" style={styles.day}>
                      {dayLabel(item.timestamp, t, language)}
                    </Txt>
                  ) : null}
                  <View
                    style={[
                      styles.messageRow,
                      mine ? styles.right : styles.left,
                      { marginTop: startsGroup ? space.md : 2 },
                    ]}>
                    {!mine ? (
                      <View style={styles.avatarSlot}>
                        {endsGroup ? <Avatar text={initials(item.senderName || firmName || 'T')} size={28} /> : null}
                      </View>
                    ) : null}
                    <View style={[styles.bubbleColumn, mine ? { alignItems: 'flex-end' } : null]}>
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
                            : [
                                { backgroundColor: c.surface, boxShadow: c.cardShadow },
                                endsGroup ? styles.tailLeft : null,
                              ],
                        ]}>
                        <Txt tone={mine ? 'onAccent' : 'default'} style={styles.bubbleText}>
                          {item.content}
                        </Txt>
                      </View>
                      {endsGroup || status ? (
                        <Txt variant="caption" tone="muted" style={styles.time}>
                          {[endsGroup && item.id >= 0 ? clockTime(item.timestamp) : null, status]
                            .filter(Boolean)
                            .join(' · ')}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
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
            placeholder={t('Scrie-i contabilului…', 'Message your accountant…')}
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
                {accountants || t('Contabilul tău', 'Your accountant')}
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
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, maxWidth: '86%' },
  avatarSlot: { width: 28 },
  bubbleColumn: { flexShrink: 1 },
  day: { textAlign: 'center', marginTop: space.lg, marginBottom: space.xs },
  intro: { alignItems: 'center', gap: 4, padding: space.lg, borderRadius: 20, marginTop: space.md },
  center: { textAlign: 'center' },
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
