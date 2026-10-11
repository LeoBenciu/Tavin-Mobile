import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  useCreateArticleMutation,
  useDeleteArticleMutation,
  useGetArticlesQuery,
  useUpdateArticleMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { Article } from '@/api/types';
import { Screen } from '@/components/Screen';
import { PickerSheet } from '@/components/Sheet';
import { Banner, Button, Card, Chip, ErrorState, Field, Loading, SelectField, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import { ARTICLE_TYPES, ARTICLE_VAT_OPTIONS, articleTypeLabel, UNITS, unitLabel } from '@/lib/domain';
import { space } from '@/theme';

export default function ArticleEditScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const { data: articles, isLoading } = useGetArticlesQuery();
  const existing = id != null ? articles?.find((a) => a.id === id) : undefined;
  if (id != null && !existing) {
    return <Screen>{isLoading ? <Loading /> : <ErrorState message="404" />}</Screen>;
  }
  // Keyed so the form's initial state comes from the article being edited.
  return <ArticleForm key={existing?.id ?? 'new'} id={id} existing={existing} />;
}

function ArticleForm({ id, existing }: { id: number | null; existing?: Article }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? '');
  const [code, setCode] = useState(existing?.code ?? '');
  const [type, setType] = useState(existing?.type ?? 'MARFURI');
  const [unit, setUnit] = useState(existing?.unitOfMeasure ?? 'BUCATA');
  const [vat, setVat] = useState(existing?.vat ?? 'TWENTYONE');
  const [picker, setPicker] = useState<'type' | 'unit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [create, { isLoading: creating }] = useCreateArticleMutation();
  const [update, { isLoading: updating }] = useUpdateArticleMutation();
  const [remove] = useDeleteArticleMutation();

  const save = async () => {
    if (!name.trim()) {
      setError(t('Completează denumirea.', 'Enter the name.'));
      return;
    }
    setError(null);
    const data = { name: name.trim(), code: code.trim() || undefined, type, unitOfMeasure: unit, vat };
    try {
      if (id != null) await update({ id, data }).unwrap();
      else await create(data).unwrap();
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const del = async () => {
    if (id == null) return;
    if (
      !(await confirm(t('Ștergi articolul?', 'Delete this item?'), name, {
        destructive: true,
        confirmLabel: t('Șterge', 'Delete'),
      }))
    )
      return;
    try {
      await remove(id).unwrap();
      router.back();
    } catch (e) {
      notify(t('Nu am putut șterge', 'Couldn’t delete'), errorMessage(e));
    }
  };

  return (
    <Screen
      keyboard
      footer={<Button title={t('Salvează', 'Save')} icon="checkmark" onPress={save} loading={creating || updating} />}>
      <Stack.Screen
        options={{ title: id != null ? t('Editează articol', 'Edit item') : t('Articol nou', 'New item') }}
      />
      {error ? (
        <View style={{ marginBottom: space.md }}>
          <Banner tone="danger" icon="alert-circle" title={error} />
        </View>
      ) : null}
      <Card>
        <Field
          label={t('Denumire', 'Name')}
          value={name}
          onChangeText={setName}
          placeholder={t('ex. Consultanță', 'e.g. Consulting')}
        />
        <Field
          label={t('Cod (opțional)', 'Code (optional)')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
        <SelectField
          label={t('Tip', 'Type')}
          value={articleTypeLabel(t, type)}
          placeholder=""
          onPress={() => setPicker('type')}
        />
        <SelectField
          label={t('Unitate de măsură', 'Unit of measure')}
          value={unitLabel(t, unit)}
          placeholder=""
          onPress={() => setPicker('unit')}
        />
        <Txt variant="small" tone="soft" weight="500" style={{ marginBottom: 6 }}>
          {t('Cotă TVA', 'VAT rate')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {ARTICLE_VAT_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={vat === o.value} onPress={() => setVat(o.value)} />
          ))}
        </View>
      </Card>
      {id != null ? (
        <Button
          title={t('Șterge articolul', 'Delete item')}
          variant="danger"
          icon="trash-outline"
          onPress={del}
          style={{ marginTop: space.xl }}
        />
      ) : null}

      <PickerSheet
        visible={picker === 'type'}
        onClose={() => setPicker(null)}
        title={t('Tip articol', 'Item type')}
        items={ARTICLE_TYPES}
        keyOf={(a) => a.value}
        labelOf={(a) => t(a.ro, a.en)}
        selectedKey={type}
        onSelect={(a) => setType(a.value)}
      />
      <PickerSheet
        visible={picker === 'unit'}
        onClose={() => setPicker(null)}
        title={t('Unitate de măsură', 'Unit of measure')}
        items={UNITS}
        keyOf={(u) => u.value}
        labelOf={(u) => t(u.ro, u.en)}
        selectedKey={unit}
        onSelect={(u) => setUnit(u.value)}
      />
    </Screen>
  );
}
