import { createApi } from '@reduxjs/toolkit/query/react';

import { clientCompanyId, clientUserId as cu } from '@/auth/current';
import { baseQuery } from './baseQuery';
import type {
  AnafCompany,
  AppNotification,
  Article,
  ArticleInput,
  BankResponse,
  BillsResponse,
  CashFlowReport,
  ClientTask,
  ConfirmationAction,
  ConversationsResponse,
  Dashboard,
  DocumentsResponse,
  ExpensesByCategoryReport,
  FileUrl,
  FirmBalance,
  Health,
  InvoiceConfirmation,
  InvoiceList,
  InvoiceSequence,
  InvoiceSettings,
  IssuedInvoice,
  Management,
  MobileConfig,
  NewInvoice,
  NirData,
  NirResponse,
  Partner,
  PartnerInput,
  PnlReport,
  Profile,
  ReportsOverview,
  SalesPerClientReport,
  StockBalance,
  TaskStatus,
  VatDue,
  VatReport,
} from './types';

export type PartnerKind = 'clients' | 'suppliers';
export type Period = { startDate: string; endDate: string };

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Profile',
    'Dashboard',
    'Notifications',
    'Approvals',
    'Documents',
    'Invoices',
    'Invoice',
    'Sequences',
    'Partners',
    'Articles',
    'Managements',
    'Stock',
    'Messages',
    'Tasks',
    'Reports',
  ],
  // Data shown on the phone should catch up when the app comes back to the foreground.
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    // ── Session ──
    getConfig: build.query<MobileConfig, void>({ query: () => '/mobile/config' }),
    getProfile: build.query<Profile, void>({ query: () => '/mobile/me', providesTags: ['Profile'] }),
    updateProfile: build.mutation<
      { id: number; email: string; name: string; phoneNumber: string | null },
      { name: string; email: string; phoneNumber: string; currentPassword?: string }
    >({
      query: (body) => ({ url: '/client-portal/account/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
    changePassword: build.mutation<{ ok: true }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/client-portal/account/password', method: 'PATCH', body }),
    }),
    registerDevice: build.mutation<
      unknown,
      { pushToken: string; platform: 'ios' | 'android'; appVersion?: string; locale?: string; deviceName?: string }
    >({ query: (body) => ({ url: '/mobile/devices', method: 'POST', body }) }),
    unregisterDevice: build.mutation<unknown, { pushToken: string }>({
      query: (body) => ({ url: '/mobile/devices/unregister', method: 'POST', body }),
    }),

    // ── Dashboard ──
    getDashboard: build.query<Dashboard, void>({
      query: () => ({ url: '/client-portal/dashboard', params: { clientUserId: cu() } }),
      providesTags: ['Dashboard'],
    }),
    getVatDue: build.query<VatDue, void>({
      query: () => ({ url: '/client-portal/vat-due', params: { clientUserId: cu() } }),
      providesTags: ['Dashboard'],
    }),
    getFirmBalance: build.query<FirmBalance, void>({
      query: () => ({ url: '/client-portal/firm-balance', params: { clientUserId: cu() } }),
      providesTags: ['Dashboard'],
    }),
    getHealth: build.query<Health, void>({
      query: () => ({ url: '/client-portal/health', params: { clientUserId: cu() } }),
      providesTags: ['Dashboard'],
    }),

    // ── Notifications ──
    getNotifications: build.query<{ items: AppNotification[]; unreadCount: number }, void>({
      query: () => ({ url: '/notifications', params: { limit: 50 } }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation<unknown, number>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: build.mutation<unknown, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),

    // ── e-Factura approvals (fraud guard) ──
    getApprovals: build.query<{ data: InvoiceConfirmation[] }, void>({
      query: () => ({ url: '/invoice-confirmations/client/inbox', params: { clientUserId: cu() } }),
      providesTags: ['Approvals'],
    }),
    getCostCenters: build.query<{ id: number; code: string; name: string }[], void>({
      query: () => ({ url: '/invoice-confirmations/cost-centers', params: { clientUserId: cu(), activeOnly: 'true' } }),
    }),
    respondApproval: build.mutation<
      { status: string; alreadyResolved?: boolean },
      { id: number; action: ConfirmationAction; note?: string; costCenterId?: number | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/invoice-confirmations/client/${id}/respond`,
        method: 'POST',
        body: { ...body, clientUserId: cu() },
      }),
      invalidatesTags: ['Approvals', 'Notifications', 'Documents'],
    }),

    // ── Documents ──
    getDocuments: build.query<DocumentsResponse, void>({
      query: () => ({ url: '/client-portal/documents', params: { clientUserId: cu() } }),
      providesTags: ['Documents'],
    }),
    retryUpload: build.mutation<unknown, number>({
      query: (id) => ({ url: `/client-portal/documents/${id}/retry`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: ['Documents'],
    }),
    cancelUpload: build.mutation<unknown, number>({
      query: (id) => ({ url: `/client-portal/documents/${id}`, method: 'DELETE', params: { clientUserId: cu() } }),
      invalidatesTags: ['Documents'],
    }),
    deleteSavedDocument: build.mutation<unknown, number>({
      query: (id) => ({
        url: `/client-portal/documents/saved/${id}`,
        method: 'DELETE',
        params: { clientUserId: cu() },
      }),
      invalidatesTags: ['Documents', 'Dashboard'],
    }),
    getPendingUploadUrl: build.query<FileUrl, number>({
      query: (id) => ({ url: `/client-portal/documents/pending/${id}/view-url`, params: { clientUserId: cu() } }),
    }),
    getDocumentUrl: build.query<FileUrl, number>({
      query: (id) => ({ url: `/client-portal/bills/${id}/view-url`, params: { clientUserId: cu() } }),
    }),

    // ── NIR (notă de recepție) ──
    getNirForInvoice: build.query<NirResponse, number>({
      query: (invoiceDocumentId) => ({
        url: `/client-portal/documents/incoming-invoice/${invoiceDocumentId}/nir`,
        params: { clientUserId: cu() },
      }),
      keepUnusedDataFor: 0,
    }),
    saveUploadAndCreateNir: build.mutation<NirResponse, number>({
      query: (uploadId) => ({
        url: `/client-portal/pending-uploads/${uploadId}/save-and-nir`,
        method: 'POST',
        params: { clientUserId: cu() },
      }),
      invalidatesTags: ['Documents'],
    }),
    updateNir: build.mutation<NirResponse, { nirDocumentId: number; nirData: NirData }>({
      query: ({ nirDocumentId, nirData }) => ({
        url: `/client-portal/documents/nir/${nirDocumentId}`,
        method: 'PATCH',
        params: { clientUserId: cu() },
        body: { nirData },
      }),
      invalidatesTags: ['Documents', 'Stock'],
    }),

    // ── Invoicing ──
    getInvoices: build.query<
      InvoiceList,
      { status?: string; invoiceType?: string; search?: string; page?: number; limit?: number }
    >({
      query: (p) => ({
        url: '/invoices',
        params: {
          clientUserId: cu(),
          ...(p.status ? { status: p.status } : {}),
          ...(p.invoiceType ? { invoiceType: p.invoiceType } : {}),
          ...(p.search ? { search: p.search } : {}),
          page: p.page ?? 1,
          limit: p.limit ?? 30,
        },
      }),
      providesTags: ['Invoices'],
    }),
    getInvoice: build.query<IssuedInvoice, number>({
      query: (id) => ({ url: `/invoices/${id}`, params: { clientUserId: cu() } }),
      providesTags: (_r, _e, id) => [{ type: 'Invoice', id }],
    }),
    createInvoice: build.mutation<{ id: number; series: string; number: number }, NewInvoice>({
      query: (body) => ({ url: '/invoices', method: 'POST', params: { clientUserId: cu() }, body }),
      invalidatesTags: ['Invoices', 'Sequences', 'Dashboard', 'Stock'],
    }),
    issueInvoice: build.mutation<unknown, number>({
      query: (id) => ({ url: `/invoices/${id}/issue`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => ['Invoices', 'Dashboard', 'Sequences', { type: 'Invoice', id }],
    }),
    deleteInvoice: build.mutation<unknown, number>({
      query: (id) => ({ url: `/invoices/${id}`, method: 'DELETE', params: { clientUserId: cu() } }),
      invalidatesTags: ['Invoices', 'Dashboard', 'Sequences'],
    }),
    cancelInvoice: build.mutation<unknown, number>({
      query: (id) => ({ url: `/invoices/${id}/cancel`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => ['Invoices', 'Dashboard', 'Stock', { type: 'Invoice', id }],
    }),
    duplicateInvoice: build.mutation<{ id: number; series: string; number: number }, number>({
      query: (id) => ({ url: `/invoices/${id}/duplicate`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: ['Invoices', 'Sequences'],
    }),
    recordPayment: build.mutation<unknown, { id: number; amount: number; paymentDate?: string; notes?: string }>({
      query: ({ id, ...body }) => ({
        url: `/invoices/${id}/payment`,
        method: 'POST',
        params: { clientUserId: cu() },
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => ['Invoices', 'Dashboard', { type: 'Invoice', id }],
    }),
    createCreditNote: build.mutation<{ id: number; series: string; number: number }, { id: number; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/invoices/${id}/credit-note`,
        method: 'POST',
        params: { clientUserId: cu() },
        body: { originalInvoiceId: id, reason },
      }),
      invalidatesTags: (_r, _e, { id }) => ['Invoices', 'Dashboard', 'Sequences', { type: 'Invoice', id }],
    }),
    sendInvoiceEmail: build.mutation<unknown, number>({
      query: (id) => ({ url: `/invoices/${id}/send-email`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Invoice', id }],
    }),
    submitEfactura: build.mutation<{ success: boolean; message?: string }, number>({
      query: (id) => ({ url: `/invoices/${id}/efactura/submit`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => ['Invoices', { type: 'Invoice', id }],
    }),
    retryEfactura: build.mutation<{ success: boolean; message?: string }, number>({
      query: (id) => ({ url: `/invoices/${id}/efactura/retry`, method: 'POST', params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => ['Invoices', { type: 'Invoice', id }],
    }),
    checkEfacturaStatus: build.mutation<{ status: string; message: string }, number>({
      query: (id) => ({ url: `/invoices/${id}/efactura/status`, params: { clientUserId: cu() } }),
      invalidatesTags: (_r, _e, id) => ['Invoices', { type: 'Invoice', id }],
    }),
    getInvoicePdfUrl: build.mutation<FileUrl, number>({
      query: (id) => ({ url: `/invoices/${id}/pdf/download`, params: { clientUserId: cu() } }),
    }),
    getReceiptPdfUrl: build.mutation<FileUrl, { id: number; amount?: number }>({
      query: ({ id, amount }) => ({
        url: `/invoices/${id}/receipt`,
        params: { clientUserId: cu(), ...(amount != null ? { amount } : {}) },
      }),
      invalidatesTags: ['Sequences', 'Documents'],
    }),
    getSequences: build.query<InvoiceSequence[], void>({
      query: () => ({ url: '/invoices/sequences', params: { clientUserId: cu() } }),
      providesTags: ['Sequences'],
    }),
    getInvoiceSettings: build.query<InvoiceSettings, void>({
      query: () => ({ url: '/client-portal/invoice-settings', params: { clientUserId: cu() } }),
    }),

    // ── Partners & nomenclature ──
    getPartners: build.query<Partner[], PartnerKind>({
      query: (kind) => ({ url: `/client-portal/${kind}`, params: { clientUserId: cu() } }),
      providesTags: (_r, _e, kind) => [{ type: 'Partners', id: kind }],
    }),
    createPartner: build.mutation<Partner, { kind: PartnerKind; data: PartnerInput & { code: string; name: string } }>({
      query: ({ kind, data }) => ({
        url: `/client-portal/${kind}`,
        method: 'POST',
        params: { clientUserId: cu() },
        body: data,
      }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: 'Partners', id: kind }],
    }),
    updatePartner: build.mutation<Partner, { kind: PartnerKind; id: number; data: PartnerInput }>({
      query: ({ kind, id, data }) => ({
        url: `/client-portal/${kind}/${id}`,
        method: 'PATCH',
        params: { clientUserId: cu() },
        body: data,
      }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: 'Partners', id: kind }],
    }),
    deletePartner: build.mutation<unknown, { kind: PartnerKind; id: number }>({
      query: ({ kind, id }) => ({
        url: `/client-portal/${kind}/${id}`,
        method: 'DELETE',
        params: { clientUserId: cu() },
      }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: 'Partners', id: kind }],
    }),
    lookupCompany: build.mutation<AnafCompany, string>({
      query: (ein) => `/client-portal/anaf-company/${encodeURIComponent(ein.replace(/\s/g, ''))}`,
    }),
    getArticles: build.query<Article[], void>({
      query: () => ({ url: '/client-portal/articles', params: { clientUserId: cu() } }),
      providesTags: ['Articles'],
    }),
    createArticle: build.mutation<Article, ArticleInput>({
      query: (body) => ({ url: '/client-portal/articles', method: 'POST', params: { clientUserId: cu() }, body }),
      invalidatesTags: ['Articles'],
    }),
    updateArticle: build.mutation<Article, { id: number; data: Partial<ArticleInput> }>({
      query: ({ id, data }) => ({
        url: `/client-portal/articles/${id}`,
        method: 'PATCH',
        params: { clientUserId: cu() },
        body: data,
      }),
      invalidatesTags: ['Articles'],
    }),
    deleteArticle: build.mutation<unknown, number>({
      query: (id) => ({ url: `/client-portal/articles/${id}`, method: 'DELETE', params: { clientUserId: cu() } }),
      invalidatesTags: ['Articles'],
    }),
    getManagements: build.query<Management[], void>({
      query: () => ({ url: '/client-portal/managements', params: { clientUserId: cu() } }),
      providesTags: ['Managements'],
    }),
    getStockBalances: build.query<StockBalance[], void>({
      query: () => `/stock/balances/${clientCompanyId()}`,
      providesTags: ['Stock'],
    }),

    // ── Money ──
    getBills: build.query<BillsResponse, void>({
      query: () => ({ url: '/client-portal/bills', params: { clientUserId: cu() } }),
      providesTags: ['Documents'],
    }),
    getBank: build.query<BankResponse, void>({
      query: () => ({ url: '/client-portal/bank', params: { clientUserId: cu() } }),
      providesTags: ['Dashboard'],
    }),

    // ── Messages & tasks ──
    getConversations: build.query<ConversationsResponse, void>({
      query: () => ({ url: '/client-portal/conversations', params: { clientUserId: cu() } }),
      providesTags: ['Messages'],
    }),
    sendMessage: build.mutation<unknown, { accountingClientId: number; content: string }>({
      query: (body) => ({
        url: '/messages/client/send',
        method: 'POST',
        body: { ...body, clientUserId: cu(), sentVia: 'PLATFORM' },
      }),
      invalidatesTags: ['Messages'],
    }),
    markMessagesRead: build.mutation<unknown, number[]>({
      query: (messageIds) => ({
        url: '/messages/client/read',
        method: 'PATCH',
        body: { messageIds, clientUserId: cu() },
      }),
      invalidatesTags: ['Messages', 'Dashboard'],
    }),
    getTasks: build.query<{ tasks: ClientTask[] }, void>({
      query: () => ({ url: '/client-portal/tasks', params: { clientUserId: cu() } }),
      providesTags: ['Tasks'],
    }),
    updateTaskStatus: build.mutation<unknown, { taskId: number; status: Exclude<TaskStatus, 'CANCELLED'> }>({
      query: ({ taskId, status }) => ({
        url: '/client-portal/tasks/status',
        method: 'PATCH',
        params: { clientUserId: cu(), taskId, status },
        body: { clientUserId: cu(), taskId, status },
      }),
      invalidatesTags: ['Tasks'],
    }),

    // ── Reports ──
    getReportsOverview: build.query<ReportsOverview, 'month' | 'quarter' | 'year'>({
      query: (period) => ({ url: '/client-portal/reports', params: { clientUserId: cu(), period } }),
      providesTags: ['Reports'],
    }),
    getPnl: build.query<PnlReport, Period>({
      query: (p) => ({ url: '/client-portal/reports/pnl', params: { clientUserId: cu(), ...p } }),
      providesTags: ['Reports'],
    }),
    getCashFlow: build.query<CashFlowReport, Period>({
      query: (p) => ({ url: '/client-portal/reports/cash-flow', params: { clientUserId: cu(), ...p } }),
      providesTags: ['Reports'],
    }),
    getVatReport: build.query<VatReport, Period>({
      query: (p) => ({ url: '/client-portal/reports/vat', params: { clientUserId: cu(), ...p } }),
      providesTags: ['Reports'],
    }),
    getSalesPerClient: build.query<SalesPerClientReport, Period>({
      query: (p) => ({ url: '/client-portal/reports/sales-per-client', params: { clientUserId: cu(), ...p } }),
      providesTags: ['Reports'],
    }),
    getExpensesByCategory: build.query<ExpensesByCategoryReport, Period>({
      query: (p) => ({ url: '/client-portal/reports/expenses-by-category', params: { clientUserId: cu(), ...p } }),
      providesTags: ['Reports'],
    }),
  }),
});

export const {
  useGetConfigQuery,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useRegisterDeviceMutation,
  useUnregisterDeviceMutation,
  useGetDashboardQuery,
  useGetVatDueQuery,
  useGetFirmBalanceQuery,
  useGetHealthQuery,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetApprovalsQuery,
  useGetCostCentersQuery,
  useRespondApprovalMutation,
  useGetDocumentsQuery,
  useRetryUploadMutation,
  useCancelUploadMutation,
  useDeleteSavedDocumentMutation,
  useLazyGetPendingUploadUrlQuery,
  useLazyGetDocumentUrlQuery,
  useGetNirForInvoiceQuery,
  useSaveUploadAndCreateNirMutation,
  useUpdateNirMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useIssueInvoiceMutation,
  useDeleteInvoiceMutation,
  useCancelInvoiceMutation,
  useDuplicateInvoiceMutation,
  useRecordPaymentMutation,
  useCreateCreditNoteMutation,
  useSendInvoiceEmailMutation,
  useSubmitEfacturaMutation,
  useRetryEfacturaMutation,
  useCheckEfacturaStatusMutation,
  useGetInvoicePdfUrlMutation,
  useGetReceiptPdfUrlMutation,
  useGetSequencesQuery,
  useGetInvoiceSettingsQuery,
  useGetPartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useLookupCompanyMutation,
  useGetArticlesQuery,
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useDeleteArticleMutation,
  useGetManagementsQuery,
  useGetStockBalancesQuery,
  useGetBillsQuery,
  useGetBankQuery,
  useGetConversationsQuery,
  useSendMessageMutation,
  useMarkMessagesReadMutation,
  useGetTasksQuery,
  useUpdateTaskStatusMutation,
  useGetReportsOverviewQuery,
  useGetPnlQuery,
  useGetCashFlowQuery,
  useGetVatReportQuery,
  useGetSalesPerClientQuery,
  useGetExpensesByCategoryQuery,
} = api;
