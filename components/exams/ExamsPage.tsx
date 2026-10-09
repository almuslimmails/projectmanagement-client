'use client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import type { Member } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { relTime } from '@/lib/utils'

interface Question {
  id: string
  text: string
  type: 'mcq' | 'text'
  options?: string[]
  correct?: number   // owner-facing only; assignee payloads never include it
}
interface Assignment {
  exam_id: string
  member_id: string
  status: 'assigned' | 'in_progress' | 'submitted' | 'disqualified'
  assigned_at: string
  started_at: string | null
  submitted_at: string | null
  violations: number
  answers: string
  auto_submitted: number
  score: number | null
  max_score: number | null
  member?: { id: string; name: string; role: string } | null
}
interface Exam {
  id: string
  title: string
  description: string
  duration_minutes: number
  max_violations: number
  created_at: string
  questions: Question[]
  assignments?: Assignment[]
  my?: Assignment | null
}

interface Props {
  members: Member[]
  currentMember: Member | null
}

const STATUS_STYLE: Record<string, string> = {
  assigned:     'bg-gray-100 text-gray-600',
  in_progress:  'bg-amber-100 text-amber-700',
  submitted:    'bg-emerald-100 text-emerald-700',
  disqualified: 'bg-red-100 text-red-700',
}

function parseAnswers(raw: string): Record<string, any> {
  try { const v = JSON.parse(raw || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

export default function ExamsPage({ members, currentMember }: Props) {
  const isOwner = currentMember?.role === 'owner'
  return isOwner
    ? <OwnerExams members={members} currentMember={currentMember} />
    : <MyExams currentMember={currentMember} />
}

// ═══ Owner: manage + results ═══════════════════════════════════════════════

function OwnerExams({ members, currentMember }: { members: Member[]; currentMember: Member | null }) {
  const [exams, setExams] = useState<Exam[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Exam | null>(null)
  const [viewingAnswers, setViewingAnswers] = useState<{ exam: Exam; a: Assignment } | null>(null)
  const [taking, setTaking] = useState<Exam | null>(null)

  async function refresh() {
    try { setExams(await api.listExams() as Exam[]) } catch { setExams([]) }
  }
  useEffect(() => { refresh() }, [])

  async function remove(e: Exam) {
    if (!confirm(`Delete exam "${e.title}"? All attempts and answers will be lost.`)) return
    await api.deleteExam(e.id)
    await refresh()
  }

  if (taking) {
    return <ExamRunner examId={taking.id} onExit={async () => { setTaking(null); await refresh() }} />
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">🎓 Exams</p>
            <h2 className="text-xl font-bold text-gray-900">Online exam module</h2>
            <p className="text-sm text-gray-500 mt-0.5">Build a question-by-question exam, assign it to members, and review scored results. Assignees see the Exams menu; everyone else doesn't.</p>
          </div>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New exam
          </button>
        </div>

        {exams === null ? (
          <p className="text-sm text-gray-400 italic">Loading…</p>
        ) : exams.length === 0 ? (
          <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-sm text-gray-500">No exams yet.</p>
            <button onClick={() => setCreating(true)} className="mt-2 text-sm text-indigo-600 hover:underline">Create the first one</button>
          </div>
        ) : (
          <ul className="space-y-4">
            {exams.map(e => (
              <ExamCard key={e.id} exam={e} members={members} currentMemberId={currentMember?.id ?? null}
                onChanged={refresh} onDelete={() => remove(e)} onEdit={() => setEditing(e)}
                onViewAnswers={(a) => setViewingAnswers({ exam: e, a })}
                onTake={() => setTaking(e)} />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <ExamBuilderModal onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await refresh() }} />
      )}
      {editing && (
        <ExamBuilderModal initial={editing} onClose={() => setEditing(null)} onCreated={async () => { setEditing(null); await refresh() }} />
      )}
      {viewingAnswers && (
        <AnswersModal exam={viewingAnswers.exam} a={viewingAnswers.a} onClose={() => setViewingAnswers(null)} />
      )}
    </div>
  )
}

function ExamCard({ exam, members, currentMemberId, onChanged, onDelete, onEdit, onViewAnswers, onTake }: {
  exam: Exam; members: Member[]; currentMemberId: string | null
  onChanged: () => void; onDelete: () => void; onEdit: () => void
  onViewAnswers: (a: Assignment) => void
  onTake: () => void
}) {
  const [editingRoster, setEditingRoster] = useState(false)
  const [roster, setRoster] = useState<string[]>((exam.assignments ?? []).map(a => a.member_id))
  const mcqCount = exam.questions.filter(q => q.type === 'mcq').length
  const textCount = exam.questions.length - mcqCount
  const selfAssigned = (exam.assignments ?? []).some(a => a.member_id === currentMemberId && (a.status === 'assigned' || a.status === 'in_progress'))

  async function saveRoster() {
    await api.assignExam(exam.id, roster)
    setEditingRoster(false)
    onChanged()
  }

  return (
    <li className="bg-white ring-1 ring-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">📝</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900">{exam.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {exam.questions.length} question{exam.questions.length === 1 ? '' : 's'}
            {mcqCount > 0 && ` (${mcqCount} choice${textCount > 0 ? ` + ${textCount} written` : ''})`}
            {' '}· {exam.duration_minutes} min · max {exam.max_violations} violation{exam.max_violations === 1 ? '' : 's'}
            {' '}· created {relTime(exam.created_at)}
          </p>
          {exam.description && <p className="text-sm text-gray-600 mt-1">{exam.description}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          {selfAssigned && (
            <button onClick={onTake}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-md">Take</button>
          )}
          <button onClick={onEdit}
            title="Edit exam (questions, timing, rules)"
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onClick={() => setEditingRoster(r => !r)}
            title="Assign members"
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          </button>
          <button onClick={onDelete}
            title="Delete exam"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>

      {editingRoster && (
        <div className="ring-1 ring-indigo-100 bg-indigo-50/40 rounded-lg p-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Assigned members</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {members.map(m => {
              const on = roster.includes(m.id)
              return (
                <button key={m.id}
                  onClick={() => setRoster(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${on ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                  <Avatar name={m.name} size={3} /> {m.name}
                </button>
              )
            })}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditingRoster(false); setRoster((exam.assignments ?? []).map(a => a.member_id)) }}
              className="text-[11px] text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={saveRoster}
              className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded">Save roster</button>
          </div>
        </div>
      )}

      {(exam.assignments ?? []).length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-500">
                <th className="text-left py-1.5 pr-3 font-semibold">Member</th>
                <th className="text-left py-1.5 px-3 font-semibold">Status</th>
                <th className="text-right py-1.5 px-3 font-semibold">Score</th>
                <th className="text-right py-1.5 px-3 font-semibold">Violations</th>
                <th className="text-left py-1.5 px-3 font-semibold">Submitted</th>
                <th className="text-right py-1.5 pl-3 font-semibold">Answers</th>
              </tr>
            </thead>
            <tbody>
              {(exam.assignments ?? []).map(a => (
                <tr key={a.member_id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      {a.member && <Avatar name={a.member.name} size={4} />}
                      <span className="font-medium text-gray-800">{a.member?.name ?? a.member_id.slice(0, 8)}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[a.status]}`}>
                      {a.status.replace('_', ' ')}{a.auto_submitted ? ' · auto' : ''}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-800">
                    {a.score !== null && a.max_score ? `${a.score}/${a.max_score}` : <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums ${a.violations > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{a.violations}</td>
                  <td className="py-2 px-3 text-gray-500">{a.submitted_at ? relTime(a.submitted_at) : '—'}</td>
                  <td className="py-2 pl-3 text-right">
                    {a.answers
                      ? <button onClick={() => onViewAnswers(a)} className="text-indigo-600 hover:underline font-medium">review</button>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 italic">Nobody assigned yet — click the 👤+ button to assign members.</p>
      )}
    </li>
  )
}

// ── Builder ────────────────────────────────────────────────────────────────

interface QDraft {
  text: string
  type: 'mcq' | 'text'
  options: string[]
  correct: number | null
}

function ExamBuilderModal({ initial, onClose, onCreated }: { initial?: Exam | null; onClose: () => void; onCreated: () => void }) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 60)
  const [maxViolations, setMaxViolations] = useState(initial?.max_violations ?? 3)
  const [questions, setQuestions] = useState<QDraft[]>(() =>
    initial && initial.questions.length > 0
      ? initial.questions.map(q => ({
          text: q.text,
          type: q.type,
          options: q.type === 'mcq' ? [...(q.options ?? [])] : [],
          correct: q.type === 'mcq' && typeof q.correct === 'number' ? q.correct : null,
        }))
      : [{ text: '', type: 'mcq', options: ['', ''], correct: null }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Warn when editing an exam people have already sat — question changes
  // re-score their submissions against the new key.
  const closedAttempts = (initial?.assignments ?? []).filter(a => a.status === 'submitted' || a.status === 'disqualified').length

  function patchQ(i: number, patch: Partial<QDraft>) {
    setQuestions(prev => prev.map((q, j) => j === i ? { ...q, ...patch } : q))
  }
  function removeQ(i: number) {
    setQuestions(prev => prev.filter((_, j) => j !== i))
  }
  function addQ(type: 'mcq' | 'text') {
    setQuestions(prev => [...prev, { text: '', type, options: type === 'mcq' ? ['', ''] : [], correct: null }])
  }
  function patchOption(qi: number, oi: number, value: string) {
    setQuestions(prev => prev.map((q, j) => j === qi
      ? { ...q, options: q.options.map((o, k) => k === oi ? value : o) }
      : q))
  }

  const valid = title.trim().length > 0 && questions.some(q =>
    q.text.trim() && (q.type === 'text' || q.options.filter(o => o.trim()).length >= 2))

  async function submit() {
    if (!valid) { setError('Give the exam a title and at least one complete question.'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        title: title.trim(),
        description,
        duration_minutes: duration,
        max_violations: maxViolations,
        questions: questions.map(q => ({
          text: q.text,
          type: q.type,
          options: q.type === 'mcq' ? q.options : undefined,
          correct: q.type === 'mcq' && q.correct !== null ? q.correct : undefined,
        })),
      }
      if (isEdit && initial) await api.updateExam(initial.id, payload)
      else                   await api.createExam(payload)
      onCreated()
    } catch (e: any) { setError(e?.message ?? 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-3 border-b shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">🎓 {isEdit ? 'Edit exam' : 'New exam'}</p>
          <h2 className="text-sm font-semibold text-gray-900">{isEdit ? initial?.title : 'Build the question wizard'}</h2>
          {isEdit && closedAttempts > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-2 py-1 mt-1.5">
              ⚠️ {closedAttempts} member{closedAttempts === 1 ? ' has' : 's have'} already submitted. Changing questions re-scores
              their answers against the new key; reordering questions can misalign old answers.
            </p>
          )}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px] gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="AI Foundations — Final Assessment"
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Minutes</label>
              <input type="number" min={5} value={duration} onChange={e => setDuration(Math.max(5, parseInt(e.target.value) || 60))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Violations</label>
              <input type="number" min={1} value={maxViolations} onChange={e => setMaxViolations(Math.max(1, parseInt(e.target.value) || 3))}
                className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Instructions (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Closed book. Answer every question."
              className="w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>

          {/* Questions */}
          <div className="space-y-3">
            {questions.map((q, qi) => (
              <div key={qi} className="ring-1 ring-gray-200 rounded-xl p-4 space-y-2.5 bg-gray-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-600 tabular-nums shrink-0">Q{qi + 1}</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${q.type === 'mcq' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`}>
                    {q.type === 'mcq' ? 'Multiple choice' : 'Written answer'}
                  </span>
                  <button onClick={() => removeQ(qi)} title="Remove question"
                    className="ml-auto text-gray-300 hover:text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <textarea value={q.text} onChange={e => patchQ(qi, { text: e.target.value })}
                  rows={2} placeholder="Question text…"
                  className="w-full text-sm border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                {q.type === 'mcq' && (
                  <div className="space-y-1.5">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${qi}`} checked={q.correct === oi}
                          onChange={() => patchQ(qi, { correct: oi })}
                          title="Mark as the correct answer"
                          className="cursor-pointer accent-emerald-600 shrink-0" />
                        <input value={o} onChange={e => patchOption(qi, oi, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                          className="flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
                        {q.options.length > 2 && (
                          <button onClick={() => patchQ(qi, {
                              options: q.options.filter((_, k) => k !== oi),
                              correct: q.correct === oi ? null : (q.correct !== null && q.correct > oi ? q.correct - 1 : q.correct),
                            })}
                            className="text-gray-300 hover:text-red-500 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between pl-5">
                      {q.options.length < 8 && (
                        <button onClick={() => patchQ(qi, { options: [...q.options, ''] })}
                          className="text-[11px] text-indigo-600 hover:underline">+ add option</button>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {q.correct === null ? 'select the radio next to the correct option to enable auto-scoring' : `correct: option ${String.fromCharCode(65 + q.correct)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={() => addQ('mcq')}
                className="flex-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 ring-1 ring-indigo-200 rounded-lg py-2">
                + Multiple choice question
              </button>
              <button onClick={() => addQ('text')}
                className="flex-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 ring-1 ring-sky-200 rounded-lg py-2">
                + Written question
              </button>
            </div>
          </div>

          {error && <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-gray-50 shrink-0">
          <span className="text-[11px] text-gray-500">{questions.length} question{questions.length === 1 ? '' : 's'}</span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="text-sm text-gray-600 hover:bg-gray-200 px-4 py-1.5 rounded-lg">Cancel</button>
            <button onClick={submit} disabled={saving || !valid}
              className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-1.5 rounded-lg shadow-sm">
              {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create exam')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Owner answer review ────────────────────────────────────────────────────

function AnswersModal({ exam, a, onClose }: { exam: Exam; a: Assignment; onClose: () => void }) {
  const answers = parseAnswers(a.answers)
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b shrink-0 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Answer review</p>
            <h2 className="text-sm font-semibold text-gray-900">{a.member?.name} · {exam.title}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              <span className={`font-bold uppercase ${a.status === 'disqualified' ? 'text-red-600' : 'text-emerald-600'}`}>{a.status.replace('_', ' ')}</span>
              {a.score !== null && a.max_score ? ` · score ${a.score}/${a.max_score}` : ''}
              {' '}· {a.violations} violation{a.violations === 1 ? '' : 's'}
              {a.submitted_at && ` · submitted ${relTime(a.submitted_at)}`}
              {!!a.auto_submitted && ' · auto-submitted'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          {exam.questions.length === 0 ? (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words font-sans">{a.answers || '(empty)'}</pre>
          ) : exam.questions.map((q, i) => {
            const given = answers[q.id]
            const answered = given !== undefined && given !== null && String(given).trim() !== ''
            const isMcq = q.type === 'mcq'
            const givenIdx = isMcq && answered ? Number(given) : null
            const hasKey = isMcq && typeof q.correct === 'number'
            const isRight = hasKey && givenIdx === q.correct
            return (
              <div key={q.id} className="ring-1 ring-gray-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  <span className="text-indigo-600 tabular-nums mr-1.5">Q{i + 1}.</span>{q.text}
                  {hasKey && answered && (
                    <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isRight ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {isRight ? '✓ correct' : '✗ wrong'}
                    </span>
                  )}
                </p>
                {!answered ? (
                  <p className="text-xs text-gray-400 italic">(not answered)</p>
                ) : isMcq ? (
                  <div className="space-y-1">
                    {(q.options ?? []).map((o, oi) => {
                      const chosen = givenIdx === oi
                      const correct = hasKey && q.correct === oi
                      return (
                        <p key={oi} className={`text-xs px-2.5 py-1.5 rounded-md ${chosen ? (correct || !hasKey ? 'bg-indigo-50 ring-1 ring-indigo-200 text-indigo-800 font-medium' : 'bg-red-50 ring-1 ring-red-200 text-red-700 font-medium') : correct ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800' : 'text-gray-600'}`}>
                          <span className="font-mono mr-1.5">{String.fromCharCode(65 + oi)}.</span>{o}
                          {chosen && <span className="ml-1.5 text-[10px]">← answered</span>}
                          {correct && !chosen && <span className="ml-1.5 text-[10px]">✓ key</span>}
                        </p>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words bg-gray-50 rounded-md px-3 py-2">{String(given)}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══ Member: my exams ══════════════════════════════════════════════════════

function MyExams({ currentMember }: { currentMember: Member | null }) {
  const [exams, setExams] = useState<Exam[] | null>(null)
  const [takingId, setTakingId] = useState<string | null>(null)

  async function refresh() {
    try { setExams(await api.listMyExams() as Exam[]) } catch { setExams([]) }
  }
  useEffect(() => { refresh() }, [currentMember?.id])

  if (takingId) {
    return <ExamRunner examId={takingId} onExit={async () => { setTakingId(null); await refresh() }} />
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">🎓 Exams</p>
          <h2 className="text-xl font-bold text-gray-900">My exams</h2>
          <p className="text-sm text-gray-500 mt-0.5">Exams assigned to you. Once you start, stay on this screen — leaving is recorded and repeated violations end the attempt.</p>
        </div>

        {exams === null ? (
          <p className="text-sm text-gray-400 italic">Loading…</p>
        ) : exams.length === 0 ? (
          <div className="bg-white ring-1 ring-gray-100 rounded-2xl p-8 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm text-gray-500">No exams assigned to you right now.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {exams.map(e => {
              const my = e.my!
              const closed = my.status === 'submitted' || my.status === 'disqualified'
              return (
                <li key={e.id} className="bg-white ring-1 ring-gray-100 rounded-2xl p-5 flex items-center gap-4">
                  <span className="text-2xl leading-none">📝</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{e.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.questions.length} question{e.questions.length === 1 ? '' : 's'} · {e.duration_minutes} minutes · max {e.max_violations} violations
                      {e.description && <> · {e.description}</>}
                    </p>
                    <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[my.status]}`}>
                      {my.status.replace('_', ' ')}
                      {my.status === 'submitted' && my.score !== null && my.max_score ? ` · ${my.score}/${my.max_score}` : ''}
                    </span>
                  </div>
                  {!closed && (
                    <button onClick={() => setTakingId(e.id)}
                      className="shrink-0 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm">
                      {my.status === 'in_progress' ? 'Resume' : 'Start exam'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ═══ Proctored wizard runner ═══════════════════════════════════════════════
// One question per screen, palette to jump, review step before submit.
// Proctoring: fullscreen enforced, tab-switch / blur / fullscreen-exit each
// report a violation server-side (2s debounce); max violations disqualifies
// server-side and force-submits whatever has been answered. Countdown
// auto-submits at 0.

function ExamRunner({ examId, onExit }: { examId: string; onExit: () => void }) {
  const [exam, setExam] = useState<Exam | null>(null)
  const [phase, setPhase] = useState<'rules' | 'running' | 'done'>('rules')
  const [idx, setIdx] = useState(0)                              // question index; questions.length = review screen
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [violations, setViolations] = useState(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [endState, setEndState] = useState<'submitted' | 'disqualified' | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const shellRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(false)
  const lastViolationRef = useRef(0)
  const answersRef = useRef<Record<string, any>>({})
  answersRef.current = answers

  useEffect(() => {
    api.getMyExam(examId).then((e: Exam) => {
      setExam(e)
      setAnswers(parseAnswers(e.my?.answers ?? ''))
      setViolations(e.my?.violations ?? 0)
      if (e.my?.status === 'submitted' || e.my?.status === 'disqualified') {
        setEndState(e.my.status)
        setPhase('done')
      }
    }).catch(() => onExit())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId])

  // ── Proctoring listeners ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') { runningRef.current = false; return }
    runningRef.current = true

    async function violate(reason: string) {
      if (!runningRef.current) return
      const now = Date.now()
      if (now - lastViolationRef.current < 2000) return
      lastViolationRef.current = now
      try {
        const r: any = await api.reportViolation(examId)
        setViolations(r.violations)
        if (r.disqualified) {
          await finish(true, 'disqualified')
        } else {
          setWarning(`${reason} — violation ${r.violations} of ${exam?.max_violations}. Return to the exam immediately.`)
        }
      } catch { /* attempt already closed */ }
    }

    const onVis = () => { if (document.hidden) violate('You left the exam tab') }
    const onBlur = () => violate('The exam window lost focus')
    const onFs = () => { if (!document.fullscreenElement) violate('You exited fullscreen') }
    const onCtx = (e: Event) => e.preventDefault()
    const onCopy = (e: Event) => e.preventDefault()

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('contextmenu', onCtx)
    document.addEventListener('copy', onCopy)
    return () => {
      runningRef.current = false
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('contextmenu', onCtx)
      document.removeEventListener('copy', onCopy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, examId, exam?.max_violations])

  // ── Countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || !exam) return
    const startedAt = exam.my?.started_at
      ? new Date(exam.my.started_at.replace(' ', 'T') + 'Z').getTime()
      : Date.now()
    const deadline = startedAt + exam.duration_minutes * 60_000
    const t = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) { clearInterval(t); finish(true, 'submitted') }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, exam])

  async function start() {
    if (!exam) return
    try {
      const a: any = await api.startExam(examId)
      setExam(prev => prev ? { ...prev, my: a } : prev)
      setViolations(a.violations ?? 0)
      try { await shellRef.current?.requestFullscreen() } catch {}
      setPhase('running')
    } catch (e: any) {
      alert(e?.message ?? 'Could not start the exam')
      onExit()
    }
  }

  async function finish(auto: boolean, kind: 'submitted' | 'disqualified') {
    runningRef.current = false
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch {}
    try { await api.submitExam(examId, JSON.stringify(answersRef.current), auto) } catch {}
    setEndState(kind)
    setPhase('done')
  }

  if (!exam) return <div className="flex-1 p-8 text-sm text-gray-500">Loading exam…</div>

  const qs = exam.questions
  const onReview = idx >= qs.length
  const q = onReview ? null : qs[idx]
  const answeredCount = qs.filter(x => {
    const v = answers[x.id]
    return v !== undefined && v !== null && String(v).trim() !== ''
  }).length

  const mm = remaining !== null ? Math.floor(remaining / 60) : exam.duration_minutes
  const ss = remaining !== null ? remaining % 60 : 0
  const lowTime = remaining !== null && remaining < 300

  return (
    <div ref={shellRef} className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {phase === 'rules' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-lg bg-white ring-1 ring-gray-200 rounded-2xl p-8 text-center space-y-4">
            <div className="text-4xl">🎓</div>
            <h2 className="text-xl font-bold text-gray-900">{exam.title}</h2>
            {exam.description && <p className="text-sm text-gray-600">{exam.description}</p>}
            <p className="text-sm text-gray-700 font-medium">{qs.length} questions · {exam.duration_minutes} minutes</p>
            <div className="text-left text-sm text-gray-700 bg-amber-50 ring-1 ring-amber-200 rounded-xl p-4 space-y-1.5">
              <p className="font-semibold text-amber-800">Exam rules — read before starting</p>
              <p>⏱ The clock starts when you click Start and does not pause.</p>
              <p>🖥 The exam runs in fullscreen. <b>Leaving the tab, switching windows, or exiting fullscreen is recorded as a violation.</b></p>
              <p>🚫 <b>{exam.max_violations} violations end your attempt</b> — answers so far are submitted and the attempt is marked disqualified.</p>
              <p>💾 Time up = auto-submit. You can move between questions freely and submit from the review step.</p>
            </div>
            <div className="flex justify-center gap-3 pt-1">
              <button onClick={onExit} className="text-sm text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg">Not now</button>
              <button onClick={start}
                className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg shadow-sm">
                {exam.my?.status === 'in_progress' ? 'Resume exam' : 'Start exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'running' && (
        <>
          {/* Header: title · palette · timer · violations · submit */}
          <div className="flex items-center gap-4 px-6 py-2.5 bg-gray-900 text-white shrink-0">
            <span className="text-sm font-semibold truncate">{exam.title}</span>
            <span className="text-xs text-white/60">{answeredCount}/{qs.length} answered</span>
            <span className={`ml-auto font-mono text-lg font-bold tabular-nums ${lowTime ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
            </span>
            <span className={`text-xs font-semibold ${violations > 0 ? 'text-red-400' : 'text-white/50'}`}>
              violations {violations}/{exam.max_violations}
            </span>
          </div>

          {/* Question palette */}
          <div className="flex items-center gap-1.5 px-6 py-2 bg-white border-b border-gray-200 overflow-x-auto shrink-0">
            {qs.map((x, i) => {
              const answered = answers[x.id] !== undefined && answers[x.id] !== null && String(answers[x.id]).trim() !== ''
              const active = i === idx
              return (
                <button key={x.id} onClick={() => setIdx(i)}
                  title={`Question ${i + 1}`}
                  className={`w-7 h-7 shrink-0 rounded-md text-[11px] font-bold tabular-nums transition-colors ${active ? 'bg-indigo-600 text-white' : answered ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              )
            })}
            <button onClick={() => setIdx(qs.length)}
              className={`ml-1 px-2.5 h-7 shrink-0 rounded-md text-[11px] font-bold transition-colors ${onReview ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              Review
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-8">
              {q ? (
                <div className="bg-white ring-1 ring-gray-200 rounded-2xl p-6 space-y-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                      Question {idx + 1} of {qs.length}
                      <span className="ml-2 normal-case tracking-normal text-gray-400 font-medium">
                        {q.type === 'mcq' ? 'choose one answer' : 'written answer'}
                      </span>
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 leading-snug">{q.text}</h3>
                  </div>

                  {q.type === 'mcq' ? (
                    <div className="space-y-2">
                      {(q.options ?? []).map((o, oi) => {
                        const chosen = Number(answers[q.id]) === oi && answers[q.id] !== undefined && answers[q.id] !== null && String(answers[q.id]) !== ''
                        return (
                          <button key={oi}
                            onClick={() => setAnswers(prev => ({ ...prev, [q.id]: oi }))}
                            className={`w-full flex items-start gap-3 text-left text-sm rounded-xl px-4 py-3 ring-1 transition-colors ${chosen ? 'bg-indigo-50 ring-indigo-300 text-indigo-900' : 'bg-white ring-gray-200 text-gray-800 hover:ring-indigo-200 hover:bg-indigo-50/40'}`}>
                            <span className={`shrink-0 w-5 h-5 rounded-full ring-2 flex items-center justify-center ${chosen ? 'ring-indigo-500' : 'ring-gray-300'}`}>
                              {chosen && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                            </span>
                            <span><span className="font-mono text-gray-400 mr-1.5">{String.fromCharCode(65 + oi)}.</span>{o}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={typeof answers[q.id] === 'string' ? answers[q.id] : ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={8}
                      placeholder="Type your answer…"
                      className="w-full text-sm text-gray-800 border rounded-xl p-4 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  )}

                  <div className="flex justify-between pt-1">
                    <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                      className="text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 px-4 py-2 rounded-lg">
                      ← Previous
                    </button>
                    <button onClick={() => setIdx(i => i + 1)}
                      className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg shadow-sm">
                      {idx === qs.length - 1 ? 'Review answers →' : 'Next →'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Review screen */
                <div className="bg-white ring-1 ring-gray-200 rounded-2xl p-6 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Review</p>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {answeredCount === qs.length
                        ? 'All questions answered.'
                        : `${qs.length - answeredCount} question${qs.length - answeredCount === 1 ? '' : 's'} still blank.`}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {qs.map((x, i) => {
                      const v = answers[x.id]
                      const answered = v !== undefined && v !== null && String(v).trim() !== ''
                      return (
                        <li key={x.id} className="py-2 flex items-center gap-3">
                          <span className={`w-6 h-6 shrink-0 rounded-md text-[11px] font-bold tabular-nums flex items-center justify-center ${answered ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600 ring-1 ring-red-200'}`}>{i + 1}</span>
                          <span className="text-sm text-gray-800 truncate flex-1">{x.text}</span>
                          <span className="text-xs text-gray-500 shrink-0">
                            {!answered ? 'blank'
                              : x.type === 'mcq' ? `option ${String.fromCharCode(65 + Number(v))}`
                              : `${String(v).length} chars`}
                          </span>
                          <button onClick={() => setIdx(i)} className="text-[11px] text-indigo-600 hover:underline shrink-0">edit</button>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex justify-end pt-1">
                    <button onClick={() => { if (confirm(`Submit ${answeredCount}/${qs.length} answered questions? This ends the exam.`)) finish(false, 'submitted') }}
                      className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-lg shadow-sm">
                      Submit exam
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Violation warning overlay */}
          {warning && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-red-900/80">
              <div className="max-w-md bg-white rounded-2xl p-8 text-center space-y-4 shadow-2xl">
                <div className="text-4xl">⚠️</div>
                <h3 className="text-lg font-bold text-red-700">Proctoring violation</h3>
                <p className="text-sm text-gray-700">{warning}</p>
                <button onClick={async () => {
                    setWarning(null)
                    try { if (!document.fullscreenElement) await shellRef.current?.requestFullscreen() } catch {}
                  }}
                  className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-5 py-2 rounded-lg">
                  Return to exam
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === 'done' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md bg-white ring-1 ring-gray-200 rounded-2xl p-8 text-center space-y-3">
            <div className="text-4xl">{endState === 'disqualified' ? '🚫' : '✅'}</div>
            <h2 className="text-xl font-bold text-gray-900">
              {endState === 'disqualified' ? 'Attempt ended' : 'Exam submitted'}
            </h2>
            <p className="text-sm text-gray-600">
              {endState === 'disqualified'
                ? 'Your attempt was closed after reaching the violation limit. Your answers so far were submitted for review.'
                : 'Your answers are in. The workspace owner will review them.'}
            </p>
            <button onClick={onExit}
              className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-lg mt-2">
              Back to exams
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
