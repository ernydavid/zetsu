import * as React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SettingsClient } from "./settings-client";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorMsg = typeof params.error === "string" ? params.error : undefined;
  const tab = typeof params.tab === "string" ? params.tab : undefined;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.full_name || !profile.base_currency) {
    redirect("/onboarding");
  }

  const currency = profile.base_currency;
  const isPro = profile.billing_tier === "pro";

  return (
    <SettingsClient
      profile={profile}
      isPro={isPro}
      currency={currency}
      errorMsg={errorMsg}
      initialTab={tab}
    />
  );
}
