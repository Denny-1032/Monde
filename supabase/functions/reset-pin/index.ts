import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Same PIN-to-password derivation as client: lib/validation.ts → pinToPassword
function pinToPassword(pin: string): string {
  return `Mn!${pin}#Zk`;
}

function phoneToEmail(phone: string): string {
  // Convert +260971234567 or 260971234567 → 260971234567@monde.app
  return `${phone.replace(/[^0-9]/g, "")}@monde.app`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller has a valid session (phone OTP session after verifyOtp)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: sessionError } = await userClient.auth.getUser();
    if (sessionError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please request a new OTP." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { phone, newPin } = body as { phone: string; newPin: string };

    if (!phone || !newPin) {
      return new Response(JSON.stringify({ error: "Missing phone or newPin" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!/^\d{4}$/.test(newPin)) {
      return new Response(JSON.stringify({ error: "PIN must be exactly 4 digits" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const formattedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/[^0-9]/g, "")}`;
    const newPassword = pinToPassword(newPin);

    // Look up the profile by phone — profiles.id === auth.users.id (same UUID)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", formattedPhone)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "No account found for this phone number. Please register first." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update the email-auth user's password (profile.id = auth.users.id)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If the phone-auth user is different (no identity linking), update it too
    if (callerUser.id !== profile.id) {
      await adminClient.auth.admin.updateUserById(callerUser.id, {
        password: newPassword,
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
