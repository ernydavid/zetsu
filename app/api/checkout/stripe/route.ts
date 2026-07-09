import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const simulated = searchParams.get("simulated") === "true";
  const nextPath = searchParams.get("next") || "/dashboard";

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  // Fallback to simulated checkout if forced or if Stripe keys are missing
  if (simulated || !stripeKey) {
    const checkoutUrl = new URL("/checkout", request.url);
    checkoutUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(checkoutUrl);
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-01-27.acme" as any,
    });

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Get user profile to check for Stripe Customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let stripeCustomerId = profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.user_metadata?.full_name || "",
        metadata: {
          supabase_user_id: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Save Stripe customer ID to Supabase profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id);
    }

    const stripePriceId = process.env.STRIPE_PRICE_ID;
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "El ID de precio de Stripe no está configurado (STRIPE_PRICE_ID)." },
        { status: 500 }
      );
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${request.nextUrl.origin}${nextPath}?upgrade=success`,
      cancel_url: `${request.nextUrl.origin}/dashboard?upgrade=cancel`,
    });

    if (session.url) {
      return NextResponse.redirect(session.url);
    } else {
      throw new Error("No se pudo obtener la URL de sesión de Stripe.");
    }
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
