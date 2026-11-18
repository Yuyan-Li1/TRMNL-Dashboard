/**
 * The rows of a CSV file, each keyed by the header row's names. Handles
 * quoted fields, with commas, line breaks and doubled quotes inside them.
 */
export function parseCsv(text: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		if (quoted) {
			if (char !== '"') {
				field += char;
			} else if (text[index + 1] === '"') {
				field += '"';
				index++;
			} else {
				quoted = false;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (char !== "\r") {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	const [header, ...records] = rows;
	if (!header) {
		return [];
	}
	// An export may start with a byte order mark
	header[0] = header[0].replace(/^﻿/, "");
	return records
		.filter((record) => record.some((value) => value !== ""))
		.map((record) =>
			Object.fromEntries(
				header.map((name, column) => [name, record[column] ?? ""]),
			),
		);
}
