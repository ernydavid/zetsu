import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { materializeAllRecurringRules } from "@/lib/finance/service";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await materializeAllRecurringRules(supabase, user.id);

  return NextResponse.json({ ok: true });
}
