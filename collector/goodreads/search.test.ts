import { describe, expect, it } from "vitest";
import { pickBook } from "./search";

const ANSWER = [
	{
		bookId: "44767458",
		title: "Dune (Dune, #1)",
		bookTitleBare: "Dune",
		author: { id: 58, name: "Frank Herbert" },
	},
	{
		bookId: "13166596",
		title: "Dune",
		bookTitleBare: "Dune",
		author: { id: 99, name: "Somebody Else" },
	},
	{
		bookId: "117",
		title: "Dune Messiah (Dune, #2)",
		bookTitleBare: "Dune Messiah",
		author: { id: 58, name: "Frank Herbert" },
	},
];

describe("pickBook", () => {
	it("picks the first book with the same title", () => {
		expect(pickBook(ANSWER, "dune")).toEqual({
			id: "44767458",
			title: "Dune",
			author: "Frank Herbert",
		});
	});

	it("picks by author when one is given", () => {
		expect(pickBook(ANSWER, "Dune", "somebody else")?.id).toBe("13166596");
		expect(pickBook(ANSWER, "Dune", "Nobody")).toBeNull();
	});

	it("picks nothing when no title matches exactly", () => {
		expect(pickBook(ANSWER, "Dune Mess")).toBeNull();
	});

	it("rejects an answer that is not a list of books", () => {
		expect(() => pickBook({ error: "blocked" }, "Dune")).toThrow();
	});
});
