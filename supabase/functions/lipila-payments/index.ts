import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// Lipila Payment Gateway — Edge Function
// Docs: https://docs.lipila.dev
// ============================================
// Supported actions:
//   collect  → POST /api/v1/collections/mobile-money   (top-up: MNO → Lipila wallet)
//   disburse → POST /api/v1/disbursements/mobile-money  (withdraw: Lipila wallet → MNO)
//   status   → GET  /api/v1/{collections|disbursements}/check-status?referenceId=xxx
// ============================================

type LipilaAction = "collect" | "disburse" | "status";

interface LipilaRequestBody {
  action: LipilaAction;
  amount?: number;
  accountNumber: string;
  currency?: string;
  narration?: string;
  referenceId?: string;
  email?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
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

function getEndpoint(action: LipilaAction, baseUrl: string, referenceId?: string): { url: string; method: string } {
  const base = baseUrl.replace(/\/$/, "");
  if (action === "collect") {
    return { url: `${base}/api/v1/collections/mobile-money`, method: "POST" };
  }
  if (action === "disburse") {
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
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Verify Supabase session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "No authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user) {
      return json({ success: false, error: "Invalid or expired session" }, 401);
    }

    // 2. Parse request
    const body = (await req.json()) as LipilaRequestBody;
    if (!body.action || !["collect", "disburse", "status"].includes(body.action)) {
      return json({ success: false, error: "Invalid action. Use collect, disburse, or status." }, 400);
    }

    // 3. Resolve Lipila config
    const config = getLipilaConfig();
    if (!config.apiKey) {
      return json({ success: false, error: `Lipila ${config.mode} API key is not configured. Set LIPILA_${config.mode.toUpperCase()}_API_KEY.` }, 500);
    }

    // 4. Status check
    if (body.action === "status") {
      if (!body.referenceId) {
        return json({ success: false, error: "referenceId is required for status check" }, 400);
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
        return json({ success: false, error: statusData?.message || `Status check failed (${statusRes.status})`, lipilaResponse: statusData }, statusRes.status === 404 ? 404 : 502);
      }
      return json({ success: true, ...statusData });
    }

    // 5. Validate collect/disburse params
    if (!body.amount || body.amount <= 0) {
      return json({ success: false, error: "amount must be greater than 0" }, 400);
    }
    if (!body.accountNumber) {
      return json({ success: false, error: "accountNumber is required" }, 400);
    }

    const accountNumber = toAccountNumber(body.accountNumber);
    if (!accountNumber || accountNumber.length < 12) {
      return json({ success: false, error: `Invalid account number: ${accountNumber}` }, 400);
    }

    const referenceId = body.referenceId || `monde-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ep = getEndpoint(body.action, config.baseUrl);

    // Build Lipila request body per docs
    const lipilaBody: Record<string, unknown> = {
      referenceId,
      amount: body.amount,
      accountNumber,
      currency: body.currency || "ZMW",
    };

    if (body.action === "collect") {
      // narration is required for collections
      lipilaBody.narration = body.narration || "Monde top-up";
      if (body.email) lipilaBody.email = body.email;
    } else {
      // narration is optional for disbursements
      if (body.narration) lipilaBody.narration = body.narration;
    }

    // Build headers — x-api-key for auth, callbackUrl in header (per Lipila docs)
    const headers: Record<string, string> = {
      accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    };
    if (config.callbackUrl) {
      headers["callbackUrl"] = config.callbackUrl;
    }

    // 6. Call Lipila API
    const lipilaRes = await fetch(ep.url, {
      method: ep.method,
      headers,
      body: JSON.stringify(lipilaBody),
    });

    const rawText = await lipilaRes.text();
    let lipilaData: any = null;
    try {
      lipilaData = rawText ? JSON.parse(rawText) : null;
    } catch {
      lipilaData = { raw: rawText };
    }

    if (!lipilaRes.ok) {
      return json({
        success: false,
        error: lipilaData?.message || `Lipila ${body.action} failed (HTTP ${lipilaRes.status})`,
        lipilaStatusCode: lipilaRes.status,
        lipilaResponse: lipilaData,
      }, 502);
    }

    // 7. Check response status
    const status = (lipilaData?.status || "").toString().toLowerCase();
    const accepted = ["successful", "pending"].includes(status);

    if (!accepted) {
      return json({
        success: false,
        error: lipilaData?.message || `Lipila transaction status: ${lipilaData?.status}`,
        lipilaResponse: lipilaData,
      }, 400);
    }

    // 8. Return success
    return json({
      success: true,
      mode: config.mode,
      action: body.action,
      referenceId: lipilaData?.referenceId || referenceId,
      identifier: lipilaData?.identifier || null,
      status: lipilaData?.status || "Pending",
      paymentType: lipilaData?.paymentType || null,
      message: lipilaData?.message || "Transaction sent for processing",
    });
  } catch (err: any) {
    return json({ success: false, error: err?.message || "Internal error" }, 500);
  }
});
