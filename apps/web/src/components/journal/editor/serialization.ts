import type {
  ChartEmbedType,
  JournalBlock,
  PsychologySnapshot,
} from "@/components/journal/types";

function normalizeElementText(element: HTMLElement): string {
  return (element.textContent || "").replace(/\s+/g, " ").trim();
}

export function blocksToHtml(blocks: JournalBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return `<p>${block.content}</p>`;
        case "heading1":
          return `<h1>${block.content}</h1>`;
        case "heading2":
          return `<h2>${block.content}</h2>`;
        case "heading3":
          return `<h3>${block.content}</h3>`;
        case "bulletList":
          return `<ul class="journal-bullet-list"><li>${block.content}</li></ul>`;
        case "numberedList":
          return `<ol class="journal-ordered-list"><li>${block.content}</li></ol>`;
        case "checkList":
          return `<ul data-type="taskList" class="journal-task-list"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div>${block.content}</div></li></ul>`;
        case "quote":
          return `<blockquote class="journal-blockquote">${block.content}</blockquote>`;
        case "callout":
          return `<div data-callout data-callout-type="${block.props?.calloutType || "info"}" data-emoji="${block.props?.calloutEmoji || "💡"}"><p>${block.content}</p></div>`;
        case "code":
          return `<pre class="journal-code-block"><code>${block.content}</code></pre>`;
        case "divider":
          return '<hr class="journal-hr" />';
        case "table":
          return `<table class="journal-table"><tbody>${block.content}</tbody></table>`;
        case "image":
          return `<figure data-journal-image><img src="${block.props?.imageUrl || ""}" alt="${block.props?.imageAlt || ""}" /></figure>`;
        case "chart":
          return `<div data-chart-embed data-chart-type="${block.props?.chartType || ""}" data-account-id="${block.props?.accountId || ""}" data-height="${block.props?.chartConfig?.height || 400}" data-title="${block.props?.chartConfig?.title || ""}"></div>`;
        case "trade": {
          const tradeProps = block.props;
          return `<div data-trade-embed data-trade-id="${tradeProps?.tradeId || ""}" data-symbol="${tradeProps?.symbol || ""}" data-direction="${tradeProps?.tradeDirection || "long"}" data-profit="${tradeProps?.profit || 0}" data-pips="${tradeProps?.pips || 0}" data-close-time="${tradeProps?.closeTime || ""}" data-outcome="${tradeProps?.outcome || ""}" data-display="${tradeProps?.tradeDisplay || "card"}"></div>`;
        }
        case "tradeComparison": {
          const comparisonTrades = block.props?.trades || [];
          return `<div data-trade-comparison data-trades="${encodeURIComponent(JSON.stringify(comparisonTrades))}"></div>`;
        }
        case "psychology": {
          const psychology = block.props?.psychologyData;
          if (psychology) {
            return `<div data-psychology-widget data-mood="${psychology.mood}" data-confidence="${psychology.confidence}" data-energy="${psychology.energy}" data-focus="${psychology.focus}" data-fear="${psychology.fear}" data-greed="${psychology.greed}" data-emotional-state="${psychology.emotionalState}" data-trading-environment="${psychology.tradingEnvironment || ""}" data-sleep-quality="${psychology.sleepQuality || 5}" data-distractions="${psychology.distractions ? "true" : "false"}" data-market-condition="${psychology.marketCondition || ""}" data-notes="${encodeURIComponent(psychology.notes || "")}"></div>`;
          }
          return '<div data-psychology-widget></div>';
        }
        default:
          return `<p>${block.content}</p>`;
      }
    })
    .join("");
}

export function htmlToBlocks(html: string): JournalBlock[] {
  const blocks: JournalBlock[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nodes = doc.body.childNodes;

  nodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const id = crypto.randomUUID();

    if (element.hasAttribute("data-chart-embed")) {
      const chartType = element.getAttribute("data-chart-type");
      const accountId = element.getAttribute("data-account-id");
      const title = element.getAttribute("data-title");
      const height = element.getAttribute("data-height");
      if (chartType && chartType !== "") {
        blocks.push({
          id,
          type: "chart",
          content: "",
          props: {
            chartType: chartType as ChartEmbedType,
            accountId: accountId && accountId !== "" ? accountId : undefined,
            chartConfig:
              (title && title !== "") || (height && height !== "")
                ? {
                    title: title && title !== "" ? title : undefined,
                    height: height ? parseInt(height, 10) : undefined,
                  }
                : undefined,
          },
        });
      }
      return;
    }

    if (element.hasAttribute("data-trade-embed")) {
      const tradeId = element.getAttribute("data-trade-id");
      const symbol = element.getAttribute("data-symbol");
      const direction = element.getAttribute("data-direction") as
        | "long"
        | "short"
        | null;
      const profit = element.getAttribute("data-profit");
      const pips = element.getAttribute("data-pips");
      const closeTime = element.getAttribute("data-close-time");
      const outcome = element.getAttribute("data-outcome");
      const display = element.getAttribute("data-display") as
        | "card"
        | "inline"
        | "detailed"
        | null;

      blocks.push({
        id,
        type: "trade",
        content: "",
        props: {
          tradeId:
            tradeId && tradeId !== "" && tradeId !== "placeholder"
              ? tradeId
              : undefined,
          symbol: symbol && symbol !== "" ? symbol : undefined,
          tradeDirection: direction || undefined,
          profit: profit ? parseFloat(profit) : undefined,
          pips: pips ? parseFloat(pips) : undefined,
          closeTime: closeTime && closeTime !== "" ? closeTime : null,
          outcome: outcome && outcome !== "" ? outcome : null,
          tradeDisplay: display || "card",
        },
      });
      return;
    }

    if (element.hasAttribute("data-trade-comparison")) {
      const tradesStr = element.getAttribute("data-trades") || "[]";
      let trades: Array<{
        id: string;
        symbol?: string | null;
        tradeDirection?: "long" | "short";
        profit?: number | null;
        pips?: number | null;
        close?: string | null;
        outcome?: string | null;
      }> = [];
      try {
        trades = JSON.parse(decodeURIComponent(tradesStr));
      } catch {
        try {
          trades = JSON.parse(tradesStr);
        } catch {
          trades = [];
        }
      }

      blocks.push({
        id,
        type: "tradeComparison",
        content: "",
        props: {
          trades: trades || [],
        },
      });
      return;
    }

    if (element.hasAttribute("data-journal-image")) {
      let src = element.getAttribute("data-src") || "";
      if (!src) {
        const img = element.querySelector("img");
        src = img?.getAttribute("src") || "";
      }
      const alt =
        element.getAttribute("data-alt") ||
        element.querySelector("img")?.getAttribute("alt") ||
        "";

      if (
        src &&
        (src.startsWith("data:") ||
          (src.startsWith("http") && !src.startsWith("blob:")))
      ) {
        blocks.push({
          id,
          type: "image",
          content: "",
          props: {
            imageUrl: src,
            imageAlt: alt,
          },
        });
      }
      return;
    }

    if (element.hasAttribute("data-callout")) {
      const calloutText = normalizeElementText(element);
      blocks.push({
        id,
        type: "callout",
        content: calloutText,
        props: {
          calloutType:
            (element.getAttribute("data-callout-type") as
              | "info"
              | "warning"
              | "success"
              | "error"
              | "note"
              | null) || "info",
          calloutEmoji: element.getAttribute("data-emoji") || undefined,
        },
      });
      return;
    }

    if (element.hasAttribute("data-psychology-widget")) {
      blocks.push({
        id,
        type: "psychology",
        content: "",
        props: {
          psychologyData: {
            mood: parseInt(element.getAttribute("data-mood") || "5"),
            confidence: parseInt(element.getAttribute("data-confidence") || "5"),
            energy: parseInt(element.getAttribute("data-energy") || "5"),
            focus: parseInt(element.getAttribute("data-focus") || "5"),
            fear: parseInt(element.getAttribute("data-fear") || "5"),
            greed: parseInt(element.getAttribute("data-greed") || "5"),
            emotionalState: (element.getAttribute("data-emotional-state") ||
              "neutral") as PsychologySnapshot["emotionalState"],
            tradingEnvironment: (element.getAttribute("data-trading-environment") ||
              undefined) as PsychologySnapshot["tradingEnvironment"],
            sleepQuality: parseInt(element.getAttribute("data-sleep-quality") || "5"),
            distractions: element.getAttribute("data-distractions") === "true",
            marketCondition: (element.getAttribute("data-market-condition") ||
              undefined) as PsychologySnapshot["marketCondition"],
            notes: decodeURIComponent(element.getAttribute("data-notes") || ""),
          },
        },
      });
      return;
    }

    if (element.getAttribute("data-type") === "taskList") {
      blocks.push({
        id,
        type: "checkList",
        content: element.innerHTML,
      });
      return;
    }

    switch (tagName) {
      case "h1":
        blocks.push({ id, type: "heading1", content: element.innerHTML });
        break;
      case "h2":
        blocks.push({ id, type: "heading2", content: element.innerHTML });
        break;
      case "h3":
        blocks.push({ id, type: "heading3", content: element.innerHTML });
        break;
      case "ul":
        if (
          element.classList.contains("journal-task-list") ||
          element.getAttribute("data-type") === "taskList"
        ) {
          blocks.push({ id, type: "checkList", content: element.innerHTML });
        } else {
          blocks.push({ id, type: "bulletList", content: element.innerHTML });
        }
        break;
      case "ol":
        blocks.push({ id, type: "numberedList", content: element.innerHTML });
        break;
      case "blockquote":
        blocks.push({ id, type: "quote", content: element.innerHTML });
        break;
      case "pre":
        blocks.push({ id, type: "code", content: element.textContent || "" });
        break;
      case "hr":
        blocks.push({ id, type: "divider", content: "" });
        break;
      case "table":
        blocks.push({ id, type: "table", content: element.innerHTML });
        break;
      case "figure":
        if (element.hasAttribute("data-journal-image")) {
          const img = element.querySelector("img");
          blocks.push({
            id,
            type: "image",
            content: "",
            props: {
              imageUrl: img?.getAttribute("src") || "",
              imageAlt: img?.getAttribute("alt") || "",
            },
          });
        }
        break;
      default:
        if (element.innerHTML.trim()) {
          blocks.push({ id, type: "paragraph", content: element.innerHTML });
        }
    }
  });

  return blocks;
}
