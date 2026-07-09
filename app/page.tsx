import * as React from "react";
import Link from "next/link";
import { AppLogo } from "@/components/common/app-logo";
import { LandingInteractiveDemo } from "@/components/common/landing-interactive-demo";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  IconArrowRight,
  IconChartBar,
  IconCoin,
  IconCreditCard,
  IconCircleCheck,
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
              className="hover:opacity-80 transition-opacity"
            >
              <AppLogo size="md" variant="full" priority />
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
      <section className="max-w-7xl mx-auto px-6 py-16 md:min-h-[calc(100vh-4rem)] md:py-12 flex flex-col md:flex-row items-center gap-10 md:gap-16">
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
        <div className="flex flex-1 w-full justify-center md:justify-end" id="demo">
          <LandingInteractiveDemo />
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
          <div className="flex items-center gap-3">
            <AppLogo size="sm" variant="icon" />
            <p className="text-xs font-mono text-muted-foreground lowercase">
              © 2026 zetsu. todos los derechos reservados.
            </p>
          </div>
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
