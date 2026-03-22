import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// Lipila Payment Gateway — Edge Function
// Docs: https://docs.lipila.dev
// ============================================
// Supported actions:
//   collect  → MoMo: POST /api/v1/collections/mobile-money
//              Card: POST /api/v1/collections/card
//   disburse → MoMo: POST /api/v1/disbursements/mobile-money
//              Bank: POST /api/v1/disbursements/bank
//   status   → GET  /api/v1/{collections|disbursements}/check-status?referenceId=xxx
// ============================================

type LipilaAction = "collect" | "disburse" | "status";
type PaymentMethod = "momo" | "card" | "bank";

interface LipilaRequestBody {
  action: LipilaAction;
  paymentMethod?: PaymentMethod; // defaults to "momo"
  amount?: number;
  accountNumber: string;
  currency?: string;
  narration?: string;
  referenceId?: string;
  email?: string;
  // Bank disbursement fields
  swiftCode?: string;
  firstName?: string;
  lastName?: string;
  accountHolderName?: string;
  phoneNumber?: string;
  // Card collection fields
  city?: string;
  country?: string;
  address?: string;
  zip?: string;
  backUrl?: string;
  redirectUrl?: string;
}

// SWIFT codes for supported Zambian banks
const BANK_SWIFT_CODES: Record<string, string> = {
  fnb: "FIRNZMLX",
  zanaco: "ZNCOZMLU",
  absa: "BARCZMLU",
};

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "null",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Lipila expects accountNumber as 260XXXXXXXXX (no + prefix)
function toAccountNumber(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("260")) return digits;
  if (digits.startsWith("0")) return `260${digits.slice(1)}`;
  return `260${digits}`;
}

function getLipilaConfig() {
  const mode = (Deno.env.get("LIPILA_MODE") || "sandbox").toLowerCase();
  const isSandbox = mode !== "live";
  return {
    mode: isSandbox ? "sandbox" : "live",
    baseUrl: isSandbox
      ? (Deno.env.get("LIPILA_SANDBOX_URL") || "https://api.lipila.dev")
      : (Deno.env.get("LIPILA_LIVE_URL") || "https://blz.lipila.io"),
    apiKey: isSandbox
      ? (Deno.env.get("LIPILA_SANDBOX_API_KEY") || "")
      : (Deno.env.get("LIPILA_LIVE_API_KEY") || ""),
    callbackUrl: Deno.env.get("LIPILA_CALLBACK_URL") || "",
  };
}

function getEndpoint(
  action: LipilaAction,
  baseUrl: string,
  paymentMethod: PaymentMethod = "momo",
  referenceId?: string,
): { url: string; method: string } {
  const base = baseUrl.replace(/\/$/, "");
  if (action === "collect") {
    if (paymentMethod === "card") {
      return { url: `${base}/api/v1/collections/card`, method: "POST" };
    }
    return { url: `${base}/api/v1/collections/mobile-money`, method: "POST" };
  }
  if (action === "disburse") {
    if (paymentMethod === "bank") {
      return { url: `${base}/api/v1/disbursements/bank`, method: "POST" };
    }
    return { url: `${base}/api/v1/disbursements/mobile-money`, method: "POST" };
  }
  // status — determine type from referenceId prefix or default to collections
  const isDisburse = referenceId?.includes("D") || referenceId?.includes("disburse");
  const path = isDisburse ? "disbursements" : "collections";
  return { url: `${base}/api/v1/${path}/check-status?referenceId=${referenceId}`, method: "GET" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" });
  }

  try {
    // 1. Verify Supabase session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "No authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      console.error("[lipila] Auth failed:", authError?.message);
      return json({ success: false, error: "Invalid or expired session" });
    }
    console.log(`[lipila] Authenticated user: ${authData.user.id.slice(0, 8)}...`);

    // 2. Parse request
    const body = (await req.json()) as LipilaRequestBody;
    if (!body.action || !["collect", "disburse", "status"].includes(body.action)) {
      return json({ success: false, error: "Invalid action. Use collect, disburse, or status." });
    }
    const paymentMethod: PaymentMethod = body.paymentMethod || "momo";
    const maskedAccount = body.accountNumber ? body.accountNumber.slice(0, 3) + '****' + body.accountNumber.slice(-2) : '(none)';
    console.log(`[lipila] Action: ${body.action}, method: ${paymentMethod}, amount: ${body.amount}, account: ${maskedAccount}`);

    // 3. Resolve Lipila config
    const config = getLipilaConfig();
    console.log(`[lipila] Config: mode=${config.mode}, apiKeySet=${!!config.apiKey}`);
    if (!config.apiKey) {
      return json({ success: false, error: `Lipila ${config.mode} API key is not configured. Set LIPILA_${config.mode.toUpperCase()}_API_KEY.` });
    }

    // 4. Status check
    if (body.action === "status") {
      if (!body.referenceId) {
        return json({ success: false, error: "referenceId is required for status check" });
      }
      const ep = getEndpoint("status", config.baseUrl, body.referenceId);
      const statusRes = await fetch(ep.url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-api-key": config.apiKey,
        },
      });
      const statusData = await statusRes.json().catch(() => null);
      if (!statusRes.ok) {
        console.error(`[lipila] Status check failed: HTTP ${statusRes.status}`, statusData);
        return json({ success: false, error: statusData?.message || `Status check failed (HTTP ${statusRes.status})`, lipilaResponse: statusData });
      }
      return json({ success: true, ...statusData });
    }

    // 5. Validate collect/disburse params
    if (!body.amount || body.amount <= 0) {
      return json({ success: false, error: "amount must be greater than 0" });
    }
    if (!body.accountNumber) {
      return json({ success: false, error: "accountNumber is required" });
    }

    const referenceId = body.referenceId || `monde-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ep = getEndpoint(body.action, config.baseUrl, paymentMethod);

    // Build Lipila request body based on payment method
    let lipilaBody: Record<string, unknown>;

    if (body.action === "collect" && paymentMethod === "card") {
      // Card collection — nested customerInfo + collectionRequest structure per Lipila docs
      const accountNumber = body.accountNumber || "";
      const nameParts = (body.accountHolderName || "Customer User").split(" ");
      const firstName = body.firstName || nameParts[0] || "Customer";
      const lastName = body.lastName || nameParts.slice(1).join(" ") || "User";
      const phone = toAccountNumber(body.phoneNumber || accountNumber) || "260000000000";
      const email = body.email || `${phone}@monde.app`;
      lipilaBody = {
        customerInfo: {
          firstName,
          lastName,
          phoneNumber: phone,
          city: body.city || "Lusaka",
          country: body.country || "ZM",
          address: body.address || "Lusaka, Zambia",
          zip: body.zip || "10101",
          email,
        },
        collectionRequest: {
          referenceId,
          amount: body.amount,
          narration: body.narration || "Monde top-up via card",
          accountNumber: phone,
          currency: body.currency || "ZMW",
          backUrl: body.backUrl || config.callbackUrl || "https://monde.app",
          redirectUrl: body.redirectUrl || config.callbackUrl || "https://monde.app",
        },
      };
    } else if (body.action === "disburse" && paymentMethod === "bank") {
      // Bank disbursement — flat body per Lipila docs
      const accountNumber = body.accountNumber || "";
      if (!accountNumber) {
        return json({ success: false, error: "Bank account number is required for bank disbursements" });
      }
      const swiftCode = body.swiftCode || "";
      if (!swiftCode) {
        return json({ success: false, error: "Swift code is required for bank disbursements. Supported banks: FNB, Zanaco, Absa." });
      }
      const nameParts = (body.accountHolderName || "").split(" ");
      const firstName = body.firstName || nameParts[0] || "Account";
      const lastName = body.lastName || nameParts.slice(1).join(" ") || "Holder";
      const phone = toAccountNumber(body.phoneNumber || "") || "260000000000";
      lipilaBody = {
        referenceId,
        amount: body.amount,
        currency: body.currency || "ZMW",
        narration: body.narration || "Monde withdrawal to bank",
        accountNumber,
        swiftCode,
        firstName,
        lastName,
        accountHolderName: body.accountHolderName || `${firstName} ${lastName}`,
        phoneNumber: phone,
      };
      // Only include email if provided (optional per Lipila docs)
      if (body.email) {
        lipilaBody.email = body.email;
      }
    } else {
      // MoMo collection or MoMo disbursement — standard flat body
      const accountNumber = toAccountNumber(body.accountNumber);
      if (!accountNumber || accountNumber.length < 12) {
        return json({ success: false, error: `Invalid account number: ${accountNumber}` });
      }
      lipilaBody = {
        referenceId,
        amount: body.amount,
        accountNumber,
        currency: body.currency || "ZMW",
      };
      if (body.action === "collect") {
        lipilaBody.narration = body.narration || "Monde top-up";
        if (body.email) lipilaBody.email = body.email;
      } else {
        if (body.narration) lipilaBody.narration = body.narration;
      }
    }

    // Build headers — x-api-key for auth, callbackUrl in header (per Lipila docs)
    const headers: Record<string, string> = {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    };
    if (config.callbackUrl && body.action === "collect") {
      headers["callbackUrl"] = config.callbackUrl;
    }

    // 6. Call Lipila API
    console.log(`[lipila] Calling: ${ep.method} ${ep.url}`);
    const lipilaRes = await fetch(ep.url, {
      method: ep.method,
      headers,
      body: JSON.stringify(lipilaBody),
    });

    // Detect redirect (fetch follows automatically but strips custom headers like x-api-key)
    const wasRedirected = lipilaRes.url && lipilaRes.url !== ep.url;
    if (wasRedirected) {
      console.warn(`[lipila] REDIRECT detected: ${ep.url} -> ${lipilaRes.url}`);
    }

    const rawText = await lipilaRes.text();
    let lipilaData: any = null;
    try {
      lipilaData = rawText ? JSON.parse(rawText) : null;
    } catch {
      lipilaData = { raw: rawText };
    }

    console.log(`[lipila] Lipila response: HTTP ${lipilaRes.status}`, rawText.substring(0, 500));

    if (!lipilaRes.ok) {
      console.error(`[lipila] Lipila API error: HTTP ${lipilaRes.status}`, lipilaData);
      console.error(`[lipila] Request URL: ${ep.url}, method: ${ep.method}`);
      return json({
        success: false,
        error: lipilaData?.message || `Lipila ${body.action} failed (HTTP ${lipilaRes.status})`,
        lipilaStatusCode: lipilaRes.status,
      });
    }

    // 7. Check response status
    const status = (lipilaData?.status || "").toString().toLowerCase();
    const accepted = ["successful", "pending"].includes(status);

    if (!accepted) {
      console.warn(`[lipila] Unexpected status: ${lipilaData?.status}`, lipilaData);
      return json({
        success: false,
        error: lipilaData?.message || `Lipila transaction status: ${lipilaData?.status}`,
        lipilaResponse: lipilaData,
      });
    }

    // 8. Return success
    return json({
      success: true,
      mode: config.mode,
      action: body.action,
      paymentMethod,
      referenceId: lipilaData?.referenceId || referenceId,
      identifier: lipilaData?.identifier || null,
      status: lipilaData?.status || "Pending",
      paymentType: lipilaData?.paymentType || null,
      message: lipilaData?.message || "Transaction sent for processing",
      // Card collections return a redirect URL for 3D Secure
      cardRedirectionUrl: lipilaData?.cardRedirectionUrl || null,
    });
  } catch (err: any) {
    console.error("[lipila] Unhandled error:", err);
    return json({ success: false, error: err?.message || "Internal error" });
  }
});
