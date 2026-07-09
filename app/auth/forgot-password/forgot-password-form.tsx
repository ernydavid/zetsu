"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/app/auth/actions";
import { AppLogo } from "@/components/common/app-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordFormProps = {
  callbackError?: string;
};

export function ForgotPasswordForm({ callbackError }: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    null,
  );

  return (
    <main className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-background">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] space-y-8">
        <div className="space-y-2">
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity inline-flex"
          >
            <AppLogo size="lg" variant="full" priority />
          </Link>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Recupera el acceso a tu cuenta
          </p>
        </div>

        <Card className="bg-background">
          <CardContent className="pt-0">
            <form action={formAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                  disabled={isPending}
                />
                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                  Te enviaremos un enlace de un solo uso para restablecer tu
                  contraseña.
                </p>
              </div>

              {state?.success && (
                <div className="p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-mono leading-relaxed">
                  {state.success}
                </div>
              )}

              {callbackError && (
                <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-xs font-mono leading-relaxed">
                  {callbackError}
                </div>
              )}

              {state?.error && (
                <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-xs font-mono">
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                className="w-full justify-center"
                disabled={isPending}
              >
                {isPending ? "ENVIANDO..." : "ENVIAR ENLACE"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
          ¿Recordaste tu clave?{" "}
          <Link
            href="/auth/login"
            className="text-foreground underline underline-offset-4 font-bold hover:text-muted-foreground transition-colors"
          >
            VOLVER AL LOGIN
          </Link>
        </p>
      </div>
    </main>
  );
}
