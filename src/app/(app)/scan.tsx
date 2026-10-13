import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { api, useGetExpenseHoldersQuery } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { clientUserId } from '@/auth/current';
import { Screen } from '@/components/Screen';
import { Button, Card, Chip, Divider, Field, IconTile, Tap, ToggleRow, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { closeTo } from '@/lib/navigation';
import { uploadFile, type LocalFile } from '@/lib/files';
import { accentGlowStrong, radius, space, tileGradient, useColors } from '@/theme';

type QueueItem = LocalFile & {
  key: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
  /** Form fields sent with the file: the „Plătit personal” statement at the time it was picked. */
  fields: Record<string, string>;
  paidBy?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');

function photoName(index = 0): string {
  const d = new Date();
  return `scan-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${index ? `-${index + 1}` : ''}.jpg`;
}

export default function ScanScreen() {
  const c = useColors();
  const t = useT();
  const router = useRouter();
  const dispatch = useDispatch();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const running = useRef(false);
  const pendingRef = useRef<QueueItem[]>([]);
  // „Plătit personal”: someone paid these documents out of their own pocket, so the
  // accountant books them as a decont and knows whom the company owes.
  const [paidPersonally, setPaidPersonally] = useState(false);
  const [holderId, setHolderId] = useState<number | null>(null);
  const [paidByName, setPaidByName] = useState('');
  const { data: holders = [] } = useGetExpenseHoldersQuery(undefined, { skip: !paidPersonally });
  const holder = holders.find((h) => h.id === holderId);

  const paidFields = (): { fields: Record<string, string>; paidBy?: string } => {
    if (!paidPersonally) return { fields: {} };
    if (holder) return { fields: { paidPersonally: 'true', expenseHolderId: String(holder.id) }, paidBy: holder.name };
    const name = paidByName.trim();
    return {
      fields: { paidPersonally: 'true', ...(name ? { paidByName: name } : {}) },
      paidBy: name || undefined,
    };
  };

  const update = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // Uploads one file at a time so a slow connection doesn't time out every file.
  const drain = async () => {
    if (running.current) return;
    running.current = true;
    while (pendingRef.current.length > 0) {
      const item = pendingRef.current.shift()!;
      update(item.key, { status: 'uploading' });
      try {
        await uploadFile(`/client-portal/upload?clientUserId=${clientUserId()}`, item, 'file', item.fields);
        update(item.key, { status: 'done' });
        dispatch(api.util.invalidateTags(['Documents', 'Dashboard']));
      } catch (e) {
        update(item.key, { status: 'error', error: errorMessage(e) });
      }
    }
    running.current = false;
    if (Platform.OS !== 'web')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const enqueue = (files: LocalFile[]) => {
    const paid = paidFields();
    const items = files.map((f, i) => ({
      ...f,
      ...paid,
      key: `${Date.now()}-${i}-${f.name}`,
      status: 'queued' as const,
    }));
    setQueue((q) => [...items, ...q]);
    pendingRef.current.push(...items);
    void drain();
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      notify(
        t('Fără acces la cameră', 'No camera access'),
        t('Permite accesul la cameră din Setările telefonului.', 'Allow camera access in your phone’s Settings.'),
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled) return;
    enqueue(res.assets.map((a, i) => ({ uri: a.uri, name: photoName(i), mimeType: a.mimeType ?? 'image/jpeg' })));
  };

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.7,
    });
    if (res.canceled) return;
    enqueue(
      res.assets.map((a, i) => ({
        uri: a.uri,
        name: a.fileName ?? photoName(i),
        mimeType: a.mimeType ?? 'image/jpeg',
      })),
    );
  };

  const pickFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    enqueue(res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' })));
  };

  const done = queue.filter((q) => q.status === 'done').length;
  const busy = queue.some((q) => q.status === 'queued' || q.status === 'uploading');

  return (
    <Screen
      footer={
        queue.length > 0 ? (
          <Button
            title={busy ? t('Se încarcă…', 'Uploading…') : t('Gata', 'Done')}
            disabled={busy}
            onPress={() => closeTo(router, '/documents')}
          />
        ) : undefined
      }>
      <Txt tone="muted" variant="small" style={{ marginBottom: space.lg, paddingHorizontal: 2 }}>
        {t(
          'Facturi de la furnizori, bonuri, extrase sau contracte — contabilul le primește imediat, iar Tavin extrage automat datele.',
          'Supplier invoices, receipts, statements or contracts — your accountant gets them right away and Tavin extracts the data automatically.',
        )}
      </Txt>

      <Card padded={false} style={styles.paidCard}>
        <ToggleRow
          icon="wallet"
          iconTone="accent"
          title={t('Plătit personal', 'Paid personally')}
          subtitle={t(
            'Cineva din firmă a plătit din banii proprii. Contabilul face decontul și știe cui îi datorează firma.',
            'Someone paid out of their own pocket. Your accountant books the expense report and what to pay back.',
          )}
          value={paidPersonally}
          onValueChange={setPaidPersonally}
        />
        {paidPersonally ? (
          <View style={styles.paidBody}>
            <Txt variant="footnote" tone="muted" weight="600">
              {t('Cine a plătit', 'Who paid')}
            </Txt>
            <View style={styles.chips}>
              {holders.map((h) => (
                <Chip key={h.id} label={h.name} active={holderId === h.id} onPress={() => setHolderId(h.id)} />
              ))}
              <Chip
                label={t('Altă persoană', 'Someone else')}
                active={holderId === null}
                onPress={() => setHolderId(null)}
              />
            </View>
            {holderId === null ? (
              <Field
                value={paidByName}
                onChangeText={setPaidByName}
                placeholder={t('Numele persoanei', 'Their name')}
                maxLength={120}
                autoCapitalize="words"
              />
            ) : null}
            <Txt variant="caption" tone="muted">
              {t(
                'Se aplică documentelor trimise cât timp e activ.',
                'Applies to the documents you send while this is on.',
              )}
            </Txt>
          </View>
        ) : null}
      </Card>

      <Option
        icon="camera"
        title={t('Fotografiază', 'Take photo')}
        subtitle={t('Factură, bon sau extras', 'Invoice, receipt or statement')}
        onPress={takePhoto}
        primary
      />
      <View style={styles.options}>
        <Option icon="images" title={t('Din galerie', 'From gallery')} onPress={pickPhotos} />
        <Option icon="document-attach" title={t('PDF / fișier', 'PDF / file')} onPress={pickFiles} />
      </View>

      <View style={[styles.tip, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
        <IconTile icon="bulb" tone="warn" solid size={30} />
        <Txt variant="small" tone="soft" style={{ flex: 1 }}>
          {t(
            'Pune documentul pe o suprafață plană, cu lumină bună, și încadrează-l întreg în poză.',
            'Lay the document flat in good light and fit the whole page in the photo.',
          )}
        </Txt>
      </View>

      {queue.length > 0 ? (
        <>
          <Txt variant="label" tone="muted" style={styles.queueTitle}>
            {t(`Trimise ${done} din ${queue.length}`, `Sent ${done} of ${queue.length}`)}
          </Txt>
          <Card padded={false}>
            {queue.map((q, i) => (
              <View key={q.key}>
                {i > 0 ? <Divider inset={60} /> : null}
                <View style={styles.queueRow}>
                  <IconTile
                    icon={q.mimeType.startsWith('image/') ? 'image' : 'document'}
                    tone={q.status === 'error' ? 'danger' : q.status === 'done' ? 'good' : 'accent'}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{q.name}</Txt>
                    {q.fields.paidPersonally ? (
                      <Txt variant="caption" tone="muted" numberOfLines={1}>
                        {q.paidBy
                          ? t(`Plătit personal de ${q.paidBy}`, `Paid personally by ${q.paidBy}`)
                          : t('Plătit personal', 'Paid personally')}
                      </Txt>
                    ) : null}
                    {q.status === 'error' ? (
                      <Txt variant="caption" tone="danger" numberOfLines={2}>
                        {q.error}
                      </Txt>
                    ) : null}
                  </View>
                  {q.status === 'uploading' || q.status === 'queued' ? (
                    <ActivityIndicator color={c.accent} />
                  ) : q.status === 'done' ? (
                    <Ionicons name="checkmark-circle" size={22} color={c.good} />
                  ) : (
                    <Pressable
                      onPress={() => {
                        update(q.key, { status: 'queued', error: undefined });
                        pendingRef.current.push(q);
                        void drain();
                      }}
                      hitSlop={8}>
                      <Txt variant="small" tone="accent" weight="600">
                        {t('Reîncearcă', 'Retry')}
                      </Txt>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Option({
  icon,
  title,
  subtitle,
  onPress,
  primary,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const c = useColors();
  if (primary) {
    // The landing page's "snap a receipt" tile.
    return (
      <Tap
        onPress={onPress}
        scaleTo={0.98}
        style={[styles.primary, tileGradient('accent', 135)]}
        accessibilityRole="button">
        <View style={styles.primaryIcon}>
          <Ionicons name={icon} size={30} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading" style={{ color: '#FFFFFF' }}>
            {title}
          </Txt>
          {subtitle ? <Txt style={{ color: '#DFE4FF' }}>{subtitle}</Txt> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
      </Tap>
    );
  }
  return (
    <Tap
      onPress={onPress}
      scaleTo={0.96}
      accessibilityRole="button"
      style={[styles.option, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
      <IconTile icon={icon} tone="accent" size={44} />
      <Txt weight="600" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.xl - 4,
    borderRadius: radius.xl,
    boxShadow: accentGlowStrong,
  },
  primaryIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  options: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  paidCard: { marginBottom: space.lg },
  paidBody: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm + 2,
    paddingVertical: space.xl,
    paddingHorizontal: space.sm,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md + 2,
    borderRadius: radius.lg,
    marginTop: space.lg,
  },
  queueTitle: { marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: space.lg },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
  },
});
