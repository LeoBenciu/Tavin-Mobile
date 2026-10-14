import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignInError, useSession } from '@/auth/session';
import { GlassChip, LogoMark, NavyBackdrop, Wordmark } from '@/components/Hero';
import { Sheet } from '@/components/Sheet';
import { Banner, Button, Field, Txt } from '@/components/ui';
import { useLanguage, useT, type Language } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { navy, radius, space, useColors } from '@/theme';

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
      haptic.warning();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof SignInError ? e.message : t('Autentificarea a eșuat.', 'Sign-in failed.'));
      haptic.warning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <NavyBackdrop style={{ flex: 1 }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space.xxl + space.lg, paddingBottom: insets.bottom + space.xl },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.langRow, { top: insets.top + space.sm }]}>
            <LanguageToggle value={language} onChange={setLanguage} />
          </View>

          <View style={styles.brand}>
            <LogoMark size={68} />
            <View style={styles.title}>
              <Wordmark height={36} />
            </View>
            <Text style={styles.tagline}>
              {t('Firma ta și contabilul tău, în buzunar.', 'Your business and your accountant, in your pocket.')}
            </Text>
            <View style={{ marginTop: space.lg, alignSelf: 'center' }}>
              <GlassChip label={t('Contabil autorizat CECCAR, dedicat', 'A dedicated CECCAR-certified accountant')} />
            </View>
          </View>

          <View
            style={[styles.card, { backgroundColor: c.surface, boxShadow: '0px 40px 80px -40px rgba(0, 0, 0, 0.8)' }]}>
            <Txt variant="heading" style={{ marginBottom: space.lg }}>
              {t('Intră în cont', 'Sign in')}
            </Txt>
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
            {error ? (
              <View style={{ marginBottom: space.md }}>
                <Banner tone="danger" icon="alert" title={error} />
              </View>
            ) : null}
            <Button title={t('Intră în cont', 'Sign in')} icon="arrow-forward" onPress={submit} loading={busy} />
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
    </NavyBackdrop>
  );
}

/** RO / EN switch in glass, as on the landing page's nav (.lp-lang). */
function LanguageToggle({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  return (
    <View style={styles.lang}>
      {(['ro', 'en'] as const).map((l) => {
        const on = value === l;
        return (
          <Pressable
            key={l}
            onPress={() => {
              if (!on) haptic.selection();
              onChange(l);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.langItem, on && styles.langItemOn]}>
            <Text style={[styles.langText, on && { opacity: 1 }]}>{l.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: space.lg + 4,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  langRow: { position: 'absolute', right: space.lg + 4 },
  lang: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: navy.glassLine,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  langItem: { minWidth: 40, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  langItemOn: { backgroundColor: navy.glassStrong },
  langText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, opacity: 0.62 },
  brand: { alignItems: 'center', marginBottom: space.xxl },
  title: { marginTop: space.lg + 4, marginBottom: space.sm, alignItems: 'center' },
  tagline: { marginTop: space.xs, color: navy.onNavySoft, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  card: { borderRadius: radius.xl, padding: space.xl - 2 },
  eye: { paddingHorizontal: space.md },
  help: { alignSelf: 'center', marginTop: space.lg + 2, paddingVertical: 2 },
});
