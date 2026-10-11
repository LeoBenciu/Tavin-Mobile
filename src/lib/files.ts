import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getAccessToken } from '@/auth/tokens';
import { getLanguage } from '@/i18n';
import { API_URL } from '@/lib/config';

/** Opens a (signed) document URL in the in-app browser — PDFs and images render natively. */
export async function openUrl(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'document.pdf';
}

/** Downloads a signed URL to the cache and opens the share sheet (save, send, print). */
export async function shareRemoteFile(url: string, fileName: string, mimeType = 'application/pdf'): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
    return;
  }
  const target = new File(Paths.cache, safeFileName(fileName));
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName, UTI: 'com.adobe.pdf' });
}

/**
 * POSTs to an authenticated endpoint that streams a PDF back (e.g. the NIR
 * generator), saves it and opens the share sheet.
 */
export async function postForPdf(path: string, body: unknown, fileName: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/pdf',
      'Accept-Language': getLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, data: err };
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (Platform.OS === 'web') {
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(blobUrl, '_blank');
    return;
  }
  const file = new File(Paths.cache, safeFileName(fileName));
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
}

export type LocalFile = { uri: string; name: string; mimeType: string };

/** Multipart upload of a photo/PDF picked on the phone. */
export async function uploadFile(path: string, file: LocalFile, fieldName = 'file'): Promise<unknown> {
  const token = await getAccessToken();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(fieldName, blob, file.name);
  } else {
    // React Native's FormData streams the file from its URI.
    form.append(fieldName, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': getLanguage(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}
