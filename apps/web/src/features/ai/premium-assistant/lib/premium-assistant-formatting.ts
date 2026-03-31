import { formatDisplayCurrency } from "@/lib/format-display";
import { toSentenceCase } from "@/lib/sentence-case";

export function splitMarkdownSections(markdown: string): Array<{
  title: string;
  body: string;
}> {
  const lines = String(markdown || "").split("\n");
  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; body: string } | null = null;

  const pushCurrent = () => {
    if (current) {
      sections.push({
        title: current.title,
        body: current.body.trim(),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      pushCurrent();
      current = { title: line.replace(/^###\s+/, "").trim(), body: "" };
      continue;
    }
    if (!current) {
      current = { title: "Response", body: "" };
    }
    current.body += `${line}\n`;
  }

  pushCurrent();
  return sections;
}

export function sentenceCase(value: string): string {
  return toSentenceCase(value);
}

export function decorateMentions(text: string): string {
  if (!text) return text;
  return text.replace(
    /(^|[\s(])([@/])([A-Za-z0-9_.-]+)/g,
    (match, prefix, sigil, token) => {
      const scheme = sigil === "@" ? "mention" : "command";
      return `${prefix}[${sigil}${token}](${scheme}:${token})`;
    }
  );
}

export function formatCurrencyNumbers(text: string): string {
  if (!text) return text;

  return text.replace(
    /(^|[^A-Za-z0-9_])(-?)([$£€])(\d[\d,]*)(\.\d+)?/g,
    (match, prefix, sign, symbol, whole, decimals) => {
      const numericValue = Number(`${whole}${decimals || ""}`.replace(/,/g, ""));
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const signedValue = sign ? -numericValue : numericValue;
      return `${prefix}${formatDisplayCurrency(
        signedValue,
        symbol as "$" | "£" | "€"
      )}`;
    }
  );
}
