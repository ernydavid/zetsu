import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We use service role client to bypass RLS policies when updating billing tier via Webhook
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// In a real application, process.env.SUPABASE_SERVICE_ROLE_KEY is used here.
// Fallback to publishable key for type safety in dev, but webhooks need service role or custom schema updates.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe keys not configured on server" },
      { status: 500 }
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-01-27.acme" as any,
    });

    const body = await request.text();
    const signature = request.headers.get("stripe-signature") || "";

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle webhook event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        // Retrieve customer from stripe to get metadata
        const customer = await stripe.customers.retrieve(customerId) as any;
        const userId = customer.metadata?.supabase_user_id;

        if (userId) {
          await supabase
            .from("profiles")
            .update({
              billing_tier: "pro",
              stripe_subscription_id: subscriptionId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        // Retrieve customer
        const customer = await stripe.customers.retrieve(customerId) as any;
        const userId = customer.metadata?.supabase_user_id;

        if (userId) {
          await supabase
            .from("profiles")
            .update({
              billing_tier: "free",
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      default:
        console.log(`Unhandled stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
