import { Alert, Platform } from 'react-native';

import { translate } from '@/i18n';

/** Native confirm dialog; resolves true when the user accepts. */
export function confirm(
  title: string,
  message: string,
  opts: { confirmLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: translate('Renunță', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: opts.confirmLabel ?? translate('Confirmă', 'Confirm'),
          style: opts.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
