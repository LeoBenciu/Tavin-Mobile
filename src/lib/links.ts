import type { Href } from 'expo-router';

/**
 * Notifications carry the web portal's route (e.g. /client/messages); map it
 * to the matching screen in the app.
 */
export function appRouteForLink(link: string | null | undefined): Href {
  const path = String(link ?? '').split('?')[0];
  if (path.startsWith('/client/invoice-approvals')) return '/approvals';
  if (path.startsWith('/client/messages')) return '/messages';
  if (path.startsWith('/client/tasks')) return '/tasks';
  if (path.startsWith('/client/documents') || path.startsWith('/client/company-documents')) return '/documents';
  if (path.startsWith('/client/invoicing')) return '/invoices';
  if (path.startsWith('/client/bills')) return '/bills';
  if (path.startsWith('/client/bank')) return '/bank';
  if (path.startsWith('/client/reports')) return '/reports';
  if (path.startsWith('/client/stocks')) return '/stock';
  if (path.startsWith('/client/dashboard')) return '/';
  return '/notifications';
}
