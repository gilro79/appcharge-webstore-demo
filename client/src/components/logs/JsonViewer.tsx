interface JsonViewerProps {
  data: unknown;
}

export default function JsonViewer({ data }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return <span className="text-xs text-gray-500 italic">null</span>;
  }

  const formatted = JSON.stringify(data, null, 2);

  return (
    <pre className="text-xs bg-gray-950 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
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
  );
}
