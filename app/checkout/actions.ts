"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function upgradeToPro() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No se pudo autenticar al usuario. Inicia sesión nuevamente." };
  }

  // 2. Update user profile to Pro
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      billing_tier: "pro",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return { error: `Error al actualizar a Pro: ${profileError.message}` };
  }

  return { success: true };
}
