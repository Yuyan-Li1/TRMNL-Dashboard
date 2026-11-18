/**
 * Everything the refresh reads and keeps health for: the Sources and the
 * Catalogs. A Catalog is read only when a Title needs looking up, so it has
 * no expected interval between reads.
 */
export const SOURCE_IDS = [
	"steam",
	"xbox",
	"psn",
	"switch",
	"letterboxd",
	"trakt",
	"tmdb",
	"igdb",
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export interface SourceInfo {
	name: string;
	kind: "source" | "catalog";
	/** The token whose rejection stops this source, where it has one */
	token?: { name: string; fix: string };
}

export const SOURCES: Record<SourceId, SourceInfo> = {
	steam: { name: "Steam", kind: "source" },
	xbox: { name: "Xbox", kind: "source" },
	psn: {
		name: "PSN",
		kind: "source",
		token: {
			name: "PSN NPSSO",
			fix: "sign in at playstation.com, copy the npsso value from https://ca.account.sony.com/api/v1/ssocookie into PSN_NPSSO in Vercel, and redeploy.",
		},
	},
	switch: {
		name: "Switch",
		kind: "source",
		token: {
			name: "Nintendo session token",
			fix: "get a new session token, set NINTENDO_SESSION_TOKEN in Vercel, and redeploy.",
		},
	},
	letterboxd: { name: "Letterboxd", kind: "source" },
	trakt: {
		name: "Trakt",
		kind: "source",
		token: {
			name: "Trakt client id",
			fix: "check the API app at https://trakt.tv/oauth/applications and TRAKT_CLIENT_ID in Vercel.",
		},
	},
	tmdb: { name: "TMDB", kind: "catalog" },
	igdb: { name: "IGDB", kind: "catalog" },
};
