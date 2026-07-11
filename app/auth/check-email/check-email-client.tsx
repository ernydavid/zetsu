"use client";

import * as React from "react";
import Link from "next/link";
import { IconLoader2 } from "@tabler/icons-react";
import { sileo } from "sileo";
import { resendVerificationEmail } from "@/app/auth/actions";
import { AppLogo } from "@/components/common/app-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CheckEmailClientProps = {
  email?: string;
  error?: string;
  message?: string;
  initialCooldownSeconds: number;
};

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

export function CheckEmailClient({
  email,
  error,
  message,
  initialCooldownSeconds,
}: CheckEmailClientProps) {
  const [cooldownSeconds, setCooldownSeconds] = React.useState(
    Math.max(0, initialCooldownSeconds),
  );
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  React.useEffect(() => {
    if (!error && !message) {
      return;
    }

    if (error) {
      sileo.error({ title: decodeURIComponent(error) });
    }

    if (message) {
      sileo.success({ title: decodeURIComponent(message) });
    }

    const timer = window.setTimeout(() => {
      window.history.replaceState(null, "", window.location.pathname);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [error, message]);

  const handleResend = () => {
    startTransition(async () => {
      try {
        const result = await resendVerificationEmail(email ?? "");

        if (result.error) {
          if (typeof result.retryAfterSeconds === "number") {
            setCooldownSeconds(result.retryAfterSeconds);
          }
          sileo.error({ title: result.error });
          return;
        }

        if (typeof result.retryAfterSeconds === "number") {
          setCooldownSeconds(result.retryAfterSeconds);
        }

        if (result.success) {
          sileo.success({ title: result.success });
        }
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof err.digest === "string" &&
          err.digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }

        sileo.error({
          title:
            err instanceof Error
              ? err.message
              : "No pudimos reenviar el correo de verificación.",
        });
      }
    });
  };

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

            {message && (
              <div className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-mono text-emerald-700 dark:text-emerald-300">
                {decodeURIComponent(message)}
              </div>
            )}

            {error && (
              <div className="border border-destructive bg-destructive/10 p-3 text-xs font-mono text-destructive">
                {decodeURIComponent(error)}
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

            <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                ¿No llegó el correo?
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Puedes pedir otro enlace de verificación cada 180 segundos.
              </p>
              {cooldownSeconds > 0 ? (
                <p className="text-xs font-mono text-muted-foreground">
                  Podrás reenviarlo en {cooldownSeconds}s.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={handleResend}
                disabled={isPending || !email || cooldownSeconds > 0}
                className="w-full justify-center sm:w-auto"
              >
                {isPending ? <IconLoader2 className="mr-2 size-4 animate-spin" /> : null}
                {isPending
                  ? "REENVIANDO..."
                  : cooldownSeconds > 0
                    ? `REENVIAR EN ${cooldownSeconds}S`
                    : "REENVIAR VERIFICACIÓN"}
              </Button>
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
