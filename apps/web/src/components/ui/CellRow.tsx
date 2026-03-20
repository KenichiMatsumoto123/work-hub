export function CellRow({ headers, values }: { headers?: string[]; values: string[] }) {
  return (
    <div className="flex border border-border rounded-md overflow-hidden">
      {values.map((val, i) => (
        <div
          key={i}
          className={`flex-1 flex flex-col ${i > 0 ? 'border-l border-border' : ''}`}
        >
          {headers && (
            <div className="text-[10px] text-text-dim px-2 py-1 bg-surface-hover border-b border-border">
              {headers[i] || ''}
            </div>
          )}
          <div
            className={`font-mono text-[13px] text-success p-2 bg-bg whitespace-pre-wrap ${
              values.length === 1 ? 'text-left' : 'text-center'
            }`}
          >
            {val}
          </div>
        </div>
      ))}
    </div>
  )
}
