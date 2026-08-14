import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { featureFlags } from "@/lib/env";

const isProtectedRoute = createRouteMatcher(["/history(.*)", "/api/jobs(.*)", "/api/uploads(.*)"]);

const protectedProxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

const publicProxy = () => NextResponse.next();

export default featureFlags.clerk ? protectedProxy : publicProxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
