import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  useGetApprovalsQuery,
  useGetConversationsQuery,
  useGetTasksQuery,
  useUpdateTaskStatusMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { ClientTask, InvoiceConfirmation } from '@/api/types';
import { useUser } from '@/auth/session';
import { TabScreen } from '@/components/LargeTitle';
import { Avatar, Button, Card, CountBadge, EmptyState, ErrorState, Loading, Pill, Tap, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { daysUntil, formatDate, formatMoney, initials } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { space, useColors } from '@/theme';

/**
 * The Contabil tab: one inbox for what the accountant needs from the client (invoices to
 * confirm, tasks), most pressing first, with the chat one tap away. Each card carries its
 * own action; only the first one is the coral button.
 */
export default function AccountantScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const approvals = useGetApprovalsQuery();
  const tasks = useGetTasksQuery();
  const { data: conversations } = useGetConversationsQuery(undefined, { pollingInterval: 60_000 });
  const [updateStatus] = useUpdateTaskStatusMutation();

  const pending = approvals.data?.data ?? [];
  const openTasks = (tasks.data?.tasks ?? [])
    .filter((x) => x.status === 'PENDING' || x.status === 'IN_PROGRESS')
    .sort((a, b) => String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')));
  const conversation = conversations?.conversations[0];
  const unread = conversation?.unreadCount ?? 0;
  const firmName = conversation?.accountingCompany.name ?? user.accountingCompany.name;
  const total = pending.length + openTasks.length;
  const loading = approvals.isLoading || tasks.isLoading;
  const failed = (approvals.error && !approvals.data) || (tasks.error && !tasks.data);

  const setStatus = async (task: ClientTask, status: 'IN_PROGRESS' | 'COMPLETED') => {
    if (status === 'COMPLETED') haptic.success();
    try {
      await updateStatus({ taskId: task.id, status }).unwrap();
    } catch (e) {
      notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
    }
  };

  return (
    <TabScreen
      title={t('Contabil', 'Accountant')}
      refreshing={(approvals.isFetching || tasks.isFetching) && !loading}
      onRefresh={() => {
        approvals.refetch();
        tasks.refetch();
      }}>
      <Tap
        onPress={() => router.push('/messages')}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={t(`Mesaje cu ${firmName}`, `Messages with ${firmName}`)}
        style={[styles.contact, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
        <Avatar text={initials(firmName || 'T')} size={44} />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt weight="700" numberOfLines={1}>
            {firmName}
          </Txt>
          <Txt variant="small" tone={unread > 0 ? 'accent' : 'muted'} weight={unread > 0 ? '600' : '400'}>
            {unread > 0
              ? unread === 1
                ? t('Un mesaj nou', 'One new message')
                : t(`${unread} mesaje noi`, `${unread} new messages`)
              : t('Scrie-i contabilului', 'Message your accountant')}
          </Txt>
        </View>
        <CountBadge count={unread} />
        <Ionicons name="chatbubble-ellipses" size={22} color={c.accentText} />
      </Tap>

      <Txt variant="label" tone="muted" style={styles.label}>
        {total > 0 ? t(`De rezolvat · ${total}`, `To do · ${total}`) : t('De rezolvat', 'To do')}
      </Txt>

      {loading ? (
        <Loading />
      ) : failed ? (
        <ErrorState
          message={errorMessage(approvals.error ?? tasks.error)}
          onRetry={() => {
            approvals.refetch();
            tasks.refetch();
          }}
        />
      ) : total === 0 ? (
        <EmptyState
          icon="checkmark-done"
          title={t('Ești la zi', 'You’re all caught up')}
          message={t(
            'Contabilul nu are nevoie de nimic acum. Te anunțăm când apare ceva.',
            'Your accountant doesn’t need anything right now. We’ll let you know when something comes up.',
          )}
        />
      ) : (
        <View style={{ gap: space.md }}>
          {pending.map((item, i) => (
            <ApprovalCard key={`a${item.id}`} item={item} primary={i === 0} onOpen={() => router.push('/approvals')} />
          ))}
          {openTasks.map((task, i) => (
            <TaskCard
              key={`t${task.id}`}
              task={task}
              primary={pending.length === 0 && i === 0}
              onDone={() => setStatus(task, 'COMPLETED')}
              onStart={() => setStatus(task, 'IN_PROGRESS')}
            />
          ))}
        </View>
      )}

      <Tap onPress={() => router.push('/tasks')} style={styles.history} accessibilityRole="button">
        <Txt variant="small" tone="accent" weight="600">
          {t('Vezi sarcinile finalizate', 'See finished tasks')}
        </Txt>
      </Tap>
    </TabScreen>
  );
}

function ApprovalCard({ item, primary, onOpen }: { item: InvoiceConfirmation; primary: boolean; onOpen: () => void }) {
  const t = useT();
  const risky = item.riskLevel === 'HIGH' || item.ibanIsNew;
  return (
    <Card>
      <View style={styles.head}>
        <Txt variant="label" tone="muted" style={styles.kind}>
          {t('Factură de confirmat', 'Invoice to confirm')}
        </Txt>
        <Pill
          label={risky ? t('De verificat', 'Check this') : t('Așteaptă', 'Waiting')}
          tone={risky ? 'urgent' : 'accent'}
        />
      </View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="title" weight="700" numberOfLines={2}>
            {item.vendorName}
          </Txt>
          {item.documentDate ? (
            <Txt variant="small" tone="muted">
              {[item.documentNumber, formatDate(item.documentDate)].filter(Boolean).join(' · ')}
            </Txt>
          ) : null}
        </View>
        <Txt variant="title" weight="700" tabular>
          {formatMoney(item.totalAmount, item.currency)}
        </Txt>
      </View>
      <Button
        title={t('Verifică și răspunde', 'Review and answer')}
        variant={primary ? 'primary' : 'secondary'}
        onPress={onOpen}
        style={styles.action}
      />
    </Card>
  );
}

function TaskCard({
  task,
  primary,
  onDone,
  onStart,
}: {
  task: ClientTask;
  primary: boolean;
  onDone: () => void;
  onStart: () => void;
}) {
  const t = useT();
  const days = daysUntil(task.dueDate);
  const late = days != null && days < 0;
  return (
    <Card>
      <View style={styles.head}>
        <Txt variant="label" tone="muted" style={styles.kind}>
          {t('Sarcină', 'Task')}
        </Txt>
        {task.status === 'IN_PROGRESS' ? (
          <Pill label={t('În lucru', 'In progress')} tone="accent" />
        ) : task.dueDate ? (
          <Pill
            label={
              late
                ? t('Întârziată', 'Late')
                : days === 0
                  ? t('azi', 'today')
                  : t(`până pe ${formatDate(task.dueDate)}`, `by ${formatDate(task.dueDate)}`)
            }
            tone={late || (days != null && days <= 1) ? 'urgent' : 'neutral'}
          />
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <Txt variant="title" weight="700">
          {task.title}
        </Txt>
        {task.description ? (
          <Txt variant="small" tone="muted" numberOfLines={3}>
            {task.description}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.action, styles.buttons]}>
        <Button
          title={t('Am rezolvat', 'Done')}
          icon="checkmark"
          variant={primary ? 'primary' : 'secondary'}
          onPress={onDone}
          style={{ flex: 1 }}
        />
        {task.status === 'PENDING' ? (
          <Button title={t('Lucrez la ea', 'Working on it')} variant="ghost" onPress={onStart} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md + 2,
    borderRadius: 20,
  },
  label: { marginTop: space.xl, marginBottom: space.sm, marginLeft: 2 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  kind: { fontSize: 11.5, letterSpacing: 0.6 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.sm },
  action: { marginTop: space.md + 2 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  history: { alignSelf: 'center', paddingVertical: space.lg, paddingHorizontal: space.md },
});
