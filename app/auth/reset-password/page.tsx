import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/auth/forgot-password?error=Tu+enlace+de+recuperación+ya+no+es+válido.+Solicita+uno+nuevo.",
    );
  }

  return <ResetPasswordForm email={user.email ?? ""} />;
}
