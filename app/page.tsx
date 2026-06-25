import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  IconArrowRight,
  IconChartBar,
  IconCoin,
  IconAlertCircle,
  IconCreditCard,
  IconCircleCheck,
  IconDashboard,
} from "@tabler/icons-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-foreground selection:text-background">
      {/* Navigation Header */}
      <header className="border-b border-premium bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="font-heading-style text-2xl font-black tracking-tighter hover:opacity-80 transition-opacity"
            >
              zetsu<span className="text-primary font-serif">.</span>
            </Link>
            <nav className="hidden md:flex space-x-6 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">
                /características
              </a>
              <a href="#pricing" className="hover:text-foreground transition-colors">
                /precios
              </a>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Link href="/auth/login" className="text-xs font-mono uppercase tracking-wider hover:underline">
              entrar
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" variant="brutalist">
                comenzar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32 max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-12 md:gap-20">
        <div className="flex-1 space-y-6 text-left">
          <h1 className="font-heading-style text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] lowercase">
            toma el control absoluto de tus <span className="underline decoration-wavy decoration-muted-foreground underline-offset-8">finanzas.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed font-sans">
            Gestiona tus ingresos y facturas recurrentes en una interfaz ultra-limpia, enfocada en la tipografía y el espacio en blanco. Sin gráficos innecesarios en la capa básica, solo claridad brutal.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/auth/signup">
              <Button size="lg" variant="brutalist" className="gap-2">
                comenzar gratis <IconArrowRight className="size-5" />
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline">
                ver demo interactiva
              </Button>
            </a>
          </div>
        </div>

        {/* Hero Visual Mockup */}
        <div className="flex-1 w-full" id="demo">
          <Card className="w-full bg-background overflow-hidden p-0! shadow-premium-lg">
            {/* Mock Dashboard Window Header */}
            <div className="border-b border-premium p-4 flex items-center justify-between bg-muted/20 font-mono text-xs">
              <div className="flex space-x-2">
                <div className="size-3 border border-foreground bg-foreground"></div>
                <div className="size-3 border border-foreground"></div>
                <div className="size-3 border border-foreground bg-muted"></div>
              </div>
              <span>zetsu_dashboard_preview.exe</span>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-dashed border-border pb-8">
                <div className="space-y-1">
                  <p className="text-xs uppercase font-mono text-muted-foreground font-bold tracking-wider">
                    ingresos mensuales
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-tighter">
                    $5,200.00
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase font-mono text-muted-foreground font-bold tracking-wider">
                    suscripciones
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-tighter text-destructive">
                    -$145.00
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase font-mono text-muted-foreground font-bold tracking-wider">
                    saldo neto
                  </p>
                  <p className="text-3xl font-mono font-bold tracking-tighter text-emerald-600 dark:text-emerald-400">
                    $5,055.00
                  </p>
                </div>
              </div>

              {/* Transaction List Preview */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-heading-style font-black text-lg lowercase">/flujos de este mes</h4>
                  <span className="text-xs font-mono text-muted-foreground">[3 items]</span>
                </div>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex justify-between p-3 rounded-xl border border-premium bg-muted/10">
                    <span className="flex items-center gap-2">
                      <span className="size-2 bg-emerald-500 rounded-full"></span> nomina_principal
                    </span>
                    <span>+$4,000.00</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl border border-premium bg-muted/10">
                    <span className="flex items-center gap-2">
                      <span className="size-2 bg-emerald-500 rounded-full"></span> desarrollo_freelance
                    </span>
                    <span>+$1,200.00</span>
                  </div>
                  <div className="flex justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive">
                    <span className="flex items-center gap-2 font-bold">
                      <span className="size-2 bg-destructive rounded-full"></span> netflix_premium
                    </span>
                    <span className="font-bold">-$15.99</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-28 border-t border-premium bg-muted/5">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="space-y-4 max-w-xl">
            <h2 className="font-heading-style text-4xl font-black tracking-tighter lowercase">
              /modular. limpio. directo.
            </h2>
            <p className="text-muted-foreground font-sans">
              Dos capas diseñadas específicamente para tu necesidad. No pagues por proyecciones si solo necesitas saber cuánto ganas y cuánto gastas cada mes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card brutalist className="bg-background space-y-4">
              <div className="size-12 border border-foreground flex items-center justify-center bg-muted/20">
                <IconCoin className="size-6" />
              </div>
              <CardTitle className="lowercase">/gestión de ingresos</CardTitle>
              <CardDescription>
                Agrega todas tus fuentes de ingresos mensuales y puntuales. Visualízalas en un listado limpio ordenado tipográficamente.
              </CardDescription>
            </Card>

            <Card brutalist className="bg-background space-y-4">
              <div className="size-12 border border-foreground flex items-center justify-center bg-muted/20">
                <IconCreditCard className="size-6" />
              </div>
              <CardTitle className="lowercase">/control de pagos</CardTitle>
              <CardDescription>
                Registra tus facturas mensuales, pagos manuales y deudas. Lleva la cuenta de lo que ya pagaste y lo que está pendiente.
              </CardDescription>
            </Card>

            <Card className="bg-background space-y-4 border-dashed border-border">
              <div className="size-12 border border-dashed border-foreground/50 flex items-center justify-center bg-muted/20 text-muted-foreground">
                <IconChartBar className="size-6" />
              </div>
              <CardTitle className="lowercase text-muted-foreground flex items-center gap-2">
                /proyecciones pro <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 border border-muted-foreground text-muted-foreground">pago</span>
              </CardTitle>
              <CardDescription>
                Calcula proyecciones de ahorro de 6 a 12 meses. Recibe alertas inteligentes de ahorro automático basadas en tus patrones de consumo.
              </CardDescription>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 border-t border-premium">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="space-y-4 text-center max-w-xl mx-auto">
            <h2 className="font-heading-style text-4xl font-black tracking-tighter lowercase">
              /planes transparentes
            </h2>
            <p className="text-muted-foreground font-sans">
              Comienza gratis hoy mismo. Actualiza a la capa Pro cuando necesites analíticas y alertas de ahorro avanzadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card brutalist className="bg-background flex flex-col justify-between h-full">
              <div className="space-y-6">
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    capa gratuita
                  </h3>
                  <p className="text-4xl font-mono font-bold tracking-tighter mt-2">$0</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">gratis para siempre</p>
                </div>
                <ul className="space-y-3 font-mono text-sm border-t border-dashed border-border pt-6">
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Registro de ingresos ilimitados
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Gestión de pagos e historial
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Moneda predeterminada única
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground/60 line-through">
                    Suscripciones recurrentes
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground/60 line-through">
                    Gráficos de proyección y alertas de ahorro
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Link href="/auth/signup">
                  <Button variant="outline" className="w-full justify-center">
                    comenzar gratis
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-background border border-primary/30 shadow-premium-lg flex flex-col justify-between h-full relative">
              <div className="absolute -top-3.5 right-6 bg-primary text-primary-foreground rounded-full font-mono text-[9px] uppercase font-bold tracking-widest px-3 py-1">
                RECOMENDADO
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
                    capa premium (pro)
                  </h3>
                  <p className="text-4xl font-mono font-bold tracking-tighter mt-2">$9<span className="text-lg font-normal font-sans">/mes</span></p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">cancela en cualquier momento</p>
                </div>
                <ul className="space-y-3 font-mono text-sm border-t border-dashed border-border pt-6">
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Todo lo de la capa gratuita
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Módulo de Suscripciones
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Gráficas de proyección financiera
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Alertas de ahorro inteligente
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-4 shrink-0 text-emerald-500" /> Soporte prioritario
                  </li>
                </ul>
              </div>
              <div className="pt-8">
                <Link href="/auth/signup?plan=pro">
                  <Button variant="brutalist" className="w-full justify-center">
                    obtener pro (stripe)
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-premium bg-background mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs font-mono text-muted-foreground lowercase">
            © 2026 zetsu. todos los derechos reservados.
          </p>
          <div className="flex space-x-6 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Link href="/auth/login" className="hover:underline">
              /entrar
            </Link>
            <Link href="/auth/signup" className="hover:underline">
              /registro
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
