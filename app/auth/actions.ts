"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getRequestSiteUrl } from "@/lib/site-url";

type AuthActionState = {
  error?: string;
  success?: string;
} | null;

const VERIFICATION_RESEND_COOLDOWN_SECONDS = 180;
const VERIFICATION_RESEND_COOKIE_PREFIX = "zetsu-verification-resend:";

function normalizeEmail(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }

  if (!/[A-Za-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra.";
  }

  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }

  return null;
}

function getAuthErrorMessage(message: unknown, code?: string | null) {
  const normalizedMessage =
    typeof message === "string" ? message.trim() : "";

  if (code === "invalid_credentials") {
    return "Correo o contraseña incorrectos.";
  }

  if (code === "email_not_confirmed") {
    return "Tu correo aún no ha sido confirmado.";
  }

  if (code === "email_address_invalid") {
    return "Ingresa un correo electrónico válido.";
  }

  if (code === "user_already_exists") {
    return "Ya existe una cuenta con este correo.";
  }

  if (code === "weak_password") {
    return "Elige una contraseña más segura.";
  }

  if (code === "same_password") {
    return "La nueva contraseña debe ser distinta a la anterior.";
  }

  if (!normalizedMessage || normalizedMessage === "{}") {
    return "Ocurrió un problema al procesar la solicitud. Revisa la configuración de Auth y SMTP en Supabase.";
  }

  return normalizedMessage;
}

function getVerificationResendCookieName(email: string) {
  return `${VERIFICATION_RESEND_COOKIE_PREFIX}${Buffer.from(email).toString("base64url")}`;
}

function getVerificationCooldownMessage(remainingSeconds: number) {
  return `Ya enviamos un correo de verificación recientemente. Espera ${remainingSeconds} segundos antes de solicitar otro.`;
}

function getVerificationSentMessage() {
  return "Tu correo aún no ha sido confirmado. Te enviamos un nuevo enlace de verificación.";
}

function buildCheckEmailUrl(options: {
  email: string;
  error?: string;
  message?: string;
  cooldownSeconds?: number;
}) {
  const params = new URLSearchParams({
    email: options.email,
  });

  if (options.error) {
    params.set("error", options.error);
  }

  if (options.message) {
    params.set("message", options.message);
  }

  if (typeof options.cooldownSeconds === "number" && options.cooldownSeconds > 0) {
    params.set("cooldown", String(options.cooldownSeconds));
  }

  return `/auth/check-email?${params.toString()}`;
}

function getRemainingVerificationCooldownSeconds(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  email: string,
) {
  const rawValue = cookieStore.get(getVerificationResendCookieName(email))?.value;
  const sentAt = rawValue ? Number(rawValue) : Number.NaN;

  if (!Number.isFinite(sentAt)) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

function markVerificationResend(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  email: string,
) {
  cookieStore.set(getVerificationResendCookieName(email), String(Date.now()), {
    httpOnly: true,
    maxAge: VERIFICATION_RESEND_COOLDOWN_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function resendSignupVerificationEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const siteUrl = await getRequestSiteUrl();

  return supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding`,
    },
  });
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "El correo y la contraseña son obligatorios." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      const remainingSeconds = getRemainingVerificationCooldownSeconds(
        cookieStore,
        email,
      );

      if (remainingSeconds > 0) {
        redirect(
          buildCheckEmailUrl({
            email,
            message: getVerificationCooldownMessage(remainingSeconds),
            cooldownSeconds: remainingSeconds,
          }),
        );
      }

      const resendResult = await resendSignupVerificationEmail(supabase, email);

      if (resendResult.error) {
        redirect(
          buildCheckEmailUrl({
            email,
            error: `Tu correo aún no ha sido confirmado y no pudimos reenviar el enlace: ${getAuthErrorMessage(resendResult.error.message, resendResult.error.code)}`,
          }),
        );
      }

      markVerificationResend(cookieStore, email);

      redirect(
        buildCheckEmailUrl({
          email,
          message: getVerificationSentMessage(),
          cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
        }),
      );
    }

    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const fullName = normalizeText(formData.get("fullName"));

  if (!email || !password || !fullName) {
    return { error: "Todos los campos son obligatorios." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const siteUrl = await getRequestSiteUrl();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
) {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return { error: "Ingresa tu correo electrónico." };
  }

  const origin = await getRequestSiteUrl();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let error: { message?: unknown; code?: string | null } | null = null;

  try {
    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/auth/reset-password`,
    });
    error = result.error;
  } catch (unexpectedError) {
    return {
      error: getAuthErrorMessage(unexpectedError),
    };
  }

  if (error && error.code !== "user_not_found") {
    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  return {
    success:
      "Si existe una cuenta con ese correo, te enviaremos un enlace para restablecer tu contraseña.",
  };
}

export async function resendVerificationEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { error: "No encontramos un correo válido para reenviar la verificación." };
  }

  const cookieStore = await cookies();
  const remainingSeconds = getRemainingVerificationCooldownSeconds(
    cookieStore,
    normalizedEmail,
  );

  if (remainingSeconds > 0) {
    return {
      error: getVerificationCooldownMessage(remainingSeconds),
      retryAfterSeconds: remainingSeconds,
    };
  }

  const supabase = createClient(cookieStore);
  const { error } = await resendSignupVerificationEmail(supabase, normalizedEmail);

  if (error) {
    return {
      error: getAuthErrorMessage(error.message, error.code),
    };
  }

  markVerificationResend(cookieStore, normalizedEmail);

  return {
    success: getVerificationSentMessage(),
    retryAfterSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
  };
}

export async function updateRecoveredPassword(
  _prevState: AuthActionState,
  formData: FormData,
) {
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    return { error: "Completa todos los campos." };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Tu enlace de recuperación ya no es válido. Solicita uno nuevo para continuar.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  await supabase.auth.signOut();
  redirect("/auth/login?message=Contraseña+restablecida.+Inicia+sesión+con+tu+nueva+clave.");
}

export async function signout() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  await supabase.auth.signOut();
  redirect("/auth/login");
}
