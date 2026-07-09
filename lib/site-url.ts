import { headers } from "next/headers";

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export function getConfiguredSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    return null;
  }

  return normalizeSiteUrl(configuredUrl);
}

export async function getRequestSiteUrl() {
  const configuredUrl = getConfiguredSiteUrl();
  if (configuredUrl) {
    return configuredUrl;
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

export function getPublicAssetUrl(siteUrl: string, assetPath: string) {
  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return new URL(normalizedPath, `${siteUrl}/`).toString();
}
