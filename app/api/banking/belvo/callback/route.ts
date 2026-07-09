import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function buildRedirectUrl(origin: string, path: string, messageKey: "error" | "notice", message: string) {
  const url = new URL(path, origin);
  url.searchParams.set(messageKey, message);
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const state = searchParams.get("state") || "event";
  const connectionReference = searchParams.get("connection_reference");
  const linkId = searchParams.get("link");
  const institutionName = searchParams.get("institution");
  const errorDescription =
    searchParams.get("error_description") || searchParams.get("error") || "No se pudo completar la conexion con Belvo.";

  if (!connectionReference) {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/dashboard/banking", "error", "Falta la referencia de conexion de Belvo."),
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
    .eq("provider", "belvo")
    .eq("consent_reference", connectionReference)
    .maybeSingle();

  if (!connection) {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/dashboard/banking", "error", "No encontramos la conexion pendiente de Belvo."),
    );
  }

  if (state === "success" && linkId) {
    await supabase
      .from("bank_connections")
      .update({
        status: "connected",
        connection_mode: "live",
        visible_error: "Conexion completada. Esperando sincronizacion historica de Belvo o refresco manual.",
        metadata: {
          ...(connection.metadata ?? {}),
          belvo_link_id: linkId,
          link_id: linkId,
          belvo_institution_name: institutionName || connection.institution_name,
          callback_state: state,
          sync_stage: "waiting_webhook",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", user.id);

    return NextResponse.redirect(
      buildRedirectUrl(
        origin,
        "/dashboard/banking",
        "notice",
        "Belvo conecto tu cuenta. La app sincronizara cuando llegue el webhook o cuando refresques manualmente.",
      ),
    );
  }

  await supabase
    .from("bank_connections")
    .update({
      status: "attention",
      visible_error: state === "exit" ? "El usuario salio del flujo de Belvo antes de completarlo." : errorDescription,
      metadata: {
        ...(connection.metadata ?? {}),
        callback_state: state,
        sync_stage: "error",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("user_id", user.id);

  return NextResponse.redirect(buildRedirectUrl(origin, "/dashboard/banking", "error", errorDescription));
}
