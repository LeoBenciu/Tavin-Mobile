# Tavin Mobile

The Tavin app for businesses (the clients of accounting firms that use [tavin.eu](https://tavin.eu)).
React Native + Expo, one codebase for iOS and Android, on the **same backend as tavin.eu**
(`LeoBenciu/Finova`, `server/finova`). Business users sign in with the same email and password
as the web client portal.

## What it does

| Area | Screens |
| --- | --- |
| Home | Bank balance, receivables, bills to pay, VAT due, this month's revenue and expenses, next tax deadline, tasks, balance owed to the accountant, recent activity |
| Documents | Snap invoices/receipts with the camera, pick photos or PDFs, upload queue with retry; list of uploaded and booked documents, view file, retry/cancel, delete |
| NIR | Create the goods receipt (notă de recepție) from an incoming invoice, edit received quantities, warehouse (gestiune) per line or for all, committee; save, export/share PDF |
| Invoicing | List with filters/search; new invoice / proforma / aviz with client picker, ANAF CUI lookup, saved items, free lines, VAT, discount, warehouse, series/number, due date, currency, e-Factura auto-submit and email; detail with PDF view/share, email, SPV submit/resend/status, record payment, receipt (chitanță), credit note (storno), duplicate, cancel, delete, issue draft |
| Approvals | e-Factura fraud-guard confirmations: approve, reject, unknown supplier, issued by mistake, ask for clarification, cost centre |
| Messages | Chat with the accounting firm (read receipts, optimistic send) |
| More | Bills to pay, bank accounts and transactions, reports (profit, cash flow, VAT, sales per client, expenses), tasks, notifications, clients and suppliers (with ANAF lookup), items, stock, balance with the accountant, settings |
| Account | Profile, password, Romanian/English, push on/off, Face ID / fingerprint lock, sign out |

Push notifications: messages from the accountant, invoices to confirm, new tasks, and every other
portal notification. Tapping one opens the matching screen.

## Run it

```bash
npm install
npx expo start            # then press i / a, or scan the QR code with a dev build
```

The app talks to production (`https://finova-6eeu.onrender.com`) unless you point it elsewhere:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start
```

Checks:

```bash
npx tsc --noEmit
npx expo lint
```

## Builds and push notifications

Builds use EAS (`eas.json`). Before the first build:

1. `npx eas-cli@latest init` — links the project and writes `extra.eas.projectId` to `app.json`.
   **Push tokens are only issued once a projectId exists.**
2. Configure credentials: APNs key for iOS, FCM (Google Services) for Android — `eas credentials`.
3. `npx eas-cli@latest build --profile preview --platform all`

Native modules (camera, secure store, biometrics, notifications) need a development build,
not Expo Go: `npx eas-cli@latest build --profile development`.

## Backend requirements

The app relies on the `mobile` module in the backend (migration `20261010150000_mobile_app`):

- `POST /mobile/auth/login|refresh|logout` — rotating refresh tokens (stored hashed), 1-hour access tokens
- `GET /mobile/me`, `GET /mobile/config` (version gate), `POST /mobile/devices[/unregister]`
- Push goes through the Expo push service. Backend env: `MOBILE_PUSH_ENABLED=false` to turn it off,
  optional `EXPO_ACCESS_TOKEN`, and `MOBILE_MIN_SUPPORTED_VERSION` / `MOBILE_LATEST_VERSION` /
  `MOBILE_IOS_STORE_URL` / `MOBILE_ANDROID_STORE_URL` for the update prompt.

Everything else is the existing client-portal, invoices and stock API.

## Layout

```
src/app/            routes (expo-router): sign-in, (app)/(tabs)/…, detail screens
src/api/            RTK Query API (api.ts), base query with token refresh, types
src/auth/           session, token storage (Keychain/Keystore), app lock
src/components/     UI kit, sheets/pickers, charts
src/features/       push notifications
src/lib/            formatting, domain rules (VAT, units, statuses), NIR helpers, files
src/i18n/           ro/en — strings are written inline as t('ro', 'en')
src/theme/          colors (same palette as tavin.eu), spacing, type
```
