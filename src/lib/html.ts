const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	mdash: "\u2014",
	ndash: "\u2013",
	hellip: "\u2026",
	lsquo: "\u2018",
	rsquo: "\u2019",
	ldquo: "\u201c",
	rdquo: "\u201d",
};

/** Text with its HTML entities turned back into characters. */
export function decodeEntities(text: string): string {
	return text.replace(
		/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
		(whole, entity: string) => {
			if (entity[0] !== "#") {
				return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
			}
			const code =
				entity[1].toLowerCase() === "x"
					? Number.parseInt(entity.slice(2), 16)
					: Number.parseInt(entity.slice(1), 10);
			return Number.isFinite(code) && code <= 0x10ffff
				? String.fromCodePoint(code)
				: whole;
		},
	);
}
