'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

// Dark code block with a hover "Copy" button — readable on both light and indigo bubbles.
function CodeBlock({ text, lang }: { text: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }).catch(() => {})
  }
  return (
    <div className="relative my-1.5 group/code text-left">
      <button onClick={copy} type="button"
        className="absolute top-1.5 right-1.5 z-10 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 opacity-0 group-hover/code:opacity-100 transition-opacity">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      {lang && <span className="absolute top-1.5 left-2 text-[9px] uppercase tracking-wide text-slate-400 font-semibold">{lang}</span>}
      <pre className={`bg-slate-800 text-slate-100 rounded-lg p-3 ${lang ? 'pt-5' : ''} pr-14 overflow-x-auto text-[12px] leading-relaxed`}>
        <code className="font-mono whitespace-pre">{text}</code>
      </pre>
    </div>
  )
}

// Renders a chat message body as markdown. Headline feature: fenced ``` code blocks.
// Single newlines are preserved as line breaks (chat expectation) via remark-breaks.
export default function ChatMessageBody({ body, mine }: { body: string; mine: boolean }) {
  const linkCls = mine ? 'text-indigo-100 underline underline-offset-2' : 'text-indigo-600 hover:underline'
  const inlineCodeCls = mine ? 'bg-white/20 text-white' : 'bg-gray-200 text-pink-700'
  return (
    <div className="text-sm break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p:  p => <p className="my-0.5 whitespace-pre-wrap" {...p} />,
          a:  ({ node, ...p }: any) => <a className={linkCls} target="_blank" rel="noopener noreferrer" {...p} />,
          ul: p => <ul className="list-disc pl-5 my-1 space-y-0.5" {...p} />,
          ol: p => <ol className="list-decimal pl-5 my-1 space-y-0.5" {...p} />,
          li: p => <li className="my-0" {...p} />,
          strong: p => <strong className="font-semibold" {...p} />,
          blockquote: p => <blockquote className={`border-l-2 pl-2.5 my-1 italic ${mine ? 'border-white/40' : 'border-gray-300 text-gray-600'}`} {...p} />,
          h1: p => <p className="font-bold text-[15px] my-1" {...p} />,
          h2: p => <p className="font-bold text-[14px] my-1" {...p} />,
          h3: p => <p className="font-semibold text-[14px] my-1" {...p} />,
          pre: ({ children }: any) => <>{children}</>,
          code: ({ className, children, ...p }: any) => {
            const raw = String(children ?? '')
            const langMatch = /language-(\w+)/.exec(className || '')
            const isBlock = langMatch != null || /\n/.test(raw)
            if (isBlock) return <CodeBlock text={raw.replace(/\n$/, '')} lang={langMatch?.[1]} />
            return <code className={`px-1 py-0.5 rounded text-[0.85em] font-mono ${inlineCodeCls}`} {...p}>{children}</code>
          },
        }}
      >{body}</ReactMarkdown>
    </div>
  )
}
