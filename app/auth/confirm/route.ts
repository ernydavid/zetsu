import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  supabaseCookieOptions,
  supabaseKey,
  supabaseUrl,
} from "@/utils/supabase/config";

function getSafeNextPath(next: string | null, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

function getErrorRedirectUrl(request: NextRequest, nextPath: string) {
  const isResetFlow = nextPath.startsWith("/auth/reset-password");
  const pathname = isResetFlow ? "/auth/forgot-password" : "/auth/check-email";
  return new URL(pathname, request.url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const nextPath = getSafeNextPath(
    requestUrl.searchParams.get("next"),
    "/dashboard",
  );

  const successUrl = new URL(nextPath, request.url);
  const errorUrl = getErrorRedirectUrl(request, nextPath);
  let response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        response = NextResponse.redirect(successUrl);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }

    errorUrl.searchParams.set(
      "error",
      nextPath.startsWith("/auth/reset-password")
        ? "No pudimos validar el enlace de recuperación. Solicita uno nuevo."
        : "No pudimos validar el enlace de confirmación. Intenta registrarte de nuevo.",
    );
    return NextResponse.redirect(errorUrl);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    if (!error) {
      return response;
    }
  }

  errorUrl.searchParams.set(
    "error",
    nextPath.startsWith("/auth/reset-password")
      ? "El enlace de recuperación es inválido o ya expiró."
      : "El enlace de confirmación es inválido o ya expiró.",
  );
  return NextResponse.redirect(errorUrl);
}
