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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not set — cannot process callback");
      return json({ error: "Server misconfiguration" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const normalizedStatus = status.toLowerCase();
    const isSuccess = normalizedStatus === "successful";
    const isFailed = normalizedStatus === "failed";

    // Log the callback for audit purposes
    console.log(`[lipila-callback] referenceId=${referenceId} status=${status} type=${type} paymentType=${paymentType} amount=${amount} identifier=${identifier}`);

    // Try to find the transaction by reference field matching the Lipila referenceId
    const { data: txn, error: findErr } = await adminClient
      .from("transactions")
      .select("id, status, type")
      .eq("reference", referenceId)
      .maybeSingle();

    if (findErr) {
      console.error(`[lipila-callback] DB lookup error: ${findErr.message}`);
    }

    if (txn) {
      // Update the transaction status based on callback
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
