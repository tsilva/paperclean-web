import Stripe from "stripe";

import { requiredEnv } from "@/lib/env";

let stripeClient: Stripe | undefined;

export function stripe() {
  stripeClient ??= new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
    appInfo: { name: "PaperClean", version: "0.1.0" },
  });
  return stripeClient;
}
