import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactCompiler: true,
	async headers() {
		return [
			{
				// The TRMNL Screenshot plugin renders the page away from this
				// origin, so the self-hosted fonts must be readable cross-origin.
				source: "/fonts/:path*",
				headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
			},
		];
	},
};

export default nextConfig;
