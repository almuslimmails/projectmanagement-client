'use client'

// Renders one of the bundled AI Foundations documents (public/ai/*.html) in a
// sandboxed iframe. The docs are complete standalone HTML pages with their own
// styling, so an iframe preserves them exactly as authored — no CSS bleed in
// either direction.

export interface AIDoc {
  slug: string      // filename without .html under public/ai/
  label: string     // sidebar + header label
  blurb: string     // one-liner under the header
}

export const AI_DOCS: AIDoc[] = [
  { slug: 'syllabus',   label: 'Syllabus',   blurb: 'AI Foundations course outline — modules, sessions, and outcomes.' },
  { slug: 'workbook',   label: 'Workbook',   blurb: 'Hands-on exercises to work through during the course.' },
  { slug: 'dictionary', label: 'Dictionary', blurb: 'Plain-language glossary of AI terms used across the programme.' },
  { slug: 'assessment', label: 'Assessment', blurb: 'End-of-course assessment paper.' },
  { slug: 'answer-key', label: 'Answer Key', blurb: 'Model answers — visible to owners, admins, and managers only.' },
]

export default function AIDocView({ doc }: { doc: AIDoc }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <header className="flex items-baseline gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">Artificial Intelligence</span>
        <h1 className="font-bold text-gray-900 text-[15px]">{doc.label}</h1>
        <p className="text-xs text-gray-500 truncate">{doc.blurb}</p>
        <a
          href={`/ai/${doc.slug}.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Open full page ↗
        </a>
      </header>
      <iframe
        src={`/ai/${doc.slug}.html`}
        title={doc.label}
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  )
}
