import { useState } from 'react';

interface JsonViewerProps {
  data: unknown;
  copyable?: boolean;
}

export default function JsonViewer({ data, copyable = false }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  if (data === null || data === undefined) {
    return <span className="text-xs text-gray-500 italic">null</span>;
  }

  const formatted = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {copyable && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-200 text-gray-600 hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
        {formatted.split('\n').map((line, i) => {
          const colored = line
            .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
            .replace(/: "([^"]*)"(,?)/g, ': <span class="json-string">"$1"</span>$2')
            .replace(/: (\d+\.?\d*)(,?)/g, ': <span class="json-number">$1</span>$2')
            .replace(/: (true|false)(,?)/g, ': <span class="json-boolean">$1</span>$2')
            .replace(/: (null)(,?)/g, ': <span class="json-null">$1</span>$2');
          return (
            <div key={i} dangerouslySetInnerHTML={{ __html: colored }} />
          );
        })}
      </pre>
    </div>
  );
}
