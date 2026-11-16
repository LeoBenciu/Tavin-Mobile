import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { api } from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { clientUserId } from '@/auth/current';
import { Screen } from '@/components/Screen';
import { Button, Card, Divider, IconTile, Tap, Txt, type IconName } from '@/components/ui';
import { useT } from '@/i18n';
import { notify } from '@/lib/confirm';
import { closeTo } from '@/lib/navigation';
import { uploadFile, type LocalFile } from '@/lib/files';
import { actionGlow, radius, space, useColors } from '@/theme';

type Item = LocalFile & { key: string; status: 'staged' | 'uploading' | 'done' | 'error'; error?: string };
/** Pick → check what you picked → sent. Nothing leaves the phone until "Trimite". */
type Step = 'pick' | 'review' | 'sent';

const pad = (n: number) => String(n).padStart(2, '0');

function photoName(index = 0): string {
  const d = new Date();
  return `scan-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${index ? `-${index + 1}` : ''}.jpg`;
}

export default function ScanScreen() {
  const t = useT();
  const router = useRouter();
  const dispatch = useDispatch();
  const [items, setItems] = useState<Item[]>([]);
  const [step, setStep] = useState<Step>('pick');
  const sending = useRef(false);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((q) => q.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const stage = (files: LocalFile[]) => {
    if (!files.length) return;
    const added = files.map((f, i) => ({ ...f, key: `${Date.now()}-${i}-${f.name}`, status: 'staged' as const }));
    setItems((q) => [...q, ...added]);
    setStep('review');
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
    stage(res.assets.map((a, i) => ({ uri: a.uri, name: photoName(i), mimeType: a.mimeType ?? 'image/jpeg' })));
  };

  const pickPhotos = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 0.7,
    });
    if (res.canceled) return;
    stage(
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
    stage(res.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' })));
  };

  // One file at a time, so a slow connection doesn't time out every file.
  const send = async (only?: Item[]) => {
    if (sending.current) return;
    sending.current = true;
    setStep('sent');
    const batch = only ?? items.filter((i) => i.status === 'staged' || i.status === 'error');
    let failed = 0;
    for (const item of batch) {
      update(item.key, { status: 'uploading', error: undefined });
      try {
        await uploadFile(`/client-portal/upload?clientUserId=${clientUserId()}`, item);
        update(item.key, { status: 'done' });
      } catch (e) {
        failed++;
        update(item.key, { status: 'error', error: errorMessage(e) });
      }
    }
    dispatch(api.util.invalidateTags(['Documents', 'Dashboard']));
    sending.current = false;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        failed ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
    }
  };

  const restart = () => {
    setItems([]);
    setStep('pick');
  };

  if (step === 'review') {
    return (
      <ReviewStep
        items={items}
        onRemove={(key) => {
          const left = items.filter((i) => i.key !== key);
          setItems(left);
          if (!left.length) setStep('pick');
        }}
        onAddPhoto={takePhoto}
        onAddFile={pickFiles}
        onRetake={restart}
        onSend={() => void send()}
      />
    );
  }
  if (step === 'sent') {
    return (
      <SentStep
        items={items}
        onRetry={(item) => void send([item])}
        onDone={() => closeTo(router, '/documents')}
        onMore={restart}
      />
    );
  }
  return <PickStep onPhoto={takePhoto} onGallery={pickPhotos} onFile={pickFiles} />;
}

function PickStep({ onPhoto, onGallery, onFile }: { onPhoto: () => void; onGallery: () => void; onFile: () => void }) {
  const c = useColors();
  const t = useT();
  return (
    <Screen>
      <Txt tone="muted" variant="small" style={{ marginBottom: space.lg, paddingHorizontal: 2 }}>
        {t(
          'Facturi de la furnizori, bonuri, extrase sau contracte — contabilul le primește imediat, iar Tavin extrage automat datele.',
          'Supplier invoices, receipts, statements or contracts — your accountant gets them right away and Tavin extracts the data automatically.',
        )}
      </Txt>

      <Option
        icon="camera"
        title={t('Fotografiază', 'Take photo')}
        subtitle={t('Factură, bon sau extras', 'Invoice, receipt or statement')}
        onPress={onPhoto}
        primary
      />
      <View style={styles.options}>
        <Option icon="images" title={t('Din galerie', 'From gallery')} onPress={onGallery} />
        <Option icon="document-attach" title={t('PDF / fișier', 'PDF / file')} onPress={onFile} />
      </View>

      <View style={[styles.tip, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
        <IconTile icon="bulb" tone="accent" size={30} />
        <Txt variant="small" tone="soft" style={{ flex: 1 }}>
          {t(
            'Pune documentul pe o suprafață plană, cu lumină bună, și încadrează-l întreg în poză.',
            'Lay the document flat in good light and fit the whole page in the photo.',
          )}
        </Txt>
      </View>
    </Screen>
  );
}

/** Check the photos before they go: a big preview of the selected one, thumbnails to switch, remove or add. */
function ReviewStep({
  items,
  onRemove,
  onAddPhoto,
  onAddFile,
  onRetake,
  onSend,
}: {
  items: Item[];
  onRemove: (key: string) => void;
  onAddPhoto: () => void;
  onAddFile: () => void;
  onRetake: () => void;
  onSend: () => void;
}) {
  const c = useColors();
  const t = useT();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((i) => i.key === selectedKey) ?? items[items.length - 1];
  const count = items.length;
  return (
    <Screen
      footer={
        <View style={styles.footerRow}>
          <Button title={t('Refă', 'Retake')} variant="secondary" onPress={onRetake} />
          <Button
            title={
              count === 1
                ? t('Trimite contabilului', 'Send to your accountant')
                : t(`Trimite ${count} documente`, `Send ${count} documents`)
            }
            icon="arrow-up"
            onPress={onSend}
            style={{ flex: 1 }}
          />
        </View>
      }>
      <Stack.Screen options={{ title: t('Verifică', 'Check') }} />
      {selected ? (
        <View style={[styles.preview, { backgroundColor: c.surface, boxShadow: c.cardShadow }]}>
          {selected.mimeType.startsWith('image/') ? (
            <Image
              source={{ uri: selected.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              accessibilityLabel={selected.name}
            />
          ) : (
            <View style={styles.previewFile}>
              <IconTile icon="document-text" tone="accent" size={64} />
              <Txt weight="600" numberOfLines={2} style={{ textAlign: 'center' }}>
                {selected.name}
              </Txt>
            </View>
          )}
          <Pressable
            onPress={() => onRemove(selected.key)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Scoate documentul', 'Remove this document')}
            style={[styles.remove, { backgroundColor: c.overlay }]}>
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
        {items.map((it, i) => {
          const on = it.key === selected?.key;
          return (
            <Pressable
              key={it.key}
              onPress={() => setSelectedKey(it.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(`Documentul ${i + 1}`, `Document ${i + 1}`)}
              style={[
                styles.thumb,
                { backgroundColor: c.surface, borderColor: on ? c.accent : c.line, borderWidth: on ? 2.5 : 1 },
              ]}>
              {it.mimeType.startsWith('image/') ? (
                <Image source={{ uri: it.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Ionicons name="document-text" size={26} color={c.accentText} />
              )}
            </Pressable>
          );
        })}
        <Pressable
          onPress={onAddPhoto}
          accessibilityRole="button"
          accessibilityLabel={t('Mai fotografiază un document', 'Photograph another document')}
          style={[styles.thumb, styles.addThumb, { borderColor: c.faint }]}>
          <Ionicons name="camera-outline" size={22} color={c.accentText} />
        </Pressable>
        <Pressable
          onPress={onAddFile}
          accessibilityRole="button"
          accessibilityLabel={t('Adaugă un fișier', 'Add a file')}
          style={[styles.thumb, styles.addThumb, { borderColor: c.faint }]}>
          <Ionicons name="document-attach-outline" size={22} color={c.accentText} />
        </Pressable>
      </ScrollView>

      <View style={[styles.note, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="information-circle" size={18} color={c.accentText} />
        <Txt variant="footnote" weight="600" tone="accent" style={{ flex: 1 }}>
          {t(
            'Fiecare poză ajunge la contabil ca document separat. Verifică să se citească totalul.',
            'Each photo reaches your accountant as its own document. Check the total is readable.',
          )}
        </Txt>
      </View>
    </Screen>
  );
}

/** Sending, then sent: what went, what failed (with a retry), and what happens next. */
function SentStep({
  items,
  onRetry,
  onDone,
  onMore,
}: {
  items: Item[];
  onRetry: (item: Item) => void;
  onDone: () => void;
  onMore: () => void;
}) {
  const c = useColors();
  const t = useT();
  const busy = items.some((i) => i.status === 'uploading' || i.status === 'staged');
  const failed = items.filter((i) => i.status === 'error').length;
  const done = items.filter((i) => i.status === 'done').length;
  const allGood = !busy && failed === 0;
  return (
    <Screen
      footer={
        <>
          <Button title={busy ? t('Se trimite…', 'Sending…') : t('Gata', 'Done')} loading={busy} onPress={onDone} />
          {!busy ? (
            <Button title={t('Scanează încă un document', 'Scan another document')} variant="ghost" onPress={onMore} />
          ) : null}
        </>
      }>
      <Stack.Screen options={{ title: '', headerBackVisible: false, gestureEnabled: !busy }} />
      <View style={styles.sentHead} accessibilityLiveRegion="polite">
        <View
          style={[styles.sentIcon, { backgroundColor: allGood ? c.goodSoft : failed ? c.dangerSoft : c.accentSoft }]}>
          {busy ? (
            <ActivityIndicator color={c.accent} size="large" />
          ) : (
            <Ionicons name={allGood ? 'checkmark' : 'alert'} size={44} color={allGood ? c.good : c.danger} />
          )}
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>
          {busy
            ? t('Se trimite…', 'Sending…')
            : allGood
              ? t('Trimis contabilului', 'Sent to your accountant')
              : t('Nu s-au trimis toate', 'Not everything was sent')}
        </Txt>
        <Txt tone="muted" style={styles.sentText}>
          {busy
            ? t(`${done} din ${items.length} trimise`, `${done} of ${items.length} sent`)
            : allGood
              ? t(
                  'Nu mai ai nimic de făcut. Te anunțăm doar dacă contabilul are nevoie de ceva în plus.',
                  'Nothing more to do. We’ll only let you know if your accountant needs anything else.',
                )
              : t(
                  'Verifică conexiunea și încearcă din nou documentele de mai jos.',
                  'Check your connection and try the documents below again.',
                )}
        </Txt>
      </View>

      <Card padded={false}>
        {items.map((it, i) => (
          <View key={it.key}>
            {i > 0 ? <Divider inset={60} /> : null}
            <View style={styles.row}>
              <IconTile
                icon={it.mimeType.startsWith('image/') ? 'image' : 'document'}
                tone={it.status === 'error' ? 'danger' : it.status === 'done' ? 'good' : 'accent'}
              />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1}>{it.name}</Txt>
                <Txt variant="caption" tone={it.status === 'error' ? 'danger' : 'muted'} numberOfLines={2}>
                  {it.status === 'error'
                    ? it.error
                    : it.status === 'done'
                      ? t('Trimis · în procesare', 'Sent · processing')
                      : t('Se trimite…', 'Sending…')}
                </Txt>
              </View>
              {it.status === 'uploading' || it.status === 'staged' ? (
                <ActivityIndicator color={c.accent} />
              ) : it.status === 'done' ? (
                <Ionicons name="checkmark-circle" size={22} color={c.good} />
              ) : (
                <Pressable onPress={() => onRetry(it)} hitSlop={10} accessibilityRole="button">
                  <Txt variant="small" tone="accent" weight="700">
                    {t('Reîncearcă', 'Retry')}
                  </Txt>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </Card>
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
    // Taking the photo is this screen's main action: the coral tile, navy on it.
    return (
      <Tap
        onPress={onPress}
        scaleTo={0.98}
        style={[styles.primary, { backgroundColor: c.action }]}
        accessibilityRole="button">
        <View style={styles.primaryIcon}>
          <Ionicons name={icon} size={30} color={c.onAction} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading" style={{ color: c.onAction }}>
            {title}
          </Txt>
          {subtitle ? <Txt style={{ color: c.onAction, opacity: 0.78 }}>{subtitle}</Txt> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.onAction} />
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
    boxShadow: actionGlow,
  },
  primaryIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  options: { flexDirection: 'row', gap: space.md, marginTop: space.md },
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
  footerRow: { flexDirection: 'row', gap: space.sm },
  preview: { height: 380, borderRadius: radius.lg, overflow: 'hidden' },
  previewFile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  remove: {
    position: 'absolute',
    top: space.sm + 2,
    right: space.sm + 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbs: { gap: space.sm + 2, paddingVertical: space.md + 2 },
  thumb: {
    width: 64,
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: { borderWidth: 1.5, borderStyle: 'dashed' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  sentHead: { alignItems: 'center', gap: space.md, paddingTop: space.xl, paddingBottom: space.xl },
  sentIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  sentText: { textAlign: 'center', maxWidth: 320 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
  },
});
