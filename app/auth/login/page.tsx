"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common/theme-toggle";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <main className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-background">
      {/* Theme Toggle at top right */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] space-y-8">
        {/* Brand Header */}
        <div className="space-y-2">
          <Link
            href="/"
            className="font-heading-style text-4xl font-black tracking-tighter hover:opacity-80 transition-opacity block"
          >
            zetsu<span className="text-primary font-serif">.</span>
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
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Contraseña</Label>
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
