import type { ReactNode } from "react";

function inline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function table(lines: string[], key: string) {
  const rows = lines.filter((line) => !/^\|?\s*:?-{3,}/.test(line.trim())).map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const [header, ...body] = rows;
  return <div className="lesson-table-wrap" key={key}><table className="lesson-table"><thead><tr>{header.map((cell, index) => <th key={index}>{inline(cell)}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell)}</td>)}</tr>)}</tbody></table></div>;
}

/** A deliberately small Markdown subset. It renders text as React nodes only; raw HTML is never parsed. */
export function LessonMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const output: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const code: string[] = []; index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      output.push(<pre key={`code-${index}`}><code>{code.join("\n")}</code></pre>); index += 1; continue;
    }
    if (line.startsWith("### ")) { output.push(<h3 key={`h3-${index}`}>{inline(line.slice(4))}</h3>); index += 1; continue; }
    if (line.startsWith("## ")) { output.push(<h2 key={`h2-${index}`}>{inline(line.slice(3))}</h2>); index += 1; continue; }
    if (line.startsWith("> ")) { output.push(<aside className="lesson-callout" key={`callout-${index}`}>{inline(line.slice(2))}</aside>); index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[index + 1].trim())) {
      const tableLines = [line]; index += 1;
      while (index < lines.length && lines[index].includes("|")) { tableLines.push(lines[index]); index += 1; }
      output.push(table(tableLines, `table-${index}`)); continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^- /.test(lines[index])) { items.push(lines[index].slice(2)); index += 1; }
      output.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index])) { items.push(lines[index].replace(/^\d+\. /, "")); index += 1; }
      output.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{2,3} |```|> |- |\d+\. )/.test(lines[index])) { paragraph.push(lines[index]); index += 1; }
    output.push(<p key={`p-${index}`}>{inline(paragraph.join(" "))}</p>);
  }

  return <>{output}</>;
}
