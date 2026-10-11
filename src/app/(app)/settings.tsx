import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import {
  useChangePasswordMutation,
  useGetProfileQuery,
  useRegisterDeviceMutation,
  useUnregisterDeviceMutation,
  useUpdateProfileMutation,
} from '@/api/api';
import { errorMessage } from '@/api/baseQuery';
import { canUseBiometrics, isBiometricLockEnabled, setBiometricLockEnabled } from '@/auth/AppLock';
import { useSession, useUser } from '@/auth/session';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Button, Card, Divider, Field, ListRow, Segmented, SectionTitle, ToggleRow, Txt } from '@/components/ui';
import { getPushRegistration, isPushEnabledByUser, setPushEnabledByUser } from '@/features/push';
import { useLanguage, useT } from '@/i18n';
import { APP_VERSION, WEB_APP_URL } from '@/lib/config';
import { confirm, notify } from '@/lib/confirm';
import { openUrl } from '@/lib/files';
import { storage, StorageKeys } from '@/lib/storage';
import { space } from '@/theme';

export default function SettingsScreen() {
  const t = useT();
  const user = useUser();
  const { signOut, updateUser } = useSession();
  const { language, setLanguage } = useLanguage();
  const { data: profile } = useGetProfileQuery();
  const [updateProfile, { isLoading: savingProfile }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: savingPassword }] = useChangePasswordMutation();
  const [registerDevice] = useRegisterDeviceMutation();
  const [unregisterDevice] = useUnregisterDeviceMutation();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [push, setPush] = useState(true);

  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [profilePassword, setProfilePassword] = useState('');

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  useEffect(() => {
    canUseBiometrics().then(setBiometricAvailable);
    isBiometricLockEnabled().then(setBiometric);
    isPushEnabledByUser().then(setPush);
  }, []);

  const toggleBiometric = async (on: boolean) => {
    setBiometric(on);
    await setBiometricLockEnabled(on);
  };

  const togglePush = async (on: boolean) => {
    setPush(on);
    await setPushEnabledByUser(on);
    if (on) {
      const reg = await getPushRegistration(true);
      if (reg)
        await registerDevice(reg)
          .unwrap()
          .catch(() => undefined);
      else
        notify(
          t('Notificările sunt oprite', 'Notifications are off'),
          t(
            'Permite notificările pentru Tavin din Setările telefonului.',
            'Allow notifications for Tavin in your phone’s Settings.',
          ),
        );
    } else {
      const token = await storage.get(StorageKeys.pushToken);
      if (token)
        await unregisterDevice({ pushToken: token })
          .unwrap()
          .catch(() => undefined);
    }
  };

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();

  const saveProfile = async () => {
    try {
      const res = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phone.trim(),
        ...(emailChanged ? { currentPassword: profilePassword } : {}),
      }).unwrap();
      updateUser({ name: res.name, email: res.email, phoneNumber: res.phoneNumber });
      setProfileOpen(false);
      setProfilePassword('');
    } catch (e) {
      notify(t('Nu am putut salva', 'Couldn’t save'), errorMessage(e));
    }
  };

  const savePassword = async () => {
    // Same rules as the portal's Security tab (enforced by the server too).
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      notify(
        t('Parolă prea slabă', 'Password too weak'),
        t(
          'Minim 8 caractere, o majusculă, o cifră și un caracter special.',
          'At least 8 characters, an uppercase letter, a digit and a special character.',
        ),
      );
      return;
    }
    if (newPassword !== repeatPassword) {
      notify(t('Parolele nu coincid', 'Passwords don’t match'));
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      notify(t('Parola a fost schimbată', 'Password changed'));
    } catch (e) {
      notify(t('Nu am putut schimba parola', 'Couldn’t change the password'), errorMessage(e));
    }
  };

  return (
    <Screen>
      <SectionTitle title={t('Profil', 'Profile')} />
      <Card padded={false}>
        <ListRow icon="person-outline" title={user.name} subtitle={user.email} onPress={() => setProfileOpen(true)} />
        <Divider inset={64} />
        <ListRow
          icon="key-outline"
          title={t('Schimbă parola', 'Change password')}
          onPress={() => setPasswordOpen(true)}
        />
      </Card>

      <SectionTitle title={t('Firma', 'Company')} />
      <Card padded={false}>
        <ListRow
          icon="business-outline"
          title={user.clientCompany.name}
          subtitle={profile ? `CUI ${profile.clientCompany.ein}` : undefined}
          chevron={false}
        />
        <Divider inset={64} />
        <ListRow
          icon="briefcase-outline"
          title={user.accountingCompany.name}
          subtitle={t('Contabilul tău', 'Your accountant')}
          chevron={false}
        />
      </Card>

      <SectionTitle title={t('Aplicație', 'App')} />
      <Card>
        <Txt variant="small" tone="soft" weight="500" style={{ marginBottom: 6 }}>
          {t('Limbă', 'Language')}
        </Txt>
        <Segmented
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'ro', label: 'Română' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>
      <Card padded={false} style={{ marginTop: space.md }}>
        {Platform.OS !== 'web' ? (
          <ToggleRow
            icon="notifications-outline"
            title={t('Notificări push', 'Push notifications')}
            subtitle={t('Mesaje, facturi de confirmat, sarcini', 'Messages, invoices to confirm, tasks')}
            value={push}
            onValueChange={togglePush}
          />
        ) : null}
        {biometricAvailable ? (
          <>
            <Divider inset={64} />
            <ToggleRow
              icon="finger-print"
              title={t('Blocare cu Face ID / amprentă', 'Lock with Face ID / fingerprint')}
              subtitle={t('Cere deblocarea la deschiderea aplicației', 'Ask to unlock when the app opens')}
              value={biometric}
              onValueChange={toggleBiometric}
            />
          </>
        ) : null}
        <Divider inset={64} />
        <ListRow
          icon="globe-outline"
          title={t('Portalul web', 'Web portal')}
          subtitle="tavin.eu"
          onPress={() => openUrl(WEB_APP_URL)}
        />
      </Card>

      <Button
        title={t('Deconectare', 'Sign out')}
        variant="danger"
        icon="log-out-outline"
        style={{ marginTop: space.xl }}
        onPress={async () => {
          if (
            await confirm(
              t('Te deconectezi?', 'Sign out?'),
              t('Nu vei mai primi notificări pe acest telefon.', 'This phone will stop receiving notifications.'),
              { confirmLabel: t('Deconectare', 'Sign out') },
            )
          ) {
            await signOut();
          }
        }}
      />
      <Txt variant="caption" tone="muted" style={{ textAlign: 'center', marginTop: space.lg }}>
        Tavin {APP_VERSION}
      </Txt>

      <Sheet visible={profileOpen} onClose={() => setProfileOpen(false)} title={t('Profil', 'Profile')}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Field label={t('Nume', 'Name')} value={name} onChangeText={setName} />
          <Field
            label={t('Email', 'Email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field label={t('Telefon', 'Phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          {emailChanged ? (
            <Field
              label={t('Parola actuală (pentru schimbarea emailului)', 'Current password (to change email)')}
              value={profilePassword}
              onChangeText={setProfilePassword}
              secureTextEntry
            />
          ) : null}
          <Button title={t('Salvează', 'Save')} loading={savingProfile} onPress={saveProfile} />
        </View>
      </Sheet>

      <Sheet
        visible={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={t('Schimbă parola', 'Change password')}>
        <View style={{ paddingHorizontal: space.lg }}>
          <Field
            label={t('Parola actuală', 'Current password')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <Field
            label={t('Parola nouă', 'New password')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
            hint={t(
              'Minim 8 caractere, o majusculă, o cifră și un caracter special.',
              'At least 8 characters, an uppercase letter, a digit and a special character.',
            )}
          />
          <Field
            label={t('Repetă parola nouă', 'Repeat new password')}
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
            autoComplete="new-password"
          />
          <Button title={t('Schimbă parola', 'Change password')} loading={savingPassword} onPress={savePassword} />
        </View>
      </Sheet>
    </Screen>
  );
}
