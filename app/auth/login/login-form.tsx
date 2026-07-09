"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/auth/actions";
import { AppLogo } from "@/components/common/app-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  message?: string;
};

export function LoginForm({ message }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(login, null);
  const [email, setEmail] = React.useState("");

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
            Inicia sesión para gestionar tus finanzas
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
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    olvidé mi contraseña
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isPending}
                />
              </div>

              {message && (
                <div className="p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
                  {message}
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
                {isPending ? "INGRESANDO..." : "INICIAR SESIÓN"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
          ¿No tienes una cuenta?{" "}
          <Link
            href="/auth/signup"
            className="text-foreground underline underline-offset-4 font-bold hover:text-muted-foreground transition-colors"
          >
            REGÍSTRATE AQUÍ
          </Link>
        </p>
      </div>
    </main>
  );
}
