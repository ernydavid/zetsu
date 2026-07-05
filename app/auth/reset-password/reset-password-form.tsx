"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateRecoveredPassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common/theme-toggle";

interface ResetPasswordFormProps {
  email: string;
}

export function ResetPasswordForm({ email }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    updateRecoveredPassword,
    null,
  );

  return (
    <main className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-background">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[420px] space-y-8">
        <div className="space-y-2">
          <Link
            href="/"
            className="font-heading-style text-4xl font-black tracking-tighter hover:opacity-80 transition-opacity block"
          >
            zetsu<span className="text-primary font-serif">.</span>
          </Link>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            Crea una nueva contraseña
          </p>
        </div>

        <Card className="bg-background">
          <CardContent className="pt-0">
            <form action={formAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Cuenta</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Nueva Contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  disabled={isPending}
                />
                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                  Usa al menos 8 caracteres, una letra y un número.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repite tu nueva contraseña"
                  required
                  autoComplete="new-password"
                  disabled={isPending}
                />
              </div>

              {state?.error && (
                <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-xs font-mono leading-relaxed">
                  {state.error}
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                className="w-full justify-center"
                disabled={isPending}
              >
                {isPending ? "ACTUALIZANDO..." : "GUARDAR NUEVA CLAVE"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
