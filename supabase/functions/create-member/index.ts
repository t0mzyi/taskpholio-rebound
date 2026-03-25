import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ success: false, error: "Authentication failed: " + (authError?.message ?? "Invalid token") }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile, error: profileFetchError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profileFetchError) {
      return new Response(JSON.stringify({ success: false, error: "Security check failed: No profile found for caller." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["ceo", "cto", "admin"].includes(callerProfile?.role?.toLowerCase() ?? "")) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden: Operations access required. Role: " + callerProfile?.role }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { full_name, email, password, role, team } = await req.json();
    const teamId = typeof team === "string" && team.trim() !== "" ? team : null;

    const { data: newUser, error: createAuthUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createAuthUserError) {
      return new Response(JSON.stringify({ success: false, error: "Auth error: " + createAuthUserError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdUserId = newUser.user?.id;
    if (!createdUserId) {
      return new Response(JSON.stringify({ success: false, error: "Auth user created without id." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
      id: createdUserId,
      full_name,
      email,
      role: role.toLowerCase(),
      team: teamId,
      is_active: true,
    });

    if (upsertError) {
      return new Response(JSON.stringify({ success: false, error: "Profile sync error: " + upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: admins } = await supabaseAdmin.from("profiles").select("id").in("role", ["ceo", "cto"]);
    if (admins?.length) {
      await supabaseAdmin.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: "member_added",
          title: "New member added",
          body: `${full_name} joined as ${role}${teamId ? " in squad deployment" : ""}`,
          ref_id: createdUserId,
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, userId: createdUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: "Global system crash: " + err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
