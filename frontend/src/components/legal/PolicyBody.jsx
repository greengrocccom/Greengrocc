const LINK_RE = /([\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/[^\s)]+|\+91[\s\d]{9,13}\d)/g;

function renderInline(text) {
  return String(text)
    .split(LINK_RE)
    .map((part, index) => {
      if (index % 2 === 0) return part;
      let href = part;
      if (part.includes("@") && !part.startsWith("http")) href = `mailto:${part}`;
      else if (part.startsWith("+")) href = `tel:${part.replace(/\s+/g, "")}`;
      const external = href.startsWith("http");
      return (
        <a
          key={index}
          href={href}
          className="text-primary hover:underline break-words"
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {part}
        </a>
      );
    });
}

/**
 * Admin policy text → blocks. "## Heading", "- bullet", "1. step"; any other line is a paragraph.
 */
export function parsePolicyBody(text) {
  const blocks = [];
  let list = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      list = null;
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        list = { type: "list", ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
        blocks.push(list);
      }
      list.items.push(bullet ? bullet[1] : numbered[2]);
      continue;
    }
    list = null;
    blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}

export default function PolicyBody({ text }) {
  const blocks = parsePolicyBody(text);
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2
              key={index}
              className={`text-xl font-bold text-text-primary ${index === 0 ? "" : "pt-5"}`}
            >
              {renderInline(block.text)}
            </h2>
          );
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              start={block.ordered ? block.start : undefined}
              className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }
        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
