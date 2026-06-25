"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { upgradeToPro } from "@/app/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { IconCreditCard, IconLock, IconShieldCheck, IconLoader } from "@tabler/icons-react";

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [cardName, setCardName] = React.useState("");
  const [cardNumber, setCardNumber] = React.useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = React.useState("12/29");
  const [cardCvc, setCardCvc] = React.useState("•••");

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await upgradeToPro();
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        // Successful payment redirect to dashboard
        router.push("/dashboard?upgrade=success");
      }
    } catch (err) {
      setError("Error al procesar el pago. Intente nuevamente.");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-background relative">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[650px] grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Order Summary (col-span-5) */}
        <div className="md:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="font-heading-style text-2xl font-black tracking-tighter">
              zetsu<span className="text-primary font-serif">.</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Suscripción Mensual
              </span>
              <h1 className="font-heading-style text-xl font-bold tracking-tight lowercase">
                Zetsu Premium (Pro)
              </h1>
            </div>
            <div className="border-t border-dashed border-border pt-4 space-y-2">
              <div className="flex justify-between font-mono text-sm">
                <span>Premium Plan</span>
                <span>$9.00 USD</span>
              </div>
              <div className="flex justify-between font-mono text-sm">
                <span>Impuesto (0%)</span>
                <span>$0.00 USD</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-border">
            <p className="text-3xl font-mono font-bold tracking-tighter">$9.00 <span className="text-xs font-normal">USD / mes</span></p>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase">
              <IconLock className="size-4 text-emerald-500" /> Transacción Segura
            </div>
          </div>
        </div>

        {/* Card Details (col-span-7) */}
        <div className="md:col-span-7">
          <Card className="bg-background shadow-premium-lg">
            <CardContent className="pt-0 space-y-6">
              <div className="space-y-2">
                <h2 className="font-heading-style text-lg font-bold tracking-tight lowercase">
                  /tarjeta de crédito (simulado)
                </h2>
                <p className="text-xs text-muted-foreground font-mono">
                  Se simulará una transacción segura de Stripe.
                </p>
              </div>

              {error && (
                <div className="p-3 border border-destructive bg-destructive/10 text-destructive text-xs font-mono">
                  {error}
                </div>
              )}

              <form onSubmit={handlePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardName">Nombre en la tarjeta</Label>
                  <Input
                    id="cardName"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="John Doe"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número de tarjeta</Label>
                  <div className="relative">
                    <Input
                      id="cardNumber"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      required
                      disabled={loading}
                      className="pr-10"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <IconCreditCard className="size-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardExpiry">Vencimiento</Label>
                    <Input
                      id="cardExpiry"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/AA"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardCvc">CVC</Label>
                    <Input
                      id="cardCvc"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      placeholder="123"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  className="w-full justify-center gap-2 pt-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <IconLoader className="size-4 animate-spin" /> PROCESANDO PAGO...
                    </>
                  ) : (
                    "PAGAR $9.00 USD"
                  )}
                </Button>
              </form>

              <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground pt-4 border-t border-dashed border-border uppercase">
                <span className="flex items-center gap-1">
                  <IconShieldCheck className="size-3 text-emerald-500" /> stripe partner
                </span>
                <span>PCI-DSS compliant</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
