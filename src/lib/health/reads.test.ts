import { describe, expect, it } from "vitest";
import { collectReads, TokenRejectedError, trackRead } from "./reads";

describe("collectReads", () => {
	it("collects the good and failed reads of each source in the run", async () => {
		const { result, reads } = await collectReads(async () => {
			await Promise.all([
				trackRead("tmdb", async () => "a"),
				trackRead("tmdb", async () => "b"),
				trackRead("steam", async () => {
					throw new Error("Steam is down");
				}).catch(() => null),
			]);
			return "done";
		});

		expect(result).toBe("done");
		expect(reads).toEqual({
			tmdb: { good: 2, failed: 0 },
			steam: { good: 0, failed: 1, error: "Error: Steam is down" },
		});
	});

	it("marks a source whose token was rejected, and still throws", async () => {
		const { reads } = await collectReads(async () => {
			await expect(
				trackRead("psn", async () => {
					throw new TokenRejectedError("NPSSO rejected");
				}),
			).rejects.toThrow("NPSSO rejected");
		});

		expect(reads.psn?.rejected).toBe(true);
	});

	it("only reads when no run is in progress", async () => {
		await expect(trackRead("steam", async () => 5)).resolves.toBe(5);
	});
});
