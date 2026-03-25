export function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, Math.max(0, maxLen - 3))}...`;
}

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function formatDate(isoString: string): string {
	const date = new Date(isoString);
	const month = MONTHS[date.getUTCMonth()];
	const day = date.getUTCDate().toString().padStart(2, "0");
	return `${month} ${day}`;
}

export interface SearchResult {
	id: string;
	rawText: string;
	project: string | null;
	outcome: string | null;
	reasoning: string | null;
	createdAt: string;
}

export function formatSearchResults(
	results: SearchResult[],
	startIndex = 0,
): string {
	const header = `${"#".padStart(3)}  ${"ID".padStart(8)}  ${"Project".padEnd(10)}  ${"Decision".padEnd(37)}  Date`;
	const rows = results.map((r, i) => {
		const num = String(startIndex + i + 1).padStart(3);
		const shortId = r.id.slice(0, 8).padStart(8);
		const project = truncate(r.project ?? "(none)", 10).padEnd(10);
		const text = r.outcome ?? r.rawText;
		const decision = truncate(text, 37).padEnd(37);
		const date = formatDate(r.createdAt);
		return `${num}  ${shortId}  ${project}  ${decision}  ${date}`;
	});
	return [header, ...rows].join("\n");
}

interface DecisionDetail {
	id: string;
	project: string | null;
	status: "active" | "archived";
	rawText: string;
	outcome: string | null;
	reasoning: string | null;
	alternatives: string[] | null;
	tags: string[] | null;
	createdAt: string;
}

function wrapText(text: string, maxWidth: number, indent: string): string {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if (`${currentLine} ${word}`.trim().length > maxWidth) {
			lines.push(currentLine.trim());
			currentLine = word;
		} else {
			currentLine += ` ${word}`;
		}
	}
	if (currentLine.trim()) {
		lines.push(currentLine.trim());
	}

	return lines.map((line, i) => (i === 0 ? line : indent + line)).join("\n");
}

function formatDecisionDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toISOString().split("T")[0] ?? dateStr;
}

export function formatDecisionDetail(decision: DecisionDetail): string {
	const lines: string[] = [];
	const separator = "─".repeat(50);
	const labelWidth = 15;

	// Header section
	lines.push(separator);
	lines.push(`${"ID:".padEnd(labelWidth)}${decision.id}`);

	if (decision.project) {
		lines.push(`${"Project:".padEnd(labelWidth)}${decision.project}`);
	}

	lines.push(`${"Status:".padEnd(labelWidth)}${decision.status}`);

	lines.push(separator);

	// Content section
	const contentIndent = " ".repeat(labelWidth);
	const maxLineWidth = 80;

	lines.push(
		`${"Raw text:".padEnd(labelWidth)}${wrapText(decision.rawText, maxLineWidth - labelWidth, contentIndent)}`,
	);
	lines.push("");

	if (decision.outcome) {
		lines.push(
			`${"Outcome:".padEnd(labelWidth)}${wrapText(decision.outcome, maxLineWidth - labelWidth, contentIndent)}`,
		);
	}

	if (decision.reasoning) {
		lines.push(
			`${"Reasoning:".padEnd(labelWidth)}${wrapText(decision.reasoning, maxLineWidth - labelWidth, contentIndent)}`,
		);
	}

	if (decision.alternatives && decision.alternatives.length > 0) {
		lines.push(
			`${"Alternatives:".padEnd(labelWidth)}- ${decision.alternatives[0]}`,
		);
		for (let i = 1; i < decision.alternatives.length; i++) {
			lines.push(`${contentIndent}- ${decision.alternatives[i]}`);
		}
	}

	if (decision.tags && decision.tags.length > 0) {
		lines.push(`${"Tags:".padEnd(labelWidth)}${decision.tags.join(", ")}`);
	}

	lines.push(separator);

	// Footer section
	lines.push(
		`${"Created:".padEnd(labelWidth)}${formatDecisionDate(decision.createdAt)}`,
	);

	return lines.join("\n");
}
