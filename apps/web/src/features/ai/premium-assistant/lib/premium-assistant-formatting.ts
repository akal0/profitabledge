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
      current = { title: "Your message", body: "" };
    }
    current.body += `${line}\n`;
  }

  pushCurrent();
  return sections;
}

export function sentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
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
