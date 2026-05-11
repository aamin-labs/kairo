import type { ImportedCard } from "./types";

const REQUIRED_HEADERS = ["Question", "Answer", "Context", "Explanation"] as const;

export function parseCardsCsv(input: string): ImportedCard[] {
  const rows = parseCsvRows(input.trim());
  if (rows.length < 2) {
    throw new Error("CSV needs a header row and at least one card.");
  }

  const headers = rows[0].map((header) => header.trim());
  const indexes = REQUIRED_HEADERS.map((header) => headers.indexOf(header));
  const noteIndex = optionalHeaderIndex(headers, ["NoteId", "Note ID", "Note"]);
  const missing = REQUIRED_HEADERS.filter((_, index) => indexes[index] === -1);

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  }

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row, rowIndex) => {
      const noteId = noteIndex === -1 ? "" : cell(row, noteIndex);
      const card = {
        question: cell(row, indexes[0]),
        answer: cell(row, indexes[1]),
        context: cell(row, indexes[2]),
        explanation: cell(row, indexes[3]),
        ...(noteId ? { noteId } : {})
      };

      if (!card.question || !card.answer) {
        throw new Error(`Row ${rowIndex + 2} needs Question and Answer.`);
      }

      return card;
    });
}

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV has an unclosed quoted field.");
  }

  row.push(field);
  rows.push(row);
  return rows;
}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function optionalHeaderIndex(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.includes(header));
}
