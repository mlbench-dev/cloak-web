import crypto from "crypto";

// Sandbox vs live credential/URL switching, following the same
// process.env.X?.trim() || "fallback" convention used throughout this
// codebase (see lib/reportAiConfidence.ts).
export const PAYFAST_MODE = (process.env.PAYFAST_MODE?.trim() ||
  "sandbox") as "sandbox" | "live";

// A misconfigured production deploy silently accepting fake sandbox
// "payments" as real is the kind of mistake that's cheap to prevent up
// front — mirrors lib/mongodb.ts's throw-on-missing-DATABASE_URL, but as a
// function called from each route handler rather than at module load:
// Next.js executes module-level code for anything reachable from a
// statically-generated page during `next build` (confirmed by
// lib/mongodb.ts's own production-path console.log firing during this
// project's builds), so a load-time throw here would break the build
// itself the moment this file is imported anywhere, not just at runtime.
//
// Vercel sets NODE_ENV=production for EVERY deployment — Preview branches
// included, not just the real production domain — so checking NODE_ENV
// alone blocked sandbox testing on Vercel entirely, which defeats the
// point. VERCEL_ENV ("production" | "preview" | "development") is what
// actually distinguishes the live domain; fall back to NODE_ENV off
// Vercel, where VERCEL_ENV won't exist.
function isRealProductionDeploy(): boolean {
  return process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";
}

export function assertPayfastProductionReady() {
  if (!isRealProductionDeploy() || PAYFAST_MODE === "live") return;

  // Explicit, deliberate escape hatch for testing sandbox mode against
  // the real production domain before live PayFast credentials exist
  // (e.g. pre-launch). Absent this, real production must use live
  // credentials — remove this env var once you actually go live so this
  // guard resumes protecting you.
  if (process.env.PAYFAST_ALLOW_SANDBOX_IN_PRODUCTION === "true") return;

  throw new Error(
    'PAYFAST_MODE must be "live" in production — refusing to process a payment with sandbox credentials active. ' +
      "If you're deliberately testing sandbox mode on this production deployment before going live, set " +
      "PAYFAST_ALLOW_SANDBOX_IN_PRODUCTION=true (and remove it once you switch to live credentials).",
  );
}

const PAYFAST_MERCHANT_ID =
  (PAYFAST_MODE === "live"
    ? process.env.PAYFAST_MERCHANT_ID_LIVE
    : process.env.PAYFAST_MERCHANT_ID_SANDBOX
  )?.trim() || "";

const PAYFAST_MERCHANT_KEY =
  (PAYFAST_MODE === "live"
    ? process.env.PAYFAST_MERCHANT_KEY_LIVE
    : process.env.PAYFAST_MERCHANT_KEY_SANDBOX
  )?.trim() || "";

const PAYFAST_PASSPHRASE =
  (PAYFAST_MODE === "live"
    ? process.env.PAYFAST_PASSPHRASE_LIVE
    : process.env.PAYFAST_PASSPHRASE_SANDBOX
  )?.trim() || "";

export const PAYFAST_PROCESS_URL =
  PAYFAST_MODE === "live"
    ? "https://www.payfast.co.za/eng/process"
    : process.env.PAYFAST_SANDBOX_PROCESS_URL?.trim() ||
      "https://sandbox.payfast.co.za/eng/process";

const PAYFAST_VALIDATE_URL =
  PAYFAST_MODE === "live"
    ? "https://www.payfast.co.za/eng/query/validate"
    : "https://sandbox.payfast.co.za/eng/query/validate";

export function hasPayfastCredentials(): boolean {
  return Boolean(PAYFAST_MERCHANT_ID && PAYFAST_MERCHANT_KEY);
}

// Replicates PHP's urlencode(), which is what PayFast's server uses to
// recompute the signature from what it received. encodeURIComponent gets
// close but disagrees with PHP on two counts: it doesn't turn spaces into
// "+", AND — the one that actually broke checkout here — it deliberately
// leaves `! ' ( ) * ~` un-escaped (they're RFC3986 "unreserved" chars),
// while PHP's urlencode still percent-encodes all six. Any field
// containing them (e.g. an item_name with parentheses) would sign
// differently than what PayFast recomputes without this.
function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// --- Outgoing checkout signature ------------------------------------------
//
// This app's live /eng/process sandbox rejected the fixed-canonical-order,
// passphrase-mid-list algorithm from PayFast's official SDK's internal
// Auth::generateSignature (that may be for a different API surface than
// the classic redirect checkout — unclear, but empirically wrong here).
// What actually works, confirmed against a working reference integration
// on another project: fields concatenated in the order the caller built
// them in (so buildCheckoutFields below must build that object in
// PayFast's documented field order), passphrase appended at the very end.
// Since this object's key order IS the signing order, and the same object
// becomes the submitted form fields (see checkout/_lib/checkout.ts), the
// two stay self-consistent by construction.
export function generateSignature(
  fields: Record<string, string | number | undefined | null>,
  passphrase = PAYFAST_PASSPHRASE,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "" || key === "signature") {
      continue;
    }
    parts.push(`${key}=${pfEncode(String(value).trim())}`);
  }
  let paramString = parts.join("&");
  if (passphrase) {
    paramString += `&passphrase=${pfEncode(passphrase.trim())}`;
  }
  return crypto.createHash("md5").update(paramString).digest("hex");
}

// --- Incoming ITN verification (verified against PayFast's official SDK —
// PaymentIntegrations\Notification::dataToString/pfValidSignature) ---------
//
// Unlike the outgoing signature above, ITN verification uses the fields in
// the order PayFast actually sent them (not the fixed list), with
// passphrase appended at the end — different algorithm, don't conflate the
// two.
export function verifyItnSignatureFromRawBody(
  rawBody: string,
  passphrase = PAYFAST_PASSPHRASE,
): { valid: boolean; fields: Record<string, string>; paramStringForValidation: string } {
  const received = new URLSearchParams(rawBody);
  const receivedSignature = (received.get("signature") || "").toLowerCase();
  received.delete("signature");

  const paramStringForValidation = Array.from(received.entries())
    .map(([key, value]) => `${key}=${pfEncode(value)}`)
    .join("&");

  const signedString = passphrase
    ? `${paramStringForValidation}&passphrase=${pfEncode(passphrase)}`
    : paramStringForValidation;
  const expected = crypto.createHash("md5").update(signedString).digest("hex");

  const fields: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    fields[key] = value;
  }

  return {
    valid: expected.toLowerCase() === receivedSignature,
    fields,
    // The body to POST to /eng/query/validate — fields only, no signature,
    // no passphrase (verified against pfValidServerConfirmation, which is
    // called with the same string used for signing minus the passphrase).
    paramStringForValidation,
  };
}

// --- Source check (defense-in-depth only) ---------------------------------
//
// Matches PayFast's own SDK approach (pfValidIP): NOT the client's source
// IP — the Referer header's hostname, resolved via DNS and checked against
// PayFast's known ITN hostnames. Still defense-in-depth, not the primary
// trust anchor — signature verification above and postBackToValidate below
// are. A spoofed Referer header defeats this on its own; it only helps
// alongside the other two checks.
const PAYFAST_ITN_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

export async function isRequestFromPayfast(refererUrl: string | null): Promise<boolean> {
  if (!refererUrl) return false;

  let refererHost: string;
  try {
    refererHost = new URL(refererUrl).hostname;
  } catch {
    return false;
  }

  const dns = await import("dns/promises");
  try {
    const [refererIps, ...payfastIpLists] = await Promise.all([
      dns.resolve4(refererHost).catch(() => [] as string[]),
      ...PAYFAST_ITN_HOSTS.map((host) => dns.resolve4(host).catch(() => [] as string[])),
    ]);
    if (refererIps.length === 0) return false;
    const payfastIps = new Set(payfastIpLists.flat());
    return refererIps.some((ip) => payfastIps.has(ip));
  } catch (error) {
    console.error("PayFast ITN referer DNS check failed:", error);
    return false;
  }
}

// --- Server-to-server ITN confirmation ------------------------------------
//
// Mirrors the fetch + AbortController + timeout pattern already used for
// external calls in lib/reportAiConfidence.ts's callAiVerificationService.
// Body must be the same field string used for signing, WITHOUT the
// signature field and WITHOUT the passphrase (verified against
// pfValidServerConfirmation).
const PAYFAST_VALIDATE_TIMEOUT_MS = 15_000;

export async function postBackToValidate(paramStringForValidation: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYFAST_VALIDATE_TIMEOUT_MS);

  try {
    const response = await fetch(PAYFAST_VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: paramStringForValidation,
      signal: controller.signal,
    });
    const text = (await response.text()).trim();
    return text === "VALID";
  } catch (error) {
    console.error("PayFast ITN server-validate call failed:", error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Checkout field builder ------------------------------------------------

export type CheckoutFieldsInput = {
  merchantPaymentId: string;
  amountZar: number;
  itemName: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  buyerEmail?: string;
  isRecurring?: boolean;
  recurringAmountZar?: number;
  // PayFast's documented frequency codes — 3 is commonly cited as
  // "Monthly" but confirm against current PayFast docs before relying on
  // this for a live charge.
  frequency?: number;
  cycles?: number; // 0 = indefinite, per PayFast's docs
};

export function buildCheckoutFields(
  input: CheckoutFieldsInput,
): Record<string, string> {
  // Field insertion order here IS the signing order (generateSignature
  // just iterates this object) — matches PayFast's documented field order:
  // merchant details, buyer details, transaction details, then
  // subscription details last.
  const fields: Record<string, string> = {
    merchant_id: PAYFAST_MERCHANT_ID,
    merchant_key: PAYFAST_MERCHANT_KEY,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
  };

  if (input.buyerEmail) {
    fields.email_address = input.buyerEmail;
  }

  fields.m_payment_id = input.merchantPaymentId;
  fields.amount = input.amountZar.toFixed(2);
  fields.item_name = input.itemName;

  if (input.isRecurring) {
    fields.subscription_type = "1";
    fields.billing_date = new Date().toISOString().slice(0, 10);
    fields.recurring_amount = (input.recurringAmountZar ?? input.amountZar).toFixed(2);
    fields.frequency = String(input.frequency ?? 3);
    fields.cycles = String(input.cycles ?? 0);
  }

  const signature = generateSignature(fields);
  return { ...fields, signature };
}

// --- Subscriptions management API (verified against PayFast's official
// SDK — Auth::generateApiSignature + Request::sendApiRequest) --------------
//
// A genuinely different scheme from the checkout one above: headers
// (merchant-id, version, timestamp) merged with any query/body params,
// keys sorted ALPHABETICALLY (not the fixed list), passphrase merged in
// before sorting, MD5'd. Sandbox requests also need a `testing=true` query
// param (added after signing — it's not part of the signed data).
export const PAYFAST_SUBSCRIPTIONS_API_BASE = "https://api.payfast.co.za";
const PAYFAST_API_VERSION = "v1";

function generateApiSignature(
  data: Record<string, string | number | undefined>,
  passphrase = PAYFAST_PASSPHRASE,
): string {
  const merged: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) merged[key] = value;
  }
  if (passphrase) merged.passphrase = passphrase;

  const sortedKeys = Object.keys(merged).sort();
  const parts = sortedKeys
    .filter((key) => key !== "signature")
    .map((key) => `${key}=${pfEncode(String(merged[key]))}`);

  return crypto.createHash("md5").update(parts.join("&")).digest("hex");
}

export function buildManagementApiRequest(params: {
  method: string;
  queryParams?: Record<string, string | number>;
  jsonBody?: Record<string, string | number>;
}): { headers: Record<string, string>; query: Record<string, string> } {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const headers: Record<string, string> = {
    "merchant-id": PAYFAST_MERCHANT_ID,
    version: PAYFAST_API_VERSION,
    timestamp,
  };

  const signatureData = {
    ...headers,
    ...(params.queryParams || {}),
    ...(params.jsonBody || {}),
  };
  headers.signature = generateApiSignature(signatureData);

  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.queryParams || {})) {
    query[key] = String(value);
  }
  if (PAYFAST_MODE === "sandbox") {
    query.testing = "true";
  }

  return { headers, query };
}

export function getPayfastMerchantId(): string {
  return PAYFAST_MERCHANT_ID;
}
