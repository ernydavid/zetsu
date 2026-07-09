"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import { AppLogo } from "@/components/common/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common/theme-toggle";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signup, null);

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
            className="hover:opacity-80 transition-opacity inline-flex"
          >
            <AppLogo size="lg" variant="full" priority />
          </Link>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Crea una cuenta para empezar tu onboarding
          </p>
        </div>

        <Card className="bg-background">
          <CardContent className="pt-0">
            <form action={formAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Tu nombre completo"
                  required
                  disabled={isPending}
                />
              </div>

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
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
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
                {isPending ? "REGISTRANDO..." : "CREAR CUENTA"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs font-mono text-muted-foreground uppercase tracking-wider">
          ¿Ya tienes una cuenta?{" "}
          <Link
            href="/auth/login"
            className="text-foreground underline underline-offset-4 font-bold hover:text-muted-foreground transition-colors"
          >
            INICIA SESIÓN AQUÍ
          </Link>
        </p>
      </div>
    </main>
  );
}
