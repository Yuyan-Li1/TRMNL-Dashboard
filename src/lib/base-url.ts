/**
 * The dashboard's own origin, for the absolute URLs the TRMNL Screenshot
 * plugin needs. Empty when neither variable is set (local development
 * without NEXT_PUBLIC_APP_URL), which leaves URLs root-relative.
 */
export function getBaseUrl(): string {
	const configured = process.env.NEXT_PUBLIC_APP_URL;
	if (configured) {
		return configured.replace(/\/+$/, "");
	}
	const vercelUrl = process.env.VERCEL_URL;
	return vercelUrl ? `https://${vercelUrl}` : "";
}
