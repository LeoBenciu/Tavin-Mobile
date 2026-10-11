import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useGetTasksQuery, useUpdateTaskStatusMutation } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { ClientTask } from '@/api/types';
import { Screen } from '@/components/Screen';
import { ActionSheet } from '@/components/Sheet';
import { Card, Divider, EmptyState, ErrorState, Loading, Pill, Segmented, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { taskStatusLabel } from '@/lib/domain';
import { daysUntil, formatDate } from '@/lib/format';
import { space, useColors } from '@/theme';

export default function TasksScreen() {
  const c = useColors();
  const t = useT();
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const [selected, setSelected] = useState<ClientTask | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useGetTasksQuery();
  const [updateStatus] = useUpdateTaskStatusMutation();

  const tasks = useMemo(
    () =>
      (data?.tasks ?? [])
        .filter((x) =>
          filter === 'done' ? x.status === 'COMPLETED' : x.status === 'PENDING' || x.status === 'IN_PROGRESS',
        )
        .sort((a, b) => String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'))),
    [data, filter],
  );

  const setStatus = async (task: ClientTask, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await updateStatus({ taskId: task.id, status }).unwrap();
    } catch (e) {
      notify(t('Nu a mers', 'That didn’t work'), errorMessage(e));
    }
  };

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'open', label: t('De făcut', 'To do') },
          { value: 'done', label: t('Finalizate', 'Done') },
        ]}
      />
      <View style={{ height: space.md }} />
      {isLoading ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={
            filter === 'open'
              ? t('Nimic de făcut', 'All caught up')
              : t('Nicio sarcină finalizată', 'No finished tasks')
          }
          message={t(
            'Contabilul îți poate cere aici documente sau informații.',
            'Your accountant can ask you for documents or information here.',
          )}
        />
      ) : (
        <Card padded={false}>
          {tasks.map((task, i) => {
            const st = taskStatusLabel(t, task.status);
            const days = daysUntil(task.dueDate);
            const done = task.status === 'COMPLETED';
            return (
              <View key={task.id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <Pressable
                  onPress={() => setSelected(task)}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceAlt }]}>
                  <Pressable
                    onPress={() => setStatus(task, done ? 'PENDING' : 'COMPLETED')}
                    hitSlop={10}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={26}
                      color={done ? c.good : c.muted}
                    />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt weight="500" style={done ? { textDecorationLine: 'line-through' } : undefined}>
                      {task.title}
                    </Txt>
                    {task.description ? (
                      <Txt variant="small" tone="muted" numberOfLines={3}>
                        {task.description}
                      </Txt>
                    ) : null}
                    <View style={styles.meta}>
                      {task.status === 'IN_PROGRESS' ? <Pill label={st.label} tone={st.tone} /> : null}
                      {task.dueDate ? (
                        <Txt variant="caption" tone={!done && days != null && days < 0 ? 'danger' : 'muted'}>
                          {t(`termen ${formatDate(task.dueDate)}`, `due ${formatDate(task.dueDate)}`)}
                        </Txt>
                      ) : null}
                      {task.createdBy ? (
                        <Txt variant="caption" tone="muted">
                          · {task.createdBy}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
      <ActionSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        actions={
          selected
            ? [
                {
                  label: t('Marchează ca finalizată', 'Mark as done'),
                  icon: 'checkmark-circle-outline',
                  hidden: selected.status === 'COMPLETED',
                  onPress: () => setStatus(selected, 'COMPLETED'),
                },
                {
                  label: t('Lucrez la ea', 'Working on it'),
                  icon: 'time-outline',
                  hidden: selected.status === 'IN_PROGRESS',
                  onPress: () => setStatus(selected, 'IN_PROGRESS'),
                },
                {
                  label: t('Redeschide', 'Reopen'),
                  icon: 'refresh',
                  hidden: selected.status === 'PENDING',
                  onPress: () => setStatus(selected, 'PENDING'),
                },
              ]
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', marginTop: 2 },
});
