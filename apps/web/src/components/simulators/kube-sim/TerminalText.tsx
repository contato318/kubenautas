import { memo, type CSSProperties } from 'react';

const colors = ['#64748b', '#f87171', '#4ade80', '#facc15', '#60a5fa', '#c084fc', '#22d3ee', '#e2e8f0'];

// Interpret the SGR colors emitted by the imported shell as React text nodes.
// Filenames and command output remain text, including anything resembling HTML.
export const TerminalText = memo(function TerminalText({ value }: { value: string }) {
  const parts = [];
  const codes = /\x1b\[([0-9;]*)([A-Za-z])/g;
  let style: CSSProperties = {}, start = 0, match;
  while ((match = codes.exec(value))) {
    if (match.index > start) parts.push(<span key={start} style={{ ...style }}>{value.slice(start, match.index)}</span>);
    if (match[2] === 'm') for (const code of (match[1] || '0').split(';').map(Number)) {
      if (code === 0) style = {};
      else if (code === 1) style.fontWeight = 700;
      else if (code === 2) style.opacity = 0.65;
      else if (code === 22) { delete style.fontWeight; delete style.opacity; }
      else if (code >= 30 && code <= 37) style.color = colors[code - 30];
      else if (code >= 90 && code <= 97) style.color = colors[code - 90];
      else if (code === 39) delete style.color;
    }
    start = codes.lastIndex;
  }
  if (start < value.length) parts.push(<span key={start} style={style}>{value.slice(start)}</span>);
  return <>{parts}</>;
});
