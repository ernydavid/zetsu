import { CheckoutClient } from "./checkout-client";

type CheckoutPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextParam = resolvedSearchParams.next;
  const nextPath = Array.isArray(nextParam) ? nextParam[0] : nextParam;

  return <CheckoutClient nextPath={nextPath || "/dashboard"} />;
}
