import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppLogo } from "@/components/common/app-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { IconArrowRight } from "@tabler/icons-react";

export default async function WelcomePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, base_currency")
    .eq("id", user.id)
    .single();

  if (!profile?.full_name || !profile?.base_currency) {
    redirect("/onboarding");
  }

  const firstName = profile.full_name.split(" ")[0]?.toLowerCase() || "usuario";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-soft-bg/50 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-60 w-60 rounded-full bg-muted/40 blur-3xl" />
      </div>

      <Card className="relative w-full max-w-xl border border-premium bg-card/95 shadow-premium-lg backdrop-blur-sm">
        <CardContent className="pt-0">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="relative flex items-center justify-center pt-4">
              <span className="absolute h-28 w-64 rounded-full bg-accent-soft-bg/55 blur-2xl animate-pulse" />
              <div className="relative animate-pulse">
                <AppLogo variant="full" size="lg" priority />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-heading-style text-3xl font-black lowercase text-foreground md:text-4xl">
                bienvenido, {firstName}
              </h1>
              <p className="mx-auto max-w-md text-sm font-mono leading-relaxed text-muted-foreground">
                Tu espacio financiero ya quedó preparado.
              </p>
            </div>

            <div className="flex w-full justify-center">
              <Link href="/dashboard" className="min-w-56">
                <Button className="w-full justify-center gap-2" variant="soft">
                  continuar
                  <IconArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
