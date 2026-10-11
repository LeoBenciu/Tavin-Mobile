/** Response shapes of the Tavin API (mirrors client/src/redux/slices/apiSlice.ts on tavin.eu). */

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  clientCompany: { id: number; name: string };
  accountingCompany: { id: number; name: string };
};

export type LoginResponse = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type Profile = {
  id: number;
  email: string;
  name: string;
  phoneNumber: string | null;
  accountingClientId: number;
  clientCompany: { id: number; name: string; ein: string; legalAddress: string | null };
  accountingCompany: { id: number; name: string };
};

export type MobileConfig = {
  minSupportedVersion: string;
  latestVersion: string | null;
  storeUrls: { ios: string | null; android: string | null };
  pushEnabled: boolean;
};

export type Dashboard = {
  stats: {
    revenue: number;
    expenses: number;
    unpaidInvoices: { count: number; total: number };
    pendingBills: { count: number; total: number };
    bankBalance: number;
    unreadMessages: number;
  };
  bankAccounts: {
    id: number;
    bankName: string;
    iban: string;
    currency: string;
    currentBalance: number | null;
    connected: boolean;
    lastSyncAt: string | null;
  }[];
  recentActivity: { id: number; description: string; type: string; amount: number | string; date: string }[];
  clientCompany: { id: number; name: string; ein: string };
  accountingCompany: { id: number; name: string };
};

export type VatDue =
  | { applies: false }
  | {
      applies: true;
      dueDate: string;
      periodStart: string;
      periodEnd: string;
      frequency: 'MONTHLY' | 'QUARTERLY';
      periodComplete: boolean;
      collected: number;
      deductible: number;
      netVat: number;
    };

export type FirmBalance = {
  balance: number;
  currency: string;
  invoices: {
    id: number;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    outstanding: number;
    total: number;
    currency: string;
    overdue: boolean;
  }[];
};

export type Health = {
  level: 'green' | 'yellow' | 'red';
  components: { key: string; label: string; value: number; severity: number }[];
  nextDeadline: { code: string; dueDate: string } | null;
};

export type AppNotification = {
  id: number;
  createdAt: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
};

export type ConfirmationAction = 'CONFIRM' | 'REJECT' | 'UNKNOWN_VENDOR' | 'WRONGLY_ISSUED' | 'CLARIFY';

export type InvoiceConfirmation = {
  id: number;
  createdAt: string;
  pendingUploadId: number | null;
  documentId: number | null;
  vendorName: string;
  vendorEin: string;
  documentNumber: string | null;
  documentDate: string | null;
  totalAmount: string | number;
  currency: string;
  paymentIban: string | null;
  ibanIsNew: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskReasons: string[];
  status: string;
};

export type PendingUpload = {
  id: number;
  fileName: string;
  fileSize: number;
  contentType: string;
  status: string;
  phase: number;
  errorMessage: string | null;
  createdAt: string;
  isProcessing: boolean;
  isReady: boolean;
  hasError: boolean;
  isIncomingInvoice?: boolean;
  isAvizDocument?: boolean;
};

export type SavedDocument = {
  id: number;
  name: string;
  type: string;
  createdAt: string;
  status: string;
  isIncomingInvoice?: boolean;
  isOutgoingInvoice?: boolean;
  isAvizDocument?: boolean;
  nirDocument?: { id: number; name: string } | null;
  documentInvoiceNumber?: string | null;
  documentClientName?: string | null;
  documentTotal?: number | null;
  documentIssueDate?: string | null;
  documentDueDate?: string | null;
  documentCurrency?: string;
};

export type DocumentsResponse = {
  pendingUploads: PendingUpload[];
  savedDocuments: SavedDocument[];
  stats: { totalUploads: number; processing: number; ready: number; errors: number; saved: number };
};

export type FileUrl = { url: string; fileName: string; contentType?: string };

export type NirLine = {
  nr_crt: number;
  denumire_produs: string;
  um: string;
  cantitate: number;
  cant_document?: number;
  pret_unitar: number;
  valoare: number;
  tva: number;
  [key: string]: unknown;
};

export type NirData = {
  nr_nir?: string;
  data?: string;
  data_receptie?: string;
  unitatea?: string;
  fiscal_id?: string;
  adresa?: string;
  furnizor?: string;
  gestiunea?: string;
  nr_doc?: string;
  line_items?: NirLine[];
  total_valoare?: number;
  total_tva?: number;
  comisie_nume_1?: string;
  comisie_nume_2?: string;
  comisie_nume_3?: string;
  primit_in_gestiune_nume?: string;
  [key: string]: unknown;
};

export type NirResponse = {
  nirDocumentId: number;
  nirDocumentName: string;
  nirData: NirData;
  created: boolean;
  clientCompanyAddress?: string;
  clientCompanyName?: string;
};

export type InvoiceType = 'REGULAR' | 'PROFORMA' | 'CREDIT_NOTE' | 'AVIZ' | 'RECEIPT' | 'CONSUMPTION_SLIP';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
export type EFacturaStatus = 'NOT_SENT' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ERROR';

export type IssuedInvoiceListItem = {
  id: number;
  series: string;
  number: number;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientEin: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  paymentStatus: string;
  efacturaStatus: EFacturaStatus;
  efacturaId: string | null;
  efacturaErrorMessage: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canCancel: boolean;
};

export type IssuedInvoiceStats = {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  draftCount: number;
  issuedCount: number;
  paidCount: number;
  overdueCount: number;
};

export type InvoiceList = {
  invoices: IssuedInvoiceListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: IssuedInvoiceStats;
};

export type InvoiceLine = {
  id: number;
  lineNumber: number;
  articleId: number | null;
  articleCode: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  vatRate: number;
  vatAmount: number;
  discountPercent: number | null;
  totalWithoutVat: number;
  totalWithVat: number;
};

export type IssuedInvoice = IssuedInvoiceListItem & {
  deliveryDate: string | null;
  issuerName: string;
  issuerEin: string;
  clientId: number | null;
  clientRegCom: string | null;
  clientAddress: string;
  clientCity: string | null;
  clientCounty: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  exchangeRate: number | null;
  lastPaymentDate: string | null;
  efacturaSubmittedAt: string | null;
  notes: string | null;
  lineItems: InvoiceLine[];
  editWindowRemainingHours: number;
};

export type NewInvoiceLine = {
  lineNumber: number;
  articleId?: number;
  articleCode?: string;
  description: string;
  quantity: number;
  unitOfMeasure?: string;
  unitPrice: number;
  vatRate: number;
  discountPercent?: number;
  articleType?: string;
  managementId?: number;
};

export type NewInvoice = {
  invoiceType: 'REGULAR' | 'PROFORMA' | 'AVIZ';
  series?: string;
  number?: number;
  issueDate: string;
  dueDate: string;
  currency?: string;
  clientId?: number;
  clientName: string;
  clientEin: string;
  clientRegCom?: string;
  clientAddress: string;
  clientCity?: string;
  clientCounty?: string;
  clientVatPayer?: boolean;
  clientPhone?: string;
  clientEmail?: string;
  autoSendAfterIssue?: boolean;
  efacturaAutoSubmit?: boolean;
  lineItems: NewInvoiceLine[];
  notes?: string;
  saveAsDraft?: boolean;
};

export type InvoiceSequence = {
  id: number;
  series: string;
  currentNumber: number;
  year: number;
  invoiceType: string;
  isDefault: boolean;
  resetYearly: boolean;
};

export type InvoiceSettings = {
  defaultPaymentTermDays: number;
  autoSendInvoiceEmail: boolean;
  companyName: string;
  companyEin: string;
  isNeplatitorTva: boolean;
  iban: string;
  bankName: string;
};

export type Partner = {
  id: number;
  code: string;
  name: string;
  ein: string | null;
  address: string | null;
  localitate: string | null;
  judet: string | null;
  phone: string | null;
  email: string | null;
};

export type PartnerInput = {
  code?: string;
  name?: string;
  ein?: string;
  address?: string;
  localitate?: string;
  judet?: string;
  phone?: string;
  email?: string;
};

export type AnafCompany = {
  name: string;
  registrationNumber: string | null;
  legalAddress: string | null;
  city: string | null;
  county: string | null;
  isVatPayer: boolean | null;
  email: string | null;
  phoneNumber: string | null;
};

export type Article = {
  id: number;
  code: string;
  name: string;
  vat: string;
  unitOfMeasure: string;
  type: string;
};

export type ArticleInput = { code?: string; name: string; vat: string; unitOfMeasure: string; type: string };

export type Management = {
  id: number;
  code: string;
  name: string;
  type: string;
  isSellingPrice: boolean;
  vatRate: string;
};

export type StockBalance = {
  id: number;
  articleId: number;
  managementId: number;
  quantity: string;
  averageCost: string;
  totalValue: string;
  article: { id: number; code: string; name: string; type: string; unitOfMeasure: string };
  management: { id: number; code: string; name: string };
};

export type Bill = {
  id: number;
  vendor: string | null;
  vendorEin: string | null;
  description: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'scheduled';
  dueDate: string | null;
  issueDate: string | null;
};

export type BillsResponse = {
  bills: Bill[];
  stats: { total: number; overdue: number; overdueCount: number; dueThisWeek: number; dueThisWeekCount: number };
};

export type BankResponse = {
  accounts: {
    id: number;
    name: string;
    iban: string;
    balance: number;
    currency: string;
    bank: string;
    connected: boolean;
    lastSync: string | null;
  }[];
  totalBalance: number;
  transactions: {
    id: number;
    description: string;
    amount: number;
    date: string;
    type: 'credit' | 'debit';
    bankAccountId?: number;
  }[];
};

export type ChatMessage = {
  id: number;
  content: string;
  sender: 'accountant' | 'client';
  senderName: string;
  timestamp: string;
  read: boolean;
};

export type ConversationsResponse = {
  conversations: {
    id: number;
    accountingCompany: { id: number; name: string };
    accountants: { id: number; name: string; email: string }[];
    unreadCount: number;
  }[];
  messages: ChatMessage[];
};

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type ClientTask = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  createdBy: string | null;
  createdAt: string;
};

export type AccountLine = { accountCode: string; name: string; amount: number };

export type PnlReport = {
  period: { startDate: string; endDate: string };
  revenue: AccountLine[];
  expenses: AccountLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export type CashFlowReport = {
  openingBalance: number;
  closingBalance: number;
  operating: { items: AccountLine[]; total: number };
  investing: { items: AccountLine[]; total: number };
  financing: { items: AccountLine[]; total: number };
  netChange: number;
};

export type VatReport = {
  collected: number;
  deductible: number;
  netVat: number;
  direction: 'payable' | 'recoverable';
  byAccount: AccountLine[];
};

export type SalesPerClientReport = {
  total: number;
  clients: (AccountLine & { invoiceCount: number })[];
};

export type ExpensesByCategoryReport = { total: number; categories: AccountLine[] };

export type ReportsOverview = {
  monthlyData: { month: string; revenue: number; expenses: number }[];
  totals: { revenue: number; expenses: number; profit: number; profitMargin: number };
};
