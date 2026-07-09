import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncBankConnectionData } from "@/lib/finance/banking";

function buildRedirectUrl(origin: string, path: string, messageKey: "error" | "notice", message: string) {
  const url = new URL(path, origin);
  url.searchParams.set(messageKey, message);
  return url;
}

async function exchangeTinkAuthorizationCode(code: string) {
  const clientId = process.env.TINK_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.TINK_CLIENT_SECRET?.trim() || "";

  if (!clientId || !clientSecret) {
    throw new Error("Tink no esta configurado en el servidor.");
  }

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "authorization_code");
  form.set("code", code);

  const response = await fetch("https://api.tink.com/api/v1/oauth/token", {
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

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const connectionReference = searchParams.get("connection_reference");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description") || error || "No se pudo completar la conexion con Tink.";

  if (!connectionReference) {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/dashboard/banking", "error", "Falta la referencia de conexion de Tink."),
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/auth/login", "error", "Inicia sesion para terminar la conexion bancaria."),
    );
  }

  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "tink")
    .eq("consent_reference", connectionReference)
    .maybeSingle();

  if (!connection) {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/dashboard/banking", "error", "No encontramos la conexion pendiente de Tink."),
    );
  }

  if (!code) {
    await supabase
      .from("bank_connections")
      .update({
        status: "attention",
        visible_error: errorDescription,
        metadata: {
          ...(connection.metadata ?? {}),
          callback_state: "error",
          sync_stage: "error",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    return NextResponse.redirect(buildRedirectUrl(origin, "/dashboard/banking", "error", errorDescription));
  }

  try {
    const tokenResponse = await exchangeTinkAuthorizationCode(code);
    const updatedConnection = {
      ...connection,
      status: "connected",
      connection_mode: "live",
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token ?? null,
      visible_error: null,
      metadata: {
        ...(connection.metadata ?? {}),
        callback_state: "success",
        sync_stage: "syncing",
        user_access_token: tokenResponse.access_token,
      },
    };

    await supabase
      .from("bank_connections")
      .update({
        status: "connected",
        connection_mode: "live",
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token ?? null,
        visible_error: null,
        metadata: updatedConnection.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    await syncBankConnectionData({
      supabase,
      userId: user.id,
      connection: updatedConnection,
    });

    return NextResponse.redirect(
      buildRedirectUrl(origin, "/dashboard/banking", "notice", "Tink conecto tu cuenta y sincronizo los datos."),
    );
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : "No se pudo completar la conexion con Tink.";

    await supabase
      .from("bank_connections")
      .update({
        status: "attention",
        visible_error: message,
        metadata: {
          ...(connection.metadata ?? {}),
          callback_state: "error",
          sync_stage: "error",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    return NextResponse.redirect(buildRedirectUrl(origin, "/dashboard/banking", "error", message));
  }
}
