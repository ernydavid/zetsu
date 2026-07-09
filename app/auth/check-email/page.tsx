import Link from "next/link";

import { AppLogo } from "@/components/common/app-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CheckEmailPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pickSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function maskEmail(email?: string) {
  if (!email || !email.includes("@")) {
    return "tu correo";
  }

  const [localPart, domain] = email.split("@");
  const safeLocal = localPart.length <= 2
    ? `${localPart[0] ?? "*"}*`
    : `${localPart.slice(0, 2)}${"*".repeat(Math.max(localPart.length - 2, 2))}`;

  return `${safeLocal}@${domain}`;
}

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const email = pickSingleValue(resolvedSearchParams.email);
  const error = pickSingleValue(resolvedSearchParams.error);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[460px] space-y-8">
        <div className="space-y-2">
          <Link
            href="/"
            className="inline-flex transition-opacity hover:opacity-80"
          >
            <AppLogo size="lg" variant="full" priority />
          </Link>
          <p className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            confirma tu correo para continuar
          </p>
        </div>

        <Card className="bg-background">
          <CardContent className="space-y-5 pt-0">
            <div className="space-y-3">
              <h1 className="font-heading-style text-3xl font-black lowercase tracking-tight">
                revisa tu bandeja
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enviamos un enlace de confirmación a <span className="font-mono text-foreground">{maskEmail(email)}</span>.
                Confirma tu cuenta para activar el acceso y comenzar tu onboarding en Zetsu.
              </p>
            </div>

            {error && (
              <div className="border border-destructive bg-destructive/10 p-3 text-xs font-mono text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-3 border-t border-dashed border-border pt-5">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                consejos rápidos
              </p>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li>Busca el correo en spam, promociones o social.</li>
                <li>El remitente debe coincidir con el dominio configurado en Zetsu.</li>
                <li>Cuando confirmes, te enviaremos directamente al onboarding.</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/auth/login">
                <Button variant="outline">ir al login</Button>
              </Link>
              <Link href="/auth/signup">
                <Button variant="brutalist">usar otro correo</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
