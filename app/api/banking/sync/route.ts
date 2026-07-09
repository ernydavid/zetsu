import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { syncBankConnectionData } from "@/lib/finance/banking";
import type { BankConnection } from "@/lib/finance/types";

type SyncResult = {
  connectionId: string;
  provider: string;
  institution: string;
  ok: boolean;
  message: string;
};

type SyncRouteBody = Record<string, unknown>;

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para la sync automatica.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey);
}

function isCronAuthorized(request: Request) {
  const expectedSecret =
    process.env.BANKING_SYNC_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!expectedSecret) {
    return false;
  }

  const headerSecret =
    request.headers.get("x-banking-sync-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  return headerSecret === expectedSecret;
}

function buildConnectionQuery(supabase: any, body: Record<string, unknown>) {
  let query = supabase
    .from("bank_connections")
    .select("*")
    .in("status", ["connected", "attention"])
    .in("provider", ["tink", "belvo"])
    .order("updated_at", { ascending: true });

  const connectionId = typeof body.connectionId === "string" ? body.connectionId : null;
  const provider = typeof body.provider === "string" ? body.provider : null;
  const countryCode =
    typeof body.countryCode === "string" ? body.countryCode.toUpperCase() : null;
  const userId = typeof body.userId === "string" ? body.userId : null;
  const onlyLive = body.onlyLive !== false;
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(body.limit, 100))
      : 25;

  if (connectionId) {
    query = query.eq("id", connectionId);
  }

  if (provider) {
    query = query.eq("provider", provider);
  }

  if (countryCode) {
    query = query.eq("country_code", countryCode);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (onlyLive) {
    query = query.eq("connection_mode", "live");
  }

  return query.limit(limit);
}

async function runSyncBatch(params: {
  supabase: any;
  connections: BankConnection[];
}) {
  const results: SyncResult[] = [];

  for (const connection of params.connections) {
    try {
      await syncBankConnectionData({
        supabase: params.supabase,
        userId: connection.user_id,
        connection,
      });

      results.push({
        connectionId: connection.id,
        provider: connection.provider,
        institution: connection.institution_name,
        ok: true,
        message: "Sincronizacion completada",
      });
    } catch (error) {
      results.push({
        connectionId: connection.id,
        provider: connection.provider,
        institution: connection.institution_name,
        ok: false,
        message: error instanceof Error ? error.message : "Error desconocido en sincronizacion",
      });
    }
  }

  return results;
}

async function handleSyncRequest(request: Request, body: SyncRouteBody) {
  const cronMode = isCronAuthorized(request);

  if (cronMode) {
    const supabase = getServiceSupabase();
    const { data: connections, error } = await buildConnectionQuery(supabase, body);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = await runSyncBatch({
      supabase,
      connections: (connections ?? []) as BankConnection[],
    });

    return NextResponse.json({
      ok: true,
      mode: "cron",
      attempted: results.length,
      synced: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let query = supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["connected", "attention"]);
  const connectionId = typeof body.connectionId === "string" ? body.connectionId : null;

  if (connectionId) {
    query = query.eq("id", connectionId);
  }

  const { data: connections, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await runSyncBatch({
    supabase,
    connections: (connections ?? []) as BankConnection[],
  });

  return NextResponse.json({
    ok: true,
    mode: "user",
    attempted: results.length,
    synced: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const body: SyncRouteBody = {
    connectionId: searchParams.get("connectionId") || undefined,
    provider: searchParams.get("provider") || undefined,
    countryCode: searchParams.get("countryCode") || undefined,
    userId: searchParams.get("userId") || undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    onlyLive: searchParams.get("onlyLive") === "false" ? false : true,
  };

  return handleSyncRequest(request, body);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleSyncRequest(request, body);
}
