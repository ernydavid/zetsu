import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBankConnectionData } from "@/lib/finance/banking";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function mapBelvoWebhookState(body: Record<string, unknown>) {
  const webhookCode = typeof body.webhook_code === "string" ? body.webhook_code.toLowerCase() : "";
  const processType = typeof body.process_type === "string" ? body.process_type.toLowerCase() : "";
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const rawMessage = typeof data.message === "string" ? data.message : "";

  const isSyncReady =
    webhookCode.includes("historical_update") ||
    processType.includes("historical_update") ||
    processType.includes("recurrent_update");
  const isInvalid =
    webhookCode.includes("invalid") ||
    webhookCode.includes("error") ||
    processType.includes("error") ||
    rawMessage.toLowerCase().includes("invalid");

  if (isInvalid) {
    return {
      status: "attention" as const,
      syncStage: "error",
      visibleError: rawMessage || "Belvo marco esta conexion con error o consentimiento invalido.",
      shouldSync: false,
    };
  }

  if (isSyncReady) {
    return {
      status: "connected" as const,
      syncStage: "ready",
      visibleError: null,
      shouldSync: true,
    };
  }

  return {
    status: "connected" as const,
    syncStage: "waiting_webhook",
    visibleError: null,
    shouldSync: false,
  };
}

function mapTinkWebhookState(body: Record<string, unknown>) {
  const eventName = String(
    body.eventName ??
      body.event_type ??
      body.notificationName ??
      body.name ??
      "",
  ).toLowerCase();
  const status = String(body.status ?? "").toLowerCase();

  const shouldSync =
    eventName.includes("transaction") ||
    eventName.includes("account") ||
    eventName.includes("consent") ||
    status.includes("finished") ||
    status.includes("updated");
  const requiresAttention =
    eventName.includes("error") ||
    eventName.includes("reconfirm") ||
    eventName.includes("consent_expired") ||
    status.includes("failed");

  if (requiresAttention) {
    return {
      status: "attention" as const,
      syncStage: "error",
      visibleError: "Tink reporto que la conexion necesita reconfirmacion o revisar credenciales.",
      shouldSync: false,
    };
  }

  return {
    status: "connected" as const,
    syncStage: shouldSync ? "ready" : "waiting_webhook",
    visibleError: null,
    shouldSync,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const payload = await request.json().catch(() => null);

  if (provider === "belvo" && payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    const linkId = typeof body.link_id === "string" ? body.link_id : null;
    const webhookState = mapBelvoWebhookState(body);

    if (linkId) {
      const { data: connection } = await supabase
        .from("bank_connections")
        .select("*")
        .eq("provider", "belvo")
        .or(`metadata->>belvo_link_id.eq.${linkId},metadata->>link_id.eq.${linkId}`)
        .maybeSingle();

      if (connection) {
        const nextMetadata = {
          ...(connection.metadata ?? {}),
          last_webhook: body,
          last_webhook_code: body.webhook_code ?? null,
          last_process_type: body.process_type ?? null,
          sync_stage: webhookState.syncStage,
        };

        await supabase
          .from("bank_connections")
          .update({
            status: webhookState.status,
            visible_error: webhookState.visibleError,
            metadata: nextMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        if (webhookState.shouldSync) {
          await syncBankConnectionData({
            supabase,
            userId: connection.user_id,
            connection: {
              ...connection,
              status: webhookState.status,
              visible_error: webhookState.visibleError,
              metadata: nextMetadata,
            },
          });
        }
      }
    }
  }

  if (provider === "tink" && payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    const webhookState = mapTinkWebhookState(body);
    const tinkUserId = typeof body.userId === "string" ? body.userId : null;
    const externalUserId = typeof body.externalUserId === "string" ? body.externalUserId : null;

    let query = supabase.from("bank_connections").select("*").eq("provider", "tink");

    if (tinkUserId) {
      query = query.eq("metadata->>tink_user_id", tinkUserId);
    } else if (externalUserId) {
      query = query.eq("metadata->>external_user_id", externalUserId);
    } else {
      query = query.limit(0);
    }

    const { data: connections } = await query;

    for (const connection of connections ?? []) {
      const nextMetadata = {
        ...(connection.metadata ?? {}),
        last_webhook: body,
        last_webhook_code: body.eventName ?? body.event_type ?? body.notificationName ?? null,
        sync_stage: webhookState.syncStage,
      };

      await supabase
        .from("bank_connections")
        .update({
          status: webhookState.status,
          visible_error: webhookState.visibleError,
          metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      if (webhookState.shouldSync) {
        await syncBankConnectionData({
          supabase,
          userId: connection.user_id,
          connection: {
            ...connection,
            status: webhookState.status,
            visible_error: webhookState.visibleError,
            metadata: nextMetadata,
          },
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    provider,
    received: payload !== null,
    note: "Webhook procesado para refresco incremental del proveedor cuando aplica.",
  });
}
