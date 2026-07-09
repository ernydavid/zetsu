import "server-only";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  computeRecommendedExtraPayment,
  nextDueDateFromDay,
} from "@/lib/finance/debt-utils";
import type {
  AccountType,
  BankConnection,
  BankInstitution,
  BankProvider,
  DebtObligation,
  ExternalAccount,
  FinanceAccount,
  FinanceTransaction,
} from "@/lib/finance/types";

type ProviderSession = {
  consentReference: string;
  mode: "sandbox" | "live";
  accessToken?: string | null;
  refreshToken?: string | null;
  metadata?: Record<string, unknown>;
};

type BelvoApiListResponse<T> = {
  results?: T[];
  next?: string | null;
};

type BankingProviderRuntimeStatus = {
  configured: boolean;
  mode: "sandbox" | "live";
  label: string;
};

type TinkProviderConsent = {
  providerConsentId: string;
  credentialsId: string | null;
  status: string | null;
  providerName: string | null;
  rawData: Record<string, unknown>;
};

type BankConnectionDisplayState =
  | "sandbox"
  | "manual_only"
  | "waiting_widget"
  | "waiting_webhook"
  | "syncing"
  | "connected"
  | "requires_reconnection"
  | "disconnected";

type NormalizedExternalTransaction = {
  externalId?: string | null;
  amount: number;
  currency: string;
  description: string;
  merchantName?: string | null;
  authorizedDate: string;
  postedDate: string;
  status: "pending" | "posted";
  kind: "income" | "expense";
  categoryHint?: string | null;
  rawData?: Record<string, unknown>;
};

type NormalizedExternalAccount = {
  externalId: string;
  name: string;
  type: AccountType;
  currency: string;
  currentBalance: number;
  availableBalance?: number | null;
  accountMask?: string | null;
  transactions: NormalizedExternalTransaction[];
  rawData?: Record<string, unknown>;
};

interface OpenBankingProvider {
  provider: BankProvider;
  institutions: BankInstitution[];
  createLinkSession(params: {
    userId: string;
    institution: BankInstitution;
  }): Promise<ProviderSession>;
  exchangeConsent(params: {
    institution: BankInstitution;
    consentReference: string;
  }): Promise<ProviderSession>;
  syncAccounts(params: {
    connection: BankConnection;
  }): Promise<NormalizedExternalAccount[]>;
  refreshConnection(params: {
    connection: BankConnection;
  }): Promise<void>;
  revokeConnection(params: {
    connection: BankConnection;
  }): Promise<void>;
}

const BANK_INSTITUTIONS: BankInstitution[] = [
  {
    id: "tink-caixabank-es",
    provider: "tink",
    country_code: "ES",
    name: "CaixaBank",
    availability: "available",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "tink-bbva-es",
    provider: "tink",
    country_code: "ES",
    name: "BBVA",
    availability: "available",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "tink-santander-es",
    provider: "tink",
    country_code: "ES",
    name: "Banco Santander",
    availability: "available",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "belvo-nequi-co",
    provider: "belvo",
    country_code: "CO",
    name: "Nequi",
    availability: "pilot",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "belvo-bancolombia-co",
    provider: "belvo",
    country_code: "CO",
    name: "Bancolombia",
    availability: "pilot",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "belvo-davivienda-co",
    provider: "belvo",
    country_code: "CO",
    name: "Davivienda",
    availability: "pilot",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "belvo-daviplata-co",
    provider: "belvo",
    country_code: "CO",
    name: "Daviplata",
    availability: "manual_only",
    capabilities: ["manual_fallback"],
  },
];

const DEFAULT_APP_URL = "http://localhost:3000";

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_APP_URL
  ).replace(/\/+$/, "");
}

function getTinkConfig() {
  const clientId = process.env.TINK_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.TINK_CLIENT_SECRET?.trim() || "";

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    apiBaseUrl: "https://api.tink.com",
    linkBaseUrl: "https://link.tink.com/1.0/transactions/connect-accounts",
    appUrl: getAppUrl(),
  };
}

function getBelvoConfig() {
  const secretId = process.env.BELVO_SECRET_ID?.trim() || "";
  const secretPassword = process.env.BELVO_SECRET_PASSWORD?.trim() || "";
  const envName = (process.env.BELVO_ENV?.trim().toLowerCase() || "sandbox") as "sandbox" | "production";
  const apiBaseUrl = envName === "production" ? "https://api.belvo.com" : "https://sandbox.belvo.com";

  return {
    configured: Boolean(secretId && secretPassword),
    secretId,
    secretPassword,
    envName,
    apiBaseUrl,
    widgetBaseUrl: "https://widget.belvo.io/",
    appUrl: getAppUrl(),
  };
}

function getBelvoRuntimeStatus(): BankingProviderRuntimeStatus {
  const config = getBelvoConfig();
  return {
    configured: config.configured,
    mode: config.configured ? "live" : "sandbox",
    label: config.configured ? "Belvo hosted widget" : "sandbox local",
  };
}

function getTinkRuntimeStatus(): BankingProviderRuntimeStatus {
  const config = getTinkConfig();
  return {
    configured: config.configured,
    mode: config.configured ? "live" : "sandbox",
    label: config.configured ? "Tink Link" : "sandbox local",
  };
}

function mergeMetadata(
  current: Record<string, unknown> | null | undefined,
  updates: Record<string, unknown>,
) {
  return {
    ...(current ?? {}),
    ...updates,
  };
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function shiftDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

function buildHash(parts: Array<string | number | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex");
}

function buildMockAccounts(institution: BankInstitution): NormalizedExternalAccount[] {
  const currency = institution.country_code === "ES" ? "EUR" : "COP";
  const checkingTransactions: NormalizedExternalTransaction[] = [
    {
      externalId: `${institution.id}-payroll-01`,
      amount: 2800,
      currency,
      description: "Nomina principal",
      merchantName: institution.country_code === "ES" ? "Empresa ES" : "Empresa CO",
      authorizedDate: shiftDate(-20),
      postedDate: shiftDate(-20),
      status: "posted",
      kind: "income",
      categoryHint: "ingreso",
    },
    {
      externalId: `${institution.id}-rent-01`,
      amount: 850,
      currency,
      description: "Alquiler mensual",
      merchantName: "Arrendador",
      authorizedDate: shiftDate(-18),
      postedDate: shiftDate(-18),
      status: "posted",
      kind: "expense",
      categoryHint: "vivienda",
    },
    {
      externalId: `${institution.id}-groceries-01`,
      amount: 142.35,
      currency,
      description: "Supermercado",
      merchantName: "Mercado Central",
      authorizedDate: shiftDate(-7),
      postedDate: shiftDate(-7),
      status: "posted",
      kind: "expense",
      categoryHint: "comida",
    },
    {
      externalId: `${institution.id}-utilities-01`,
      amount: 96.2,
      currency,
      description: "Servicios hogar",
      merchantName: "Energia",
      authorizedDate: shiftDate(-2),
      postedDate: shiftDate(-2),
      status: "posted",
      kind: "expense",
      categoryHint: "servicios",
    },
  ];

  const cardTransactions: NormalizedExternalTransaction[] = [
    {
      externalId: `${institution.id}-card-charge-01`,
      amount: 220,
      currency,
      description: "Compra tarjeta",
      merchantName: "Viajes",
      authorizedDate: shiftDate(-10),
      postedDate: shiftDate(-9),
      status: "posted",
      kind: "expense",
      categoryHint: "otros",
    },
    {
      externalId: `${institution.id}-card-payment-01`,
      amount: 120,
      currency,
      description: "Abono tarjeta",
      merchantName: institution.name,
      authorizedDate: shiftDate(-3),
      postedDate: shiftDate(-3),
      status: "posted",
      kind: "income",
      categoryHint: "deuda",
    },
  ];

  const checkingBalance =
    checkingTransactions.reduce((total, tx) => total + (tx.kind === "income" ? tx.amount : -tx.amount), 0) + 500;
  const cardBalance = cardTransactions.reduce(
    (total, tx) => total + (tx.kind === "income" ? tx.amount : -tx.amount),
    -600,
  );

  return [
    {
      externalId: `${institution.id}-checking-main`,
      name: `Cuenta ${institution.name}`,
      type: "checking",
      currency,
      currentBalance: checkingBalance,
      availableBalance: checkingBalance,
      accountMask: institution.country_code === "ES" ? "ES91" : "****1024",
      transactions: checkingTransactions,
      rawData: {
        provider_mode: "sandbox",
      },
    },
    {
      externalId: `${institution.id}-credit-main`,
      name: `Tarjeta ${institution.name}`,
      type: "credit_card",
      currency,
      currentBalance: cardBalance,
      availableBalance: cardBalance,
      accountMask: "****4412",
      transactions: cardTransactions,
      rawData: {
        provider_mode: "sandbox",
      },
    },
  ];
}

function sanitizeBelvoExternalId(userId: string) {
  return userId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

function sanitizeTinkExternalUserId(userId: string) {
  return userId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
}

function humanizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Error desconocido");
  const normalized = message.toLowerCase();

  if (normalized.includes("401") || normalized.includes("403") || normalized.includes("credential")) {
    return "Las credenciales o el consentimiento de la institucion ya no son validos. Reconecta la cuenta.";
  }

  if (normalized.includes("404")) {
    return "Belvo no encontro la vinculacion remota. Vuelve a conectar la institucion.";
  }

  if (normalized.includes("429")) {
    return "Belvo limito temporalmente la sincronizacion. Intenta de nuevo en unos minutos.";
  }

  if (normalized.includes("500") || normalized.includes("502") || normalized.includes("503") || normalized.includes("504")) {
    return "La institucion o Belvo no respondieron bien. Conservamos tus datos y puedes reintentar mas tarde.";
  }

  return message;
}

function humanizeTinkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Error desconocido");
  const normalized = message.toLowerCase();

  if (normalized.includes("consent") || normalized.includes("reconfirm")) {
    return "El consentimiento de Tink necesita reconfirmacion. Reconecta la cuenta en Espana.";
  }

  if (normalized.includes("credentials") || normalized.includes("authentication_error")) {
    return "Tink reporto un problema con las credenciales del banco. Necesitas reconectar la cuenta.";
  }

  if (normalized.includes("401") || normalized.includes("403")) {
    return "El acceso a Tink ya no es valido. Vuelve a autorizar la conexion.";
  }

  if (normalized.includes("429")) {
    return "Tink limito temporalmente las consultas. Reintenta en unos minutos.";
  }

  if (normalized.includes("500") || normalized.includes("502") || normalized.includes("503") || normalized.includes("504")) {
    return "Tink o la entidad bancaria no respondieron bien. Puedes reintentar mas tarde.";
  }

  return message;
}

function buildBelvoInstitutionSupportNote(institutionId: string) {
  if (institutionId.includes("nequi")) {
    return "Pilot wallet sync. Puede requerir reautorizacion segun disponibilidad del proveedor.";
  }

  if (institutionId.includes("bancolombia")) {
    return "Banco principal del piloto en Colombia. Prioriza movimientos y balances.";
  }

  if (institutionId.includes("davivienda")) {
    return "Soporte piloto sujeto a cobertura de Belvo para esta institucion.";
  }

  if (institutionId.includes("daviplata")) {
    return "Aun sin sync activa. La app queda lista para carga manual y control de deudas.";
  }

  return "Institucion en piloto con respaldo manual.";
}

function buildTinkInstitutionSupportNote(institutionId: string) {
  if (institutionId.includes("caixabank")) {
    return "PSD2 en Espana con Tink. Flujo habitual con redireccion y SCA.";
  }

  if (institutionId.includes("bbva")) {
    return "Cobertura principal en Espana para balances y movimientos via Tink.";
  }

  if (institutionId.includes("santander")) {
    return "Sincronizacion AIS en Espana con autorizacion del banco dentro de Tink Link.";
  }

  return "Institucion soportada por Tink para agregacion en Espana.";
}

export function getBankConnectionDisplayState(connection: BankConnection): {
  tone: BankConnectionDisplayState;
  label: string;
  detail: string;
} {
  const metadata = connection.metadata ?? {};
  const syncStage = String(metadata.sync_stage ?? "");
  const callbackState = String(metadata.callback_state ?? "");
  const webhookCode = String(metadata.last_webhook_code ?? "");
  const isSandbox = connection.connection_mode === "sandbox";
  const providerLabel = connection.provider === "tink" ? "Tink" : "Belvo";

  if (connection.status === "manual_only") {
    return {
      tone: "manual_only",
      label: "manual por ahora",
      detail: "La institucion sigue fuera del piloto. Puedes seguir cargando ingresos, gastos y deudas a mano.",
    };
  }

  if (connection.status === "revoked") {
    return {
      tone: "disconnected",
      label: "desvinculada",
      detail: "La conexion fue cerrada y los datos historicos se conservan solo como referencia.",
    };
  }

  if (connection.status === "attention") {
    return {
      tone: "requires_reconnection",
      label: "requiere reconexion",
      detail:
        connection.visible_error ||
        "La conexion necesita una nueva autorizacion o revisar el estado de la institucion.",
    };
  }

  if (syncStage === "syncing") {
    return {
      tone: "syncing",
      label: "sincronizando",
      detail: "Estamos trayendo cuentas y movimientos al ledger interno.",
    };
  }

  if (connection.status === "pending" && callbackState !== "success") {
    return {
      tone: "waiting_widget",
      label: isSandbox ? "sandbox listo" : "pendiente en widget",
      detail: isSandbox
        ? "La conexion local queda lista para poblar datos de prueba."
        : `Falta que el usuario complete la autorizacion dentro del flujo de ${providerLabel}.`,
    };
  }

  if (
    callbackState === "success" &&
    (!connection.last_synced_at || syncStage === "waiting_webhook" || webhookCode.includes("historical_update"))
  ) {
    return {
      tone: "waiting_webhook",
      label: "esperando webhook",
      detail:
        connection.provider === "belvo"
          ? "Belvo ya devolvio el link. Falta la confirmacion de datos listos o un refresco manual."
          : "La conexion ya volvio del flujo de Tink y queda pendiente una actualizacion adicional.",
    };
  }

  return {
    tone: isSandbox ? "sandbox" : "connected",
    label: isSandbox ? "sandbox conectado" : "conectada",
    detail: isSandbox
      ? "Datos sincronizados desde el entorno local de prueba."
      : "La ultima sincronizacion se completo y el saldo interno esta actualizado.",
  };
}

function resolveBelvoLinkId(connection: BankConnection) {
  const metadata = connection.metadata ?? {};
  const candidate =
    metadata.belvo_link_id ??
    metadata.link_id ??
    connection.consent_reference ??
    null;

  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function parseBelvoAccountType(input: unknown): AccountType {
  const value = String(input ?? "").toLowerCase();

  if (value.includes("credit")) return "credit_card";
  if (value.includes("loan")) return "loan";
  if (value.includes("saving")) return "savings";
  if (value.includes("cash")) return "cash";
  return "checking";
}

function normalizeBelvoAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function normalizeBelvoDate(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw) {
    return todayIso();
  }

  return raw.includes("T") ? raw.split("T")[0] : raw;
}

function buildBelvoWidgetUrl(accessToken: string, params: Record<string, string>) {
  const url = new URL(getBelvoConfig().widgetBaseUrl);
  url.searchParams.set("access_token", accessToken);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function belvoRequest<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean },
): Promise<T> {
  const config = getBelvoConfig();
  if (!config.configured) {
    throw new Error("Belvo no está configurado en el servidor");
  }

  const url = path.startsWith("http") ? path : `${config.apiBaseUrl}${path}`;
  const auth = Buffer.from(`${config.secretId}:${config.secretPassword}`).toString("base64");
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.skipAuth ? {} : { Authorization: `Basic ${auth}` }),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Belvo ${response.status}: ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

async function tinkTokenRequest(params: {
  grantType: "client_credentials" | "authorization_code";
  scope?: string;
  code?: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const config = getTinkConfig();
  if (!config.configured) {
    throw new Error("Tink no está configurado en el servidor");
  }

  const form = new URLSearchParams();
  form.set("client_id", config.clientId);
  form.set("client_secret", config.clientSecret);
  form.set("grant_type", params.grantType);

  if (params.scope) {
    form.set("scope", params.scope);
  }

  if (params.code) {
    form.set("code", params.code);
  }

  const response = await fetch(`${config.apiBaseUrl}/api/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tink ${response.status}: ${body || response.statusText}`);
  }

  return (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
}

async function tinkRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit & { formData?: URLSearchParams },
): Promise<T> {
  const config = getTinkConfig();
  if (!config.configured) {
    throw new Error("Tink no está configurado en el servidor");
  }

  const response = await fetch(path.startsWith("http") ? path : `${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.formData
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    body: init?.formData ? init.formData.toString() : init?.body,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tink ${response.status}: ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function buildTinkLinkUrl(params: {
  authorizationCode: string;
  redirectUri: string;
  market: string;
  locale: string;
  credentialsId?: string | null;
}) {
  const config = getTinkConfig();
  const url = new URL(config.linkBaseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("authorization_code", params.authorizationCode);
  url.searchParams.set("market", params.market);
  url.searchParams.set("locale", params.locale);
  if (params.credentialsId) {
    url.searchParams.set("credentials_id", params.credentialsId);
  }
  return url.toString();
}

function parseTinkAccountType(input: unknown): AccountType {
  const value = String(input ?? "").toLowerCase();

  if (value.includes("credit")) return "credit_card";
  if (value.includes("loan")) return "loan";
  if (value.includes("savings")) return "savings";
  if (value.includes("cash")) return "cash";
  return "checking";
}

function normalizeTinkAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function normalizeTinkTransaction(transaction: Record<string, unknown>): NormalizedExternalTransaction {
  const amountObject =
    transaction.amount && typeof transaction.amount === "object"
      ? (transaction.amount as Record<string, unknown>)
      : null;
  const descriptionsObject =
    transaction.descriptions && typeof transaction.descriptions === "object"
      ? (transaction.descriptions as Record<string, unknown>)
      : null;
  const amount = normalizeTinkAmount(amountObject?.value ?? transaction.amount);
  const bookedDate = normalizeBelvoDate(transaction.bookedDate ?? transaction.date ?? transaction.timestamp);
  const valueDate = normalizeBelvoDate(transaction.valueDate ?? bookedDate);
  const typeValue = String(transaction.type ?? transaction.categoryType ?? "").toLowerCase();

  return {
    externalId: typeof transaction.id === "string" ? transaction.id : null,
    amount,
    currency: String(amountObject?.currencyCode ?? transaction.currencyCode ?? "EUR"),
    description: String(
      descriptionsObject?.display ??
        descriptionsObject?.original ??
        transaction.description ??
        "Movimiento bancario",
    ),
    merchantName: typeof transaction.counterpartName === "string" ? transaction.counterpartName : null,
    authorizedDate: valueDate,
    postedDate: bookedDate,
    status: String(transaction.status ?? "posted").toLowerCase().includes("pending") ? "pending" : "posted",
    kind: typeValue.includes("credit") || Number(amountObject?.value ?? transaction.amount ?? 0) > 0
      ? "income"
      : "expense",
    categoryHint: typeof transaction.categoryId === "string" ? transaction.categoryId : null,
    rawData: transaction,
  };
}

function normalizeTinkAccount(account: Record<string, unknown>, transactions: NormalizedExternalTransaction[]) {
  const balances = (account.balances as Record<string, unknown>[] | undefined) ?? [];
  const bookedBalance = balances.find((balance) =>
    String(balance?.["type"] ?? "").toLowerCase().includes("booked"),
  );
  const availableBalance = balances.find((balance) =>
    String(balance?.["type"] ?? "").toLowerCase().includes("available"),
  );

  return {
    externalId: String(account.id ?? buildHash([String(account.name ?? ""), String(account.accountNumber ?? "")])),
    name: String(account.name ?? account.officialName ?? account.type ?? "Cuenta bancaria"),
    type: parseTinkAccountType(account.type ?? account.accountType ?? account.kind),
    currency: String(account.currencyCode ?? bookedBalance?.["currencyCode"] ?? "EUR"),
    currentBalance: normalizeTinkAmount(bookedBalance?.["value"] ?? account.balance),
    availableBalance: normalizeTinkAmount(
      availableBalance?.["value"] ?? bookedBalance?.["value"] ?? account.balance,
    ),
    accountMask:
      typeof account.accountNumber === "string" ? account.accountNumber.slice(-4) :
      typeof account.iban === "string" ? account.iban.slice(-4) :
      null,
    transactions,
    rawData: account,
  } satisfies NormalizedExternalAccount;
}

function extractTinkProviderConsents(payload: Record<string, unknown>): TinkProviderConsent[] {
  const candidateList =
    (Array.isArray(payload.providerConsents) ? payload.providerConsents : null) ??
    (Array.isArray(payload.results) ? payload.results : null) ??
    (Array.isArray(payload.consents) ? payload.consents : null) ??
    [];

  return candidateList
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      providerConsentId: String(item.providerConsentId ?? item.id ?? ""),
      credentialsId:
        typeof item.credentialsId === "string"
          ? item.credentialsId
          : typeof item.credentials_id === "string"
            ? item.credentials_id
            : null,
      status:
        typeof item.status === "string"
          ? item.status
          : typeof item.providerConsentStatus === "string"
            ? item.providerConsentStatus
            : null,
      providerName:
        typeof item.providerName === "string"
          ? item.providerName
          : typeof item.providerDisplayName === "string"
            ? item.providerDisplayName
            : null,
      rawData: item,
    }))
    .filter((item) => item.providerConsentId.length > 0);
}

function getTinkConnectionUserToken(connection: BankConnection) {
  return connection.access_token ||
    (typeof connection.metadata?.user_access_token === "string" ? connection.metadata.user_access_token : null);
}

function getTinkConnectionUserId(connection: BankConnection) {
  return typeof connection.metadata?.tink_user_id === "string" ? connection.metadata.tink_user_id : null;
}

async function listTinkProviderConsents(connection: BankConnection) {
  const userAccessToken = getTinkConnectionUserToken(connection);
  if (!userAccessToken) {
    throw new Error("La conexion de Tink no tiene user access token para listar consents.");
  }

  const payload = await tinkRequest<Record<string, unknown>>("/api/v1/provider-consents", userAccessToken);
  return extractTinkProviderConsents(payload);
}

async function createTinkDelegatedAuthorizationCode(params: {
  userId: string;
  institutionName: string;
}) {
  const clientToken = await tinkTokenRequest({
    grantType: "client_credentials",
    scope: "authorization:grant authorization:read",
  });
  const delegatedForm = new URLSearchParams();
  delegatedForm.set("user_id", params.userId);
  delegatedForm.set("actor_client_id", getTinkConfig().clientId);
  delegatedForm.set("scope", "accounts:read balances:read transactions:read provider-consents:read credentials:read credentials:write");
  delegatedForm.set("id_hint", params.institutionName);

  const delegatedAuth = await tinkRequest<{ code?: string; authorization_code?: string }>(
    "/api/v1/oauth/authorization-grant/delegate",
    clientToken.access_token,
    {
      method: "POST",
      formData: delegatedForm,
    },
  );

  return delegatedAuth.code ?? delegatedAuth.authorization_code ?? null;
}

async function belvoList<T>(path: string) {
  let nextUrl: string | null = path;
  const results: T[] = [];

  while (nextUrl) {
    const payload: BelvoApiListResponse<T> | T[] =
      await belvoRequest<BelvoApiListResponse<T> | T[]>(nextUrl);

    if (Array.isArray(payload)) {
      results.push(...payload);
      break;
    }

    results.push(...(payload.results ?? []));
    nextUrl = payload.next ?? null;
  }

  return results;
}

function normalizeBelvoTransaction(transaction: Record<string, unknown>): NormalizedExternalTransaction {
  const amount = normalizeBelvoAmount(
    transaction.amount ??
      transaction.value ??
      transaction.transaction_amount ??
      transaction.accounting_amount,
  );
  const rawType = String(
    transaction.type ??
      transaction.transaction_type ??
      transaction.direction ??
      transaction.category ??
      "",
  ).toLowerCase();
  const statusValue = String(transaction.status ?? transaction.transaction_status ?? "posted").toLowerCase();
  const kind = rawType.includes("credit") || rawType.includes("income") ? "income" : "expense";
  const postedDate = normalizeBelvoDate(
    transaction.value_date ??
      transaction.accounting_date ??
      transaction.processed_date ??
      transaction.created_at ??
      transaction.date,
  );
  const authorizedDate = normalizeBelvoDate(
    transaction.date ??
      transaction.booking_date ??
      transaction.created_at ??
      postedDate,
  );

  return {
    externalId: typeof transaction.id === "string" ? transaction.id : null,
    amount,
    currency: String(transaction.currency ?? transaction.iso_currency_code ?? "COP"),
    description: String(
      transaction.description ??
        transaction.observation ??
        transaction.reference ??
        transaction.concept ??
        "Movimiento bancario",
    ),
    merchantName: typeof transaction.merchant_name === "string" ? transaction.merchant_name : null,
    authorizedDate,
    postedDate,
    status: statusValue.includes("pending") ? "pending" : "posted",
    kind,
    categoryHint: typeof transaction.category === "string" ? transaction.category : null,
    rawData: transaction,
  };
}

function normalizeBelvoAccount(account: Record<string, unknown>, transactions: NormalizedExternalTransaction[]) {
  const balance = (account.balance as Record<string, unknown> | undefined) ?? {};

  return {
    externalId: String(
      account.id ??
        buildHash([
          String(account.name ?? ""),
          String(account.number ?? ""),
          String(account.currency ?? ""),
        ]),
    ),
    name: String(account.name ?? account.public_name ?? account.type ?? "Cuenta bancaria"),
    type: parseBelvoAccountType(account.type ?? account.category ?? account.subtype),
    currency: String(account.currency ?? account.iso_currency_code ?? "COP"),
    currentBalance: normalizeBelvoAmount(
      balance.current ??
        account.current_balance ??
        account.balance_current ??
        account.available_balance ??
        0,
    ),
    availableBalance: normalizeBelvoAmount(
      balance.available ??
        account.available_balance ??
        account.balance_available ??
        balance.current ??
        0,
    ),
    accountMask: typeof account.number === "string" ? account.number.slice(-4) : null,
    transactions,
    rawData: account,
  } satisfies NormalizedExternalAccount;
}

class TinkAdapter implements OpenBankingProvider {
  provider: BankProvider = "tink";
  institutions = BANK_INSTITUTIONS.filter((institution) => institution.provider === "tink");

  async createLinkSession(params: { userId: string; institution: BankInstitution }) {
    const runtime = getTinkRuntimeStatus();
    if (!runtime.configured) {
      return {
        consentReference: buildHash([params.userId, params.institution.id, Date.now()]),
        mode: "sandbox" as const,
        metadata: {
          institution: params.institution.name,
          note: "Sandbox session generated locally until live Tink credentials are wired.",
        },
      };
    }

    const clientToken = await tinkTokenRequest({
      grantType: "client_credentials",
      scope: "user:create authorization:grant authorization:read provider-consents:read credentials:read credentials:write",
    });
    const externalUserId = sanitizeTinkExternalUserId(params.userId);
    const createdUser = await tinkRequest<{ user_id?: string; id?: string }>(
      "/api/v1/user/create",
      clientToken.access_token,
      {
        method: "POST",
        body: JSON.stringify({
          external_user_id: externalUserId,
          market: "ES",
          locale: "es_ES",
        }),
      },
    );
    const tinkUserId = createdUser.user_id ?? createdUser.id;
    if (!tinkUserId) {
      throw new Error("Tink no devolvió el identificador del usuario permanente.");
    }

    const delegatedForm = new URLSearchParams();
    delegatedForm.set("user_id", tinkUserId);
    delegatedForm.set("actor_client_id", getTinkConfig().clientId);
    delegatedForm.set("scope", "accounts:read balances:read transactions:read provider-consents:read credentials:read credentials:write");
    delegatedForm.set("id_hint", params.institution.name);

    const delegatedAuth = await tinkRequest<{ code?: string; authorization_code?: string }>(
      "/api/v1/oauth/authorization-grant/delegate",
      clientToken.access_token,
      {
        method: "POST",
        formData: delegatedForm,
      },
    );
    const authorizationCode = delegatedAuth.code ?? delegatedAuth.authorization_code;
    if (!authorizationCode) {
      throw new Error("Tink no devolvió authorization_code para abrir Tink Link.");
    }

    const connectionReference = buildHash([params.userId, params.institution.id, Date.now()]);
    const redirectUri = `${getTinkConfig().appUrl}/api/banking/tink/callback?connection_reference=${connectionReference}`;

    return {
      consentReference: connectionReference,
      mode: "live" as const,
      accessToken: clientToken.access_token,
      metadata: {
        institution: params.institution.name,
        tink_user_id: tinkUserId,
        external_user_id: externalUserId,
        widget_url: buildTinkLinkUrl({
          authorizationCode,
          redirectUri,
          market: "ES",
          locale: "es_ES",
        }),
        tink_runtime: "tink_link",
      },
    };
  }

  async exchangeConsent(params: { institution: BankInstitution; consentReference: string }) {
    const runtime = getTinkRuntimeStatus();
    if (runtime.configured) {
      return {
        consentReference: params.consentReference,
        mode: "live" as const,
        metadata: {
          provider: "tink",
          stage: "awaiting_widget_callback",
        },
      };
    }

    return {
      consentReference: params.consentReference,
      mode: "sandbox" as const,
      accessToken: `sandbox-${params.institution.id}`,
      refreshToken: `sandbox-refresh-${params.institution.id}`,
      metadata: {
        provider: "tink",
      },
    };
  }

  async syncAccounts(params: { connection: BankConnection }) {
    const institution = this.institutions.find(
      (candidate) => candidate.id === params.connection.institution_id,
    );

    if (!institution) {
      throw new Error("Institucion de Tink no encontrada");
    }

    const userAccessToken =
      params.connection.access_token ||
      (typeof params.connection.metadata?.user_access_token === "string"
        ? params.connection.metadata.user_access_token
        : null);

    if (getTinkRuntimeStatus().configured && params.connection.connection_mode === "live" && userAccessToken) {
      const [accountsResponse, transactionsResponse] = await Promise.all([
        tinkRequest<{ accounts?: Record<string, unknown>[]; results?: Record<string, unknown>[] }>(
          "/data/v2/accounts",
          userAccessToken,
        ),
        tinkRequest<{ transactions?: Record<string, unknown>[]; results?: Record<string, unknown>[] }>(
          "/data/v2/transactions",
          userAccessToken,
        ),
      ]);

      const accounts = accountsResponse.accounts ?? accountsResponse.results ?? [];
      const transactions = transactionsResponse.transactions ?? transactionsResponse.results ?? [];

      return accounts.map((account) => {
        const accountId = String(account.id ?? "");
        const accountTransactions = transactions
          .filter((transaction) => {
            const accountRef =
              transaction.account && typeof transaction.account === "object"
                ? (transaction.account as Record<string, unknown>)
                : null;
            const transactionAccount = String(transaction.accountId ?? accountRef?.id ?? "");
            return transactionAccount === accountId;
          })
          .map(normalizeTinkTransaction);

        return normalizeTinkAccount(account, accountTransactions);
      });
    }

    return buildMockAccounts(institution);
  }

  async refreshConnection(params: { connection: BankConnection }) {
    const userAccessToken = getTinkConnectionUserToken(params.connection);

    if (!getTinkRuntimeStatus().configured || params.connection.connection_mode !== "live" || !userAccessToken) {
      return;
    }

    const consents = await listTinkProviderConsents(params.connection);
    const selectedConsent =
      consents.find((consent) => consent.credentialsId && String(consent.status ?? "").toLowerCase().includes("valid")) ??
      consents.find((consent) => consent.credentialsId) ??
      null;

    if (!selectedConsent?.credentialsId) {
      throw new Error("Tink no devolvio credentialsId para refrescar la conexion.");
    }

    const consentStatus = String(selectedConsent.status ?? "").toLowerCase();
    if (consentStatus.includes("expired") || consentStatus.includes("error") || consentStatus.includes("authentication")) {
      throw new Error("El consentimiento de Tink requiere reconfirmacion antes de refrescar.");
    }

    await tinkRequest(`/api/v1/credentials/${encodeURIComponent(selectedConsent.credentialsId)}/refresh`, userAccessToken, {
      method: "POST",
    });
  }
  async revokeConnection(params: { connection: BankConnection }) {
    const userAccessToken =
      params.connection.access_token ||
      (typeof params.connection.metadata?.user_access_token === "string"
        ? params.connection.metadata.user_access_token
        : null);

    if (!getTinkRuntimeStatus().configured || params.connection.connection_mode !== "live" || !userAccessToken) {
      return;
    }

    await tinkRequest("/api/v1/oauth/revoke-all", userAccessToken, {
      method: "POST",
    });
  }
}

class BelvoAdapter implements OpenBankingProvider {
  provider: BankProvider = "belvo";
  institutions = BANK_INSTITUTIONS.filter((institution) => institution.provider === "belvo");

  async createLinkSession(params: { userId: string; institution: BankInstitution }) {
    const runtime = getBelvoRuntimeStatus();
    if (!runtime.configured) {
      return {
        consentReference: buildHash([params.userId, params.institution.id, Date.now()]),
        mode: "sandbox" as const,
        metadata: {
          institution: params.institution.name,
          note: "Pilot/sandbox session generated locally until live Belvo credentials are wired.",
        },
      };
    }

    const externalId = sanitizeBelvoExternalId(params.userId);
    const callbackBase = `${getBelvoConfig().appUrl}/api/banking/belvo/callback`;
    const connectionReference = buildHash([params.userId, params.institution.id, Date.now()]);
    const tokenResponse = await belvoRequest<{ access: string; refresh?: string | null }>("/api/token/", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        id: getBelvoConfig().secretId,
        password: getBelvoConfig().secretPassword,
        scopes: "read_institutions,write_links,read_links,read_accounts,read_transactions",
        stale_in: "30d",
        fetch_resources: ["ACCOUNTS", "TRANSACTIONS"],
        widget: {
          callback_urls: {
            success: `${callbackBase}?state=success&connection_reference=${connectionReference}`,
            exit: `${callbackBase}?state=exit&connection_reference=${connectionReference}`,
            event: `${callbackBase}?state=event&connection_reference=${connectionReference}`,
          },
        },
      }),
    });

    return {
      consentReference: connectionReference,
      mode: "live" as const,
      accessToken: tokenResponse.access,
      refreshToken: tokenResponse.refresh ?? null,
      metadata: {
        institution: params.institution.name,
        external_id: externalId,
        widget_url: buildBelvoWidgetUrl(tokenResponse.access, {
          access_mode: "recurrent",
          external_id: externalId,
          locale: "es",
        }),
        belvo_runtime: "hosted_widget",
      },
    };
  }

  async exchangeConsent(params: { institution: BankInstitution; consentReference: string }) {
    const runtime = getBelvoRuntimeStatus();
    if (runtime.configured) {
      return {
        consentReference: params.consentReference,
        mode: "live" as const,
        metadata: {
          provider: "belvo",
          stage: "awaiting_widget_callback",
        },
      };
    }

    return {
      consentReference: params.consentReference,
      mode: "sandbox" as const,
      accessToken: `sandbox-${params.institution.id}`,
      refreshToken: `sandbox-refresh-${params.institution.id}`,
      metadata: {
        provider: "belvo",
      },
    };
  }

  async syncAccounts(params: { connection: BankConnection }) {
    const institution = this.institutions.find(
      (candidate) => candidate.id === params.connection.institution_id,
    );

    if (!institution) {
      throw new Error("Institucion de Belvo no encontrada");
    }

    const linkId = resolveBelvoLinkId(params.connection);
    if (getBelvoRuntimeStatus().configured && params.connection.connection_mode === "live" && linkId) {
      const [accounts, transactions] = await Promise.all([
        belvoList<Record<string, unknown>>(`/api/accounts/?link=${encodeURIComponent(linkId)}&page_size=1000`),
        belvoList<Record<string, unknown>>(`/api/transactions/?link=${encodeURIComponent(linkId)}&page_size=1000`),
      ]);

      return accounts.map((account) => {
        const accountId = String(account.id ?? "");
        const accountTransactions = transactions
          .filter((transaction) => {
            const transactionAccount = String(transaction.account ?? transaction.account_id ?? "");
            return transactionAccount === accountId;
          })
          .map(normalizeBelvoTransaction);

        return normalizeBelvoAccount(account, accountTransactions);
      });
    }

    return buildMockAccounts(institution);
  }

  async refreshConnection() {}
  async revokeConnection(params: { connection: BankConnection }) {
    const linkId = resolveBelvoLinkId(params.connection);
    if (!getBelvoRuntimeStatus().configured || params.connection.connection_mode !== "live" || !linkId) {
      return;
    }

    await belvoRequest(`/api/links/${encodeURIComponent(linkId)}/`, {
      method: "DELETE",
    });
  }
}

const PROVIDERS: Record<BankProvider, OpenBankingProvider> = {
  tink: new TinkAdapter(),
  belvo: new BelvoAdapter(),
};

export function getOpenBankingProvider(provider: BankProvider) {
  return PROVIDERS[provider];
}

export function getSupportedBankInstitutions(countryCode?: string) {
  if (!countryCode) {
    return BANK_INSTITUTIONS;
  }

  return BANK_INSTITUTIONS.filter((institution) => institution.country_code === countryCode);
}

export function getBankingProviderRuntimeStatus(provider: BankProvider): BankingProviderRuntimeStatus {
  if (provider === "belvo") {
    return getBelvoRuntimeStatus();
  }

  if (provider === "tink") {
    return getTinkRuntimeStatus();
  }

  return {
    configured: false,
    mode: "sandbox",
    label: "sandbox local",
  };
}

export function getInstitutionOperationalHint(institution: BankInstitution) {
  if (institution.provider === "belvo") {
    return buildBelvoInstitutionSupportNote(institution.id);
  }

  if (institution.provider === "tink") {
    return buildTinkInstitutionSupportNote(institution.id);
  }

  return "Institucion disponible con el proveedor configurado para este pais.";
}

export async function buildTinkReconnectSession(params: {
  connection: BankConnection;
}) {
  if (params.connection.provider !== "tink") {
    throw new Error("La reconfirmacion solo aplica a conexiones Tink.");
  }

  if (!getTinkRuntimeStatus().configured || params.connection.connection_mode !== "live") {
    throw new Error("Tink no esta configurado en modo real para reconfirmar consentimiento.");
  }

  const tinkUserId = getTinkConnectionUserId(params.connection);
  if (!tinkUserId) {
    throw new Error("Falta el tink_user_id para reconstruir el flujo de reconfirmacion.");
  }

  const consents = await listTinkProviderConsents(params.connection);
  const selectedConsent =
    consents.find((consent) => consent.credentialsId) ??
    consents[0] ??
    null;

  if (!selectedConsent?.credentialsId) {
    throw new Error("No encontramos credentialsId en Tink para extender el consentimiento.");
  }

  const authorizationCode = await createTinkDelegatedAuthorizationCode({
    userId: tinkUserId,
    institutionName: params.connection.institution_name,
  });

  if (!authorizationCode) {
    throw new Error("Tink no devolvio authorization_code para reconfirmar el consentimiento.");
  }

  const redirectUri = `${getTinkConfig().appUrl}/api/banking/tink/callback?connection_reference=${params.connection.consent_reference}`;

  return {
    widgetUrl: buildTinkLinkUrl({
      authorizationCode,
      redirectUri,
      market: "ES",
      locale: "es_ES",
      credentialsId: selectedConsent.credentialsId,
    }),
    metadata: {
      latest_provider_consent_id: selectedConsent.providerConsentId,
      latest_credentials_id: selectedConsent.credentialsId,
      latest_provider_consent_status: selectedConsent.status,
      latest_provider_name: selectedConsent.providerName,
      sync_stage: "waiting_widget",
    },
  };
}

function transactionStatusFromExternal(tx: NormalizedExternalTransaction): FinanceTransaction["status"] {
  return tx.status === "posted" ? "posted" : "pending";
}

function transactionSourceType() {
  return "synced_transaction";
}

function transactionHash(connection: BankConnection, account: NormalizedExternalAccount, tx: NormalizedExternalTransaction) {
  return buildHash([
    connection.provider,
    account.externalId,
    tx.externalId,
    tx.postedDate,
    tx.amount,
    tx.description,
  ]);
}

async function upsertSyncedAccount(params: {
  supabase: any;
  userId: string;
  connection: BankConnection;
  externalAccount: NormalizedExternalAccount;
}) {
  const accountOpeningBalance = params.externalAccount.currentBalance - params.externalAccount.transactions.reduce(
    (total, tx) => total + (tx.kind === "income" ? tx.amount : -tx.amount),
    0,
  );

  const accountName = `${params.connection.institution_name} · ${params.externalAccount.name}`;
  const { data: existingAccount } = await params.supabase
    .from("accounts")
    .select("*")
    .eq("user_id", params.userId)
    .eq("provider", params.connection.provider)
    .eq("external_account_id", params.externalAccount.externalId)
    .maybeSingle();

  let accountId = existingAccount?.id as string | undefined;

  if (accountId) {
    await params.supabase
      .from("accounts")
      .update({
        name: accountName,
        type: params.externalAccount.type,
        currency: params.externalAccount.currency,
        opening_balance: accountOpeningBalance,
        include_in_budget: params.externalAccount.type !== "credit_card" && params.externalAccount.type !== "loan",
        origin: "synced",
        country_code: params.connection.country_code,
        provider: params.connection.provider,
        external_account_id: params.externalAccount.externalId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", params.userId);
  } else {
    const created = await params.supabase
      .from("accounts")
      .insert({
        user_id: params.userId,
        name: accountName,
        type: params.externalAccount.type,
        currency: params.externalAccount.currency,
        opening_balance: accountOpeningBalance,
        include_in_budget: params.externalAccount.type !== "credit_card" && params.externalAccount.type !== "loan",
        origin: "synced",
        country_code: params.connection.country_code,
        provider: params.connection.provider,
        external_account_id: params.externalAccount.externalId,
      })
      .select("*")
      .single();

    accountId = created.data?.id;
  }

  if (!accountId) {
    throw new Error("No se pudo crear la cuenta sincronizada");
  }

  const { data: externalAccount } = await params.supabase
    .from("external_accounts")
    .upsert(
      {
        user_id: params.userId,
        bank_connection_id: params.connection.id,
        provider: params.connection.provider,
        external_id: params.externalAccount.externalId,
        name: params.externalAccount.name,
        type: params.externalAccount.type,
        currency: params.externalAccount.currency,
        current_balance: params.externalAccount.currentBalance,
        available_balance: params.externalAccount.availableBalance ?? params.externalAccount.currentBalance,
        account_mask: params.externalAccount.accountMask ?? null,
        institution_id: params.connection.institution_id,
        institution_name: params.connection.institution_name,
        account_id: accountId,
        sync_state: "current",
        raw_data: params.externalAccount.rawData ?? {},
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,external_id",
      },
    )
    .select("*")
    .single();

  return {
    accountId,
    externalAccountId: externalAccount.id as string,
  };
}

async function ensureLinkedDebt(params: {
  supabase: any;
  userId: string;
  connection: BankConnection;
  account: FinanceAccount;
  externalAccount: NormalizedExternalAccount;
}) {
  if (params.account.type !== "credit_card" && params.account.type !== "loan") {
    return;
  }

  const { data: existingDebt } = await params.supabase
    .from("debt_obligations")
    .select("*")
    .eq("user_id", params.userId)
    .eq("provider", params.connection.provider)
    .eq("external_account_id", params.externalAccount.externalId)
    .maybeSingle();

  const payload = {
    user_id: params.userId,
    name: params.account.name,
    debt_type: params.account.type === "credit_card" ? "credit_card" : "loan",
    currency: params.account.currency,
    original_balance: Math.abs(params.externalAccount.currentBalance),
    current_balance: Math.abs(params.externalAccount.currentBalance),
    payment_minimum: Math.max(0, Math.abs(params.externalAccount.currentBalance) * 0.05),
    payment_target: Math.max(0, Math.abs(params.externalAccount.currentBalance) * 0.1),
    due_day: 15,
    status: Math.abs(params.externalAccount.currentBalance) > 0 ? "active" : "paid",
    liability_account_id: params.account.id,
    payment_account_id: params.account.id,
    provider: params.connection.provider,
    external_account_id: params.externalAccount.externalId,
    metadata: {
      synced: true,
      institution_name: params.connection.institution_name,
    },
    updated_at: new Date().toISOString(),
  };

  if (existingDebt) {
    await params.supabase
      .from("debt_obligations")
      .update(payload)
      .eq("id", existingDebt.id)
      .eq("user_id", params.userId);
  } else {
    await params.supabase.from("debt_obligations").insert(payload);
  }
}

export async function syncBankConnectionData(params: {
  supabase: any;
  userId: string;
  connection: BankConnection;
}) {
  const provider = getOpenBankingProvider(params.connection.provider);
  const syncStartedAt = new Date().toISOString();

  await params.supabase
    .from("bank_connections")
    .update({
      status: params.connection.status === "connected" ? "connected" : "pending",
      visible_error: null,
      metadata: mergeMetadata(params.connection.metadata, {
        sync_stage: "syncing",
        sync_started_at: syncStartedAt,
      }),
      updated_at: syncStartedAt,
    })
    .eq("id", params.connection.id)
    .eq("user_id", params.userId);

  try {
    await provider.refreshConnection({ connection: params.connection });

    const normalizedAccounts = await provider.syncAccounts({
      connection: params.connection,
    });

    for (const normalizedAccount of normalizedAccounts) {
      const linked = await upsertSyncedAccount({
        supabase: params.supabase,
        userId: params.userId,
        connection: params.connection,
        externalAccount: normalizedAccount,
      });

      const { data: account } = await params.supabase
        .from("accounts")
        .select("*")
        .eq("id", linked.accountId)
        .single();

      await ensureLinkedDebt({
        supabase: params.supabase,
        userId: params.userId,
        connection: params.connection,
        account,
        externalAccount: normalizedAccount,
      });

      for (const tx of normalizedAccount.transactions) {
        const dedupeHash = transactionHash(params.connection, normalizedAccount, tx);
        const signedAmount = tx.amount;

        const { data: existingExternal } = await params.supabase
          .from("external_transactions")
          .select("*")
          .eq("provider", params.connection.provider)
          .eq("dedupe_hash", dedupeHash)
          .maybeSingle();

        let transactionId = existingExternal?.transaction_id as string | undefined;

        if (!transactionId) {
          const insertedTransaction = await params.supabase
            .from("transactions")
            .insert({
              user_id: params.userId,
              account_id: linked.accountId,
              amount: signedAmount,
              kind: tx.kind,
              origin: "synced",
              status: transactionStatusFromExternal(tx),
              transaction_date: tx.postedDate,
              posted_date: tx.status === "posted" ? tx.postedDate : null,
              title: tx.description,
              category: tx.categoryHint ?? (tx.kind === "income" ? "ingreso" : "otros"),
              merchant_name: tx.merchantName ?? null,
              source_type: transactionSourceType(),
              external_transaction_id: tx.externalId ?? dedupeHash,
              external_account_id: linked.externalAccountId,
              sync_state: "current",
              pending_source_data: {
                provider: params.connection.provider,
                direction: tx.kind === "income" ? "credit" : "debit",
              },
              authorized_date: tx.authorizedDate,
            })
            .select("*")
            .single();

          transactionId = insertedTransaction.data?.id;
        }

        await params.supabase
          .from("external_transactions")
          .upsert(
            {
              user_id: params.userId,
              external_account_id: linked.externalAccountId,
              provider: params.connection.provider,
              external_id: tx.externalId ?? null,
              dedupe_hash: dedupeHash,
              amount: tx.amount,
              currency: tx.currency,
              direction: tx.kind === "income" ? "credit" : "debit",
              status: tx.status,
              authorized_date: tx.authorizedDate,
              posted_date: tx.postedDate,
              description: tx.description,
              merchant_name: tx.merchantName ?? null,
              category_hint: tx.categoryHint ?? null,
              raw_data: tx.rawData ?? {},
              normalized_data: {
                kind: tx.kind,
                provider: params.connection.provider,
              },
              transaction_id: transactionId ?? null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "provider,dedupe_hash",
            },
          );
      }
    }

    await params.supabase
      .from("bank_connections")
      .update({
        status: "connected",
        visible_error: null,
        last_synced_at: new Date().toISOString(),
        metadata: mergeMetadata(params.connection.metadata, {
          sync_stage: "synced",
          last_sync_result: "ok",
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.connection.id)
      .eq("user_id", params.userId);
  } catch (error) {
    const visibleError =
      params.connection.provider === "tink"
        ? humanizeTinkError(error)
        : humanizeProviderError(error);

    await params.supabase
      .from("bank_connections")
      .update({
        status: "attention",
        visible_error: visibleError,
        metadata: mergeMetadata(params.connection.metadata, {
          sync_stage: "error",
          last_sync_result: "error",
          last_sync_error: visibleError,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.connection.id)
      .eq("user_id", params.userId);

    await params.supabase
      .from("external_accounts")
      .update({
        sync_state: "stale",
        updated_at: new Date().toISOString(),
      })
      .eq("bank_connection_id", params.connection.id)
      .eq("user_id", params.userId);

    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/budget");
  revalidatePath("/dashboard/banking");
  revalidatePath("/dashboard/debts");
}
