import { CheckEmailClient } from "./check-email-client";

type CheckEmailPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pickSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const email = pickSingleValue(resolvedSearchParams.email);
  const error = pickSingleValue(resolvedSearchParams.error);
  const message = pickSingleValue(resolvedSearchParams.message);
  const cooldownParam = pickSingleValue(resolvedSearchParams.cooldown);
  const initialCooldownSeconds = cooldownParam ? Number(cooldownParam) : 0;

  return (
    <CheckEmailClient
      email={email}
      error={error}
      message={message}
      initialCooldownSeconds={
        Number.isFinite(initialCooldownSeconds) && initialCooldownSeconds > 0
          ? initialCooldownSeconds
          : 0
      }
    />
  );
}
