'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// When `onChange` is provided, markdown task-list checkboxes (`- [ ]` / `- [x]`) become
// interactive: clicking one toggles its state and the caller receives the new markdown
// source — typically to persist it via a PATCH.
interface Props {
  value: string
  className?: string
  onChange?: (next: string) => void
}

// Flip the Nth `[ ]`/`[x]` token in the markdown source.
function toggleNthCheckbox(src: string, n: number): string {
  let i = 0
  return src.replace(/\[( |x|X)\]/g, (match, ch) => {
    if (i++ === n) return `[${ch === ' ' ? 'x' : ' '}]`
    return match
  })
}

export default function MarkdownView({ value, className, onChange }: Props) {
  // Counter that tracks render-order checkbox index. Reset on each render so that the
  // closure captured by the `input` component renderer below produces stable indices.
  let cbIdx = 0
  return (
    <div className={`md-view text-sm text-gray-700 leading-relaxed ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: p => <h1 className="text-lg font-semibold text-gray-900 mt-3 mb-2" {...p} />,
          h2: p => <h2 className="text-base font-semibold text-gray-900 mt-3 mb-1.5" {...p} />,
          h3: p => <h3 className="text-sm font-semibold text-gray-900 mt-2 mb-1" {...p} />,
          p:  p => <p className="my-1.5" {...p} />,
          ul: p => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...p} />,
          ol: p => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...p} />,
          li: p => <li className="my-0.5" {...p} />,
          a:  p => <a className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" {...p} />,
          code: ({ inline, children, ...p }: any) => inline
            ? <code className="bg-gray-100 text-pink-700 px-1 py-0.5 rounded text-[0.85em] font-mono" {...p}>{children}</code>
            : <code className="block bg-gray-50 border rounded p-2 my-2 text-xs font-mono whitespace-pre overflow-x-auto" {...p}>{children}</code>,
          pre: ({ children }: any) => <>{children}</>,
          blockquote: p => <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600 my-2" {...p} />,
          hr: () => <hr className="border-gray-200 my-3" />,
          table: p => <table className="border-collapse my-2 text-xs" {...p} />,
          th: p => <th className="border border-gray-200 px-2 py-1 bg-gray-50 text-left font-semibold" {...p} />,
          td: p => <td className="border border-gray-200 px-2 py-1" {...p} />,
          input: (p: any) => {
            if (p.type !== 'checkbox') return <input {...p} />
            // Read-only if no onChange handler was supplied.
            if (!onChange) {
              return <input type="checkbox" disabled className="mr-1 align-middle" checked={!!p.checked} readOnly />
            }
            const myIdx = cbIdx++
            return (
              <input type="checkbox" className="mr-1 align-middle cursor-pointer" checked={!!p.checked}
                onClick={e => e.stopPropagation()}  // don't trigger the surrounding edit-on-click
                onChange={() => onChange(toggleNthCheckbox(value, myIdx))} />
            )
          },
        }}
      >{value}</ReactMarkdown>
    </div>
  )
}
