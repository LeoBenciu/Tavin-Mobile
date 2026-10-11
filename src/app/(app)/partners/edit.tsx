import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  useCreatePartnerMutation,
  useDeletePartnerMutation,
  useGetPartnersQuery,
  useLookupCompanyMutation,
  useUpdatePartnerMutation,
  type PartnerKind,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import type { Partner } from '@/api/types';
import { Screen } from '@/components/Screen';
import { Banner, Button, Card, ErrorState, Field, Loading, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { confirm, notify } from '@/lib/confirm';
import { nextNumericCode } from '@/lib/domain';
import { space } from '@/theme';

type Form = {
  code: string;
  name: string;
  ein: string;
  address: string;
  localitate: string;
  judet: string;
  email: string;
  phone: string;
};
const EMPTY: Form = { code: '', name: '', ein: '', address: '', localitate: '', judet: '', email: '', phone: '' };

function toForm(p?: Partner): Form {
  if (!p) return EMPTY;
  return {
    code: p.code ?? '',
    name: p.name ?? '',
    ein: p.ein ?? '',
    address: p.address ?? '',
    localitate: p.localitate ?? '',
    judet: p.judet ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
  };
}

export default function PartnerEditScreen() {
  const params = useLocalSearchParams<{ kind: PartnerKind; id?: string }>();
  const kind: PartnerKind = params.kind === 'suppliers' ? 'suppliers' : 'clients';
  const id = params.id ? Number(params.id) : null;
  const { data: partners, isLoading } = useGetPartnersQuery(kind);
  const existing = id != null ? partners?.find((p) => p.id === id) : undefined;
  if (id != null && !existing) {
    return <Screen>{isLoading ? <Loading /> : <ErrorState message="404" />}</Screen>;
  }
  // Keyed so the form's initial state comes from the partner being edited.
  return (
    <PartnerForm
      key={`${kind}-${existing?.id ?? 'new'}`}
      kind={kind}
      id={id}
      existing={existing}
      partners={partners ?? []}
    />
  );
}

function PartnerForm({
  kind,
  id,
  existing,
  partners,
}: {
  kind: PartnerKind;
  id: number | null;
  existing?: Partner;
  partners: Partner[];
}) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(existing));
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookup, { isLoading: looking }] = useLookupCompanyMutation();
  const [create, { isLoading: creating }] = useCreatePartnerMutation();
  const [update, { isLoading: updating }] = useUpdatePartnerMutation();
  const [remove] = useDeletePartnerMutation();

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fromAnaf = async () => {
    const cui = form.ein.replace(/\s/g, '').replace(/^RO/i, '');
    if (!/^\d{2,10}$/.test(cui)) {
      setLookupMsg(t('CUI-ul are doar cifre (2–10).', 'The tax ID has only digits (2–10).'));
      return;
    }
    try {
      const r = await lookup(cui).unwrap();
      setForm((f) => ({
        ...f,
        name: r.name || f.name,
        ein: r.isVatPayer ? `RO${cui}` : cui,
        address: r.legalAddress ?? f.address,
        localitate: r.city ?? f.localitate,
        judet: r.county ?? f.judet,
        email: f.email || r.email || '',
        phone: f.phone || r.phoneNumber || '',
      }));
      setLookupMsg(t('Date completate de la ANAF.', 'Filled in from ANAF.'));
    } catch (e) {
      setLookupMsg(errorMessage(e, t('Firma nu a fost găsită la ANAF.', 'Company not found at ANAF.')));
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError(t('Completează denumirea.', 'Enter the name.'));
      return;
    }
    setError(null);
    const data = {
      name: form.name.trim(),
      ein: form.ein.trim() || undefined,
      address: form.address.trim() || undefined,
      localitate: form.localitate.trim() || undefined,
      judet: form.judet.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
    };
    try {
      if (id != null) {
        await update({ kind, id, data: { ...data, code: form.code.trim() || undefined } }).unwrap();
      } else {
        await create({ kind, data: { ...data, code: form.code.trim() || nextNumericCode(partners) } }).unwrap();
      }
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const del = async () => {
    if (id == null) return;
    if (
      !(await confirm(t('Ștergi partenerul?', 'Delete this partner?'), form.name, {
        destructive: true,
        confirmLabel: t('Șterge', 'Delete'),
      }))
    )
      return;
    try {
      await remove({ kind, id }).unwrap();
      router.back();
    } catch (e) {
      notify(t('Nu am putut șterge', 'Couldn’t delete'), errorMessage(e));
    }
  };

  const title =
    id != null
      ? form.name || t('Partener', 'Partner')
      : kind === 'clients'
        ? t('Client nou', 'New client')
        : t('Furnizor nou', 'New supplier');

  return (
    <Screen
      keyboard
      footer={<Button title={t('Salvează', 'Save')} icon="checkmark" onPress={save} loading={creating || updating} />}>
      <Stack.Screen options={{ title }} />
      {error ? (
        <View style={{ marginBottom: space.md }}>
          <Banner tone="danger" icon="alert-circle" title={error} />
        </View>
      ) : null}
      <Card>
        <Field
          label={t('CUI', 'Tax ID (CUI)')}
          value={form.ein}
          onChangeText={(v) => set('ein', v)}
          autoCapitalize="characters"
          placeholder="RO12345678"
          hint={lookupMsg ?? t('Scrie CUI-ul și apasă „Caută ANAF”.', 'Type the tax ID and tap “Look up”.')}
          right={
            <Pressable onPress={fromAnaf} style={styles.lookup} hitSlop={6}>
              <Txt variant="small" tone="accent" weight="600">
                {looking ? t('Caut…', 'Searching…') : t('Caută ANAF', 'Look up')}
              </Txt>
            </Pressable>
          }
        />
        <Field label={t('Denumire', 'Name')} value={form.name} onChangeText={(v) => set('name', v)} />
        <Field label={t('Adresă', 'Address')} value={form.address} onChangeText={(v) => set('address', v)} />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Field label={t('Localitate', 'City')} value={form.localitate} onChangeText={(v) => set('localitate', v)} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('Județ', 'County')} value={form.judet} onChangeText={(v) => set('judet', v)} />
          </View>
        </View>
        <Field
          label={t('Email', 'Email')}
          value={form.email}
          onChangeText={(v) => set('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label={t('Telefon', 'Phone')}
          value={form.phone}
          onChangeText={(v) => set('phone', v)}
          keyboardType="phone-pad"
        />
        <Field
          label={t('Cod intern', 'Internal code')}
          value={form.code}
          onChangeText={(v) => set('code', v)}
          placeholder={id == null ? nextNumericCode(partners) : undefined}
          hint={
            id == null
              ? t('Se generează automat dacă îl lași gol.', 'Generated automatically if left empty.')
              : undefined
          }
        />
      </Card>
      {id != null ? (
        <Button
          title={t('Șterge partenerul', 'Delete partner')}
          variant="danger"
          icon="trash-outline"
          onPress={del}
          style={{ marginTop: space.xl }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: space.md },
  lookup: { paddingHorizontal: space.md },
});
