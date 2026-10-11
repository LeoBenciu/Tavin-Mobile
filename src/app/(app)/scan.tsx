import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { api } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { clientUserId } from '@/auth/current';
import { Screen } from '@/components/Screen';
import { Button, Card, Divider, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { closeTo } from '@/lib/navigation';
import { uploadFile, type LocalFile } from '@/lib/files';
import { radius, space, useColors } from '@/theme';

type QueueItem = LocalFile & { key: string; status: 'queued' | 'uploading' | 'done' | 'error'; error?: string };

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
        await uploadFile(`/client-portal/upload?clientUserId=${clientUserId()}`, item);
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
    const items = files.map((f, i) => ({ ...f, key: `${Date.now()}-${i}-${f.name}`, status: 'queued' as const }));
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
      <Txt tone="soft" style={{ marginBottom: space.lg }}>
        {t(
          'Facturi de la furnizori, bonuri, extrase sau contracte — contabilul le primește imediat, iar Tavin extrage automat datele.',
          'Supplier invoices, receipts, statements or contracts — your accountant gets them right away and Tavin extracts the data automatically.',
        )}
      </Txt>

      <View style={styles.options}>
        <Option icon="camera" title={t('Fotografiază', 'Take photo')} onPress={takePhoto} primary />
        <Option icon="images-outline" title={t('Din galerie', 'From gallery')} onPress={pickPhotos} />
        <Option icon="document-attach-outline" title={t('PDF / fișier', 'PDF / file')} onPress={pickFiles} />
      </View>

      <View style={[styles.tip, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="bulb-outline" size={18} color={c.accentText} />
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
                {i > 0 ? <Divider inset={space.lg} /> : null}
                <View style={styles.queueRow}>
                  <Ionicons
                    name={q.mimeType.startsWith('image/') ? 'image-outline' : 'document-outline'}
                    size={20}
                    color={c.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt numberOfLines={1}>{q.name}</Txt>
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
  onPress,
  primary,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: primary ? c.accent : c.surface, borderColor: primary ? c.accent : c.line },
        pressed && { opacity: 0.85 },
      ]}>
      <Ionicons name={icon} size={28} color={primary ? c.onAccent : c.accentText} />
      <Txt weight="600" tone={primary ? 'onAccent' : 'default'} style={{ textAlign: 'center' }}>
        {title}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: space.md },
  option: {
    flex: 1,
    aspectRatio: 0.95,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.sm,
  },
  tip: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, marginTop: space.lg },
  queueTitle: { marginTop: space.xl, marginBottom: space.sm },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
