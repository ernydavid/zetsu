"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type AuthActionState = {
  error?: string;
  success?: string;
} | null;

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

function getAuthErrorMessage(message: string, code?: string | null) {
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

  return message;
}

async function getRequestOrigin() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    const normalized = configuredUrl.trim().replace(/\/+$/, "");
    return normalized.startsWith("http") ? normalized : `https://${normalized}`;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    return "http://localhost:3000";
  }

  return `${proto}://${host}`;
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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  redirect("/onboarding");
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
) {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return { error: "Ingresa tu correo electrónico." };
  }

  const origin = await getRequestOrigin();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/reset-password`,
  });

  if (error && error.code !== "user_not_found") {
    return { error: getAuthErrorMessage(error.message, error.code) };
  }

  return {
    success:
      "Si existe una cuenta con ese correo, te enviaremos un enlace para restablecer tu contraseña.",
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
