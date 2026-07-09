import { ForgotPasswordForm } from "./forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const resolvedSearchParams = await searchParams;
  const errorParam = resolvedSearchParams.error;
  const callbackError = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return <ForgotPasswordForm callbackError={callbackError} />;
}
