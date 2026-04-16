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
          className="absolute top-2 right-2 p-1.5 rounded bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          title={copied ? 'Copied!' : 'Copy'}
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
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
