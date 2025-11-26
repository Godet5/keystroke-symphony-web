// Supabase Edge Function: Stripe Webhook v2 (Enhanced with Idempotency)
// Purpose: Process Stripe webhook events with duplicate prevention
// Created: 2025-11-25

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.6.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    console.log(`Event ${event.id} already processed`);
    return new Response("OK (already processed)", { status: 200 });
  }

  // Store webhook event
  await supabase.from("webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
  });

  const data = event.data.object as any;
  const userId = data.metadata?.user_id || data.client_reference_id;
  const priceId = data.lines?.data?.[0]?.price?.id || data.items?.data?.[0]?.price?.id;

  if (!userId) {
    console.error("Missing user_id in event metadata");
    return new Response("Missing user metadata", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "invoice.payment_succeeded":
        await handleSubscriptionActivation(userId, priceId);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(userId, priceId, data.status);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCancellation(userId);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(userId);
        break;
    }

    // Update webhook event with result
    await supabase
      .from("webhook_events")
      .update({ result: { success: true, processed_at: new Date().toISOString() } })
      .eq("stripe_event_id", event.id);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    await supabase
      .from("webhook_events")
      .update({ result: { success: false, error: error.message } })
      .eq("stripe_event_id", event.id);
    return new Response("Error processing webhook", { status: 500 });
  }
});

async function handleSubscriptionActivation(userId: string, priceId: string) {
  const tierMap: Record<string, string> = {
    [Deno.env.get("STRIPE_PRICE_FREE")!]: "free",
    [Deno.env.get("STRIPE_PRICE_BASIC")!]: "basic",
    [Deno.env.get("STRIPE_PRICE_PRO")!]: "pro",
  };

  const tier = tierMap[priceId] || "basic";
  const updates: any = {
    is_subscriber: true,
    subscription_tier: tier,
    subscription_status: "active",
  };

  if (tier === "pro") {
    updates.consult_credits = 1;
  }

  await supabase.from("profiles").update(updates).eq("id", userId);
  await supabase.rpc("log_audit", {
    action_name: "subscription_activated",
    resource_name: "profiles",
    resource_uuid: userId,
    extra_metadata: { tier, price_id: priceId },
  });
}

async function handleSubscriptionUpdate(userId: string, priceId: string, status: string) {
  await supabase
    .from("profiles")
    .update({ subscription_status: status })
    .eq("id", userId);
}

async function handleSubscriptionCancellation(userId: string) {
  await supabase
    .from("profiles")
    .update({
      is_subscriber: false,
      subscription_status: "cancelled",
      subscription_tier: "public",
      consult_credits: 0,
    })
    .eq("id", userId);

  await supabase.rpc("log_audit", {
    action_name: "subscription_cancelled",
    resource_name: "profiles",
    resource_uuid: userId,
  });
}

async function handlePaymentFailed(userId: string) {
  await supabase
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("id", userId);
}
