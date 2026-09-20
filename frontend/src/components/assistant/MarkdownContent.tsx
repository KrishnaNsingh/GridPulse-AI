import React from 'react';

interface MarkdownContentProps {
  content: string;
  style?: React.CSSProperties;
}

/**
 * Parses inline formatting:
 * - ***bold italic***
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - `code`
 * - [link](url)
 */
export function parseInline(text: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          style={{
            background: 'rgba(255, 255, 255, 0.09)',
            padding: '2px 6px',
            borderRadius: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.88em',
            color: '#38bdf8',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic: ***text***
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: '#ffffff' }}>
          <em style={{ fontStyle: 'italic' }}>{parseInline(part.slice(3, -3))}</em>
        </strong>
      );
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: '#ffffff' }}>
          {parseInline(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} style={{ fontStyle: 'italic', color: '#cbd5e1' }}>
          {parseInline(part.slice(1, -1))}
        </em>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#60a5fa',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          {linkMatch[1]}
        </a>
      );
    }

    return part;
  });
}

/**
 * Rich, responsive Markdown renderer for chat messages and assistant telemetry.
 * Formats bold, italic, code blocks, lists, headers, tables, and blockquotes cleanly.
 */
export function MarkdownContent({ content, style }: MarkdownContentProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div
          key={`code-${i}`}
          style={{
            margin: '10px 0',
            background: 'rgba(9, 13, 24, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {lang && (
            <div
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {lang}
            </div>
          )}
          <pre
            style={{
              padding: '12px 16px',
              margin: 0,
              overflowX: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 13,
              lineHeight: 1.55,
              color: '#e2e8f0',
            }}
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. Table: lines with '|'
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (row: string) =>
          row
            .slice(1, -1)
            .split('|')
            .map(cell => cell.trim());

        const headers = parseRow(tableLines[0]);
        const isSeparator = tableLines[1].replace(/[\s|:-]/g, '').length === 0;
        const bodyLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);

        elements.push(
          <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: 'rgba(255, 255, 255, 0.04)' }}>
                  {headers.map((h, hi) => (
                    <th key={hi} style={{ padding: '8px 12px', fontWeight: 600, color: '#ffffff' }}>
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyLines.map((rowStr, ri) => {
                  const cells = parseRow(rowStr);
                  return (
                    <tr
                      key={ri}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        background: ri % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      }}
                    >
                      {cells.map((cell, ci) => (
                        <td key={ci} style={{ padding: '7px 12px', color: '#cbd5e1' }}>
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings
    if (line.startsWith('### ')) {
      elements.push(
        <div
          key={`h3-${i}`}
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#ffffff',
            margin: '12px 0 6px',
            lineHeight: 1.4,
          }}
        >
          {parseInline(line.slice(4))}
        </div>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <div
          key={`h2-${i}`}
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
            margin: '14px 0 8px',
            lineHeight: 1.4,
          }}
        >
          {parseInline(line.slice(3))}
        </div>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <div
          key={`h1-${i}`}
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#ffffff',
            margin: '16px 0 10px',
            lineHeight: 1.3,
          }}
        >
          {parseInline(line.slice(2))}
        </div>
      );
      i++;
      continue;
    }

    // 4. Horizontal Rule
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      elements.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            margin: '12px 0',
          }}
        />
      );
      i++;
      continue;
    }

    // 5. Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <div
          key={`quote-${i}`}
          style={{
            borderLeft: '3px solid #38bdf8',
            paddingLeft: 12,
            margin: '8px 0',
            color: '#94a3b8',
            fontStyle: 'italic',
          }}
        >
          {parseInline(line.slice(2))}
        </div>
      );
      i++;
      continue;
    }

    // 6. Bullet lists: - item, * item, • item
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[3];
      elements.push(
        <div
          key={`bullet-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            margin: '3px 0',
            paddingLeft: Math.min(24, indent * 8 + 4),
          }}
        >
          <span
            style={{
              color: '#38bdf8',
              lineHeight: '1.65',
              fontSize: 14,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            •
          </span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.65 }}>
            {parseInline(text)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Numbered lists: 1. item
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      const indent = numberedMatch[1].length;
      const num = numberedMatch[2];
      const text = numberedMatch[3];
      elements.push(
        <div
          key={`num-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            margin: '3px 0',
            paddingLeft: Math.min(24, indent * 8 + 4),
          }}
        >
          <span
            style={{
              color: '#818cf8',
              fontWeight: 600,
              fontSize: 12,
              lineHeight: '1.65',
              minWidth: 16,
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {num}.
          </span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.65 }}>
            {parseInline(text)}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // 8. Empty line: spacing
    if (!line.trim()) {
      elements.push(<div key={`gap-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // 9. Standard text line / paragraph
    elements.push(
      <div key={`p-${i}`} style={{ minHeight: '1.4em', margin: '2px 0', lineHeight: 1.65 }}>
        {parseInline(line)}
      </div>
    );
    i++;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        ...style,
      }}
    >
      {elements}
    </div>
  );
}
