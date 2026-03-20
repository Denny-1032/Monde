import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================
// Lipila Callback Handler — Edge Function
// Docs: https://docs.lipila.dev/docs/billing/callback.html
// ============================================
// Lipila sends callbacks when transactions are Successful or Failed.
// This function receives the callback and updates the corresponding
// transaction record in Supabase.
//
// Callback payload shape:
// {
//   referenceId, currency, amount, accountNumber, status,
//   paymentType, type, ipAddress, identifier, message, externalId
// }
// ============================================

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers": "content-type, x-callback-secret, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Verify transaction status directly with Lipila API (defense-in-depth)
async function verifyWithLipila(referenceId: string): Promise<{ verified: boolean; status?: string }> {
  const mode = (Deno.env.get("LIPILA_MODE") || "sandbox").toLowerCase();
  const isSandbox = mode !== "live";
  const baseUrl = isSandbox
    ? (Deno.env.get("LIPILA_SANDBOX_URL") || "https://api.lipila.dev")
    : (Deno.env.get("LIPILA_LIVE_URL") || "https://blz.lipila.io");
  const apiKey = isSandbox
    ? (Deno.env.get("LIPILA_SANDBOX_API_KEY") || "")
    : (Deno.env.get("LIPILA_LIVE_API_KEY") || "");

  if (!apiKey) {
    console.warn("[lipila-callback] No API key configured — cannot verify callback with Lipila");
    return { verified: false };
  }

  // Try collections first, then disbursements
  for (const path of ["collections", "disbursements"]) {
    try {
      const url = `${baseUrl.replace(/\/$/, "")}/api/v1/${path}/check-status?referenceId=${encodeURIComponent(referenceId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json", "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.referenceId === referenceId) {
          return { verified: true, status: data.status };
        }
      }
    } catch {}
  }
  return { verified: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // SECURITY: Validate callback authenticity via shared secret header
    const callbackSecret = Deno.env.get("LIPILA_CALLBACK_SECRET") || "";
    if (callbackSecret) {
      const providedSecret = req.headers.get("x-callback-secret") || req.headers.get("x-webhook-secret") || "";
      if (providedSecret !== callbackSecret) {
        console.warn("[lipila-callback] Invalid or missing callback secret");
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json();

    const {
      referenceId,
      status,
      amount,
      accountNumber,
      paymentType,
      type,
      identifier,
      message,
      externalId,
    } = body as {
      referenceId?: string;
      status?: string;
      amount?: number;
      accountNumber?: string;
      paymentType?: string;
      type?: string;
      identifier?: string;
      message?: string;
      externalId?: string;
    };

    if (!referenceId || !status) {
      return json({ error: "Missing referenceId or status" }, 400);
    }

    // SECURITY: Verify the callback status with Lipila API directly
    // This prevents forged callbacks from crediting wallets or reversing withdrawals
    const normalizedStatus = status.toLowerCase();
    const isFinancialAction = normalizedStatus === "successful" || normalizedStatus === "failed";
    if (isFinancialAction) {
      const verification = await verifyWithLipila(referenceId);
      if (verification.verified) {
        const verifiedStatus = (verification.status || "").toLowerCase();
        if (verifiedStatus !== normalizedStatus) {
          console.error(`[lipila-callback] STATUS MISMATCH: callback says "${status}" but Lipila API says "${verification.status}" for ${referenceId}`);
          return json({ received: true, referenceId, status: "rejected", reason: "Status mismatch with Lipila API" });
        }
      } else {
        console.warn(`[lipila-callback] Could not verify referenceId=${referenceId} with Lipila API — proceeding with caution`);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not set — cannot process callback");
      return json({ error: "Server misconfiguration" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const isSuccess = normalizedStatus === "successful";
    const isFailed = normalizedStatus === "failed";

    // Log the callback for audit purposes
    const maskedAccount = accountNumber ? accountNumber.slice(0, 3) + '****' + accountNumber.slice(-2) : '(none)';
    console.log(`[lipila-callback] ref=${referenceId} status=${status} type=${type} paymentType=${paymentType} account=${maskedAccount}`);

    // Try to find the transaction by lipila_reference_id (primary) or reference (fallback)
    let txn: any = null;
    let findErr: any = null;

    const { data: txn1, error: err1 } = await adminClient
      .from("transactions")
      .select("id, status, type")
      .eq("lipila_reference_id", referenceId)
      .maybeSingle();
    txn = txn1;
    findErr = err1;

    // Fallback: try the reference column for older transactions
    if (!txn && !findErr) {
      const { data: txn2, error: err2 } = await adminClient
        .from("transactions")
        .select("id, status, type")
        .eq("reference", referenceId)
        .maybeSingle();
      txn = txn2;
      findErr = err2;
    }

    if (findErr) {
      console.error(`[lipila-callback] DB lookup error: ${findErr.message}`);
    }

    if (txn) {
      // --- Two-phase top-up: pending → confirmed/failed ---
      if (txn.type === "topup" && txn.status === "pending") {
        if (isSuccess) {
          // User approved the MoMo prompt → credit their wallet
          const { data: confirmData, error: confirmErr } = await adminClient
            .rpc("confirm_pending_topup", { p_transaction_id: txn.id });
          if (confirmErr) {
            console.error(`[lipila-callback] confirm_pending_topup error: ${confirmErr.message}`);
          } else {
            console.log(`[lipila-callback] Top-up ${txn.id} confirmed:`, confirmData);
          }
        } else if (isFailed) {
          // User cancelled or MoMo rejected → mark transaction as failed (no balance change)
          await adminClient
            .from("transactions")
            .update({ status: "failed", note: `Lipila ${status}: ${message || "Payment declined"}`.trim() })
            .eq("id", txn.id);
          console.log(`[lipila-callback] Top-up ${txn.id} failed: ${message || status}`);
        }
      }
      // --- Withdrawal reversal: if disbursement failed, refund the user ---
      else if (txn.type === "withdraw" && isFailed && txn.status === "completed") {
        const { data: reverseData, error: reverseErr } = await adminClient
          .rpc("reverse_failed_withdraw", {
            p_transaction_id: txn.id,
            p_reason: `Lipila disbursement failed: ${message || status}`,
          });
        if (reverseErr) {
          console.error(`[lipila-callback] reverse_failed_withdraw error: ${reverseErr.message}`);
        } else {
          console.log(`[lipila-callback] Withdrawal ${txn.id} reversed:`, reverseData);
        }
      }
      // --- Standard status update for other cases ---
      else {
        const newStatus = isSuccess ? "completed" : isFailed ? "failed" : txn.status;
        if (newStatus !== txn.status) {
          const { error: updateErr } = await adminClient
            .from("transactions")
            .update({
              status: newStatus,
              note: `Lipila ${status}: ${message || ""}`.trim(),
            })
            .eq("id", txn.id);
          if (updateErr) {
            console.error(`[lipila-callback] Update error: ${updateErr.message}`);
          } else {
            console.log(`[lipila-callback] Transaction ${txn.id} updated to ${newStatus}`);
          }
        }
      }
    } else {
      // Transaction not found by reference — log for manual reconciliation
      console.warn(`[lipila-callback] No transaction found for referenceId=${referenceId}. Storing in lipila_callbacks table.`);

      // Store in a dedicated callbacks table for reconciliation
      await adminClient.from("lipila_callbacks").insert({
        reference_id: referenceId,
        status,
        amount,
        account_number: accountNumber,
        payment_type: paymentType,
        transaction_type: type,
        identifier,
        message,
        external_id: externalId,
        raw_payload: body,
      }).catch((e: any) => {
        // Table may not exist yet — that's OK, log it
        console.warn(`[lipila-callback] Could not insert to lipila_callbacks: ${e?.message}`);
      });
    }

    // Always return 200 to Lipila so they don't retry
    return json({ received: true, referenceId, status });
  } catch (err: any) {
    console.error(`[lipila-callback] Error: ${err?.message}`);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
