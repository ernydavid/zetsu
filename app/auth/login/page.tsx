import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const messageParam = resolvedSearchParams.message;
  const message = Array.isArray(messageParam) ? messageParam[0] : messageParam;

  return <LoginForm message={message} />;
}
