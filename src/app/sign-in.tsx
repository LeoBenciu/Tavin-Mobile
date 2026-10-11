import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignInError, useSession } from '@/auth/session';
import { Sheet } from '@/components/Sheet';
import { Banner, Button, Field, Segmented, Txt } from '@/components/ui';
import { useLanguage, useT } from '@/i18n';
import { radius, space, useColors } from '@/theme';

export default function SignInScreen() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(t('Completează emailul și parola.', 'Enter your email and password.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof SignInError ? e.message : t('Autentificarea a eșuat.', 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.langRow, { top: insets.top + space.sm, right: space.xl }]}>
            <View style={{ width: 120 }}>
              <Segmented
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'ro', label: 'RO' },
                  { value: 'en', label: 'EN' },
                ]}
              />
            </View>
          </View>

          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: c.accent }]}>
              <Txt style={styles.logoText}>T</Txt>
            </View>
            <Txt variant="display" style={styles.center}>
              Tavin
            </Txt>
            <Txt tone="muted" style={[styles.center, { marginTop: space.xs }]}>
              {t('Firma ta și contabilul tău, în buzunar.', 'Your business and your accountant, in your pocket.')}
            </Txt>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Field
              label={t('Email', 'Email')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="nume@firma.ro"
            />
            <Field
              ref={passwordRef}
              label={t('Parolă', 'Password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              right={
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8} style={styles.eye}>
                  <Txt variant="small" tone="accent" weight="600">
                    {showPassword ? t('Ascunde', 'Hide') : t('Arată', 'Show')}
                  </Txt>
                </Pressable>
              }
            />
            {error ? <Banner tone="danger" icon="alert-circle" title={error} /> : null}
            <Button
              title={t('Intră în cont', 'Sign in')}
              onPress={submit}
              loading={busy}
              style={{ marginTop: space.md }}
            />
            <Pressable onPress={() => setHelpOpen(true)} style={styles.help} hitSlop={8}>
              <Txt variant="small" tone="accent" weight="600">
                {t('Nu ai cont sau ai uitat parola?', 'No account, or forgot your password?')}
              </Txt>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={helpOpen} onClose={() => setHelpOpen(false)} title={t('Acces în Tavin', 'Getting access')}>
        <View style={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md }}>
          <Txt tone="soft">
            {t(
              'Contul Tavin pentru firma ta îl creează contabilul tău: primești o invitație pe email, iar după ce o accepți te poți conecta aici cu același email și aceeași parolă.',
              'Your accountant creates the Tavin account for your business: you get an email invitation, and once you accept it you can sign in here with the same email and password.',
            )}
          </Txt>
          <Txt tone="soft">
            {t(
              'Dacă ai uitat parola, cere-i contabilului să îți retrimită invitația.',
              'If you forgot your password, ask your accountant to resend your invitation.',
            )}
          </Txt>
          <Button title={t('Am înțeles', 'Got it')} variant="secondary" onPress={() => setHelpOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  langRow: { position: 'absolute' },
  brand: { alignItems: 'center', marginBottom: space.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  logoText: { color: '#fff', fontSize: 34, fontWeight: '800' },
  center: { textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  eye: { paddingHorizontal: space.md },
  help: { alignSelf: 'center', marginTop: space.lg },
});
