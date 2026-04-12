'use client'

import { useState } from 'react'
import { ClarifyQuestion } from '@/types/itinerary'

interface Props {
  questions: ClarifyQuestion[]
  onSubmit: (answers: Record<string, string | number>) => void
  onSkip: () => void
}

export default function ClarifyWidget({ questions, onSubmit, onSkip }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number>>(() => {
    const defaults: Record<string, string | number> = {}
    questions.forEach((q) => {
      if (q.type === 'slider') defaults[q.key] = Math.round(((q.min ?? 0) + (q.max ?? 100)) / 2)
      else if (q.options?.length) defaults[q.key] = q.options[0]
    })
    return defaults
  })

  const [sliderBounds, setSliderBounds] = useState<Record<string, { min: number; max: number }>>(() => {
    const bounds: Record<string, { min: number; max: number }> = {}
    questions.forEach((q) => {
      if (q.type === 'slider') bounds[q.key] = { min: q.min ?? 0, max: q.max ?? 100 }
    })
    return bounds
  })

  const [editingBound, setEditingBound] = useState<{ key: string; side: 'min' | 'max' } | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const set = (key: string, val: string | number) =>
    setAnswers((prev) => ({ ...prev, [key]: val }))

  const getBounds = (q: ClarifyQuestion) =>
    sliderBounds[q.key] ?? { min: q.min ?? 0, max: q.max ?? 100 }

  const startEditBound = (key: string, side: 'min' | 'max', current: number) => {
    setEditingBound({ key, side })
    setEditingValue(String(current))
  }

  const commitEditBound = (q: ClarifyQuestion) => {
    if (!editingBound) return
    const num = parseInt(editingValue, 10)
    if (!isNaN(num)) {
      const bounds = getBounds(q)
      const newMin = editingBound.side === 'min' ? num : bounds.min
      const newMax = editingBound.side === 'max' ? num : bounds.max
      if (newMin < newMax) {
        setSliderBounds((prev) => ({ ...prev, [editingBound.key]: { min: newMin, max: newMax } }))
        // Clamp current answer within new bounds
        const current = answers[editingBound.key] as number
        set(editingBound.key, Math.min(Math.max(current, newMin), newMax))
      }
    }
    setEditingBound(null)
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm space-y-4">
      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">
        Help me personalize your trip ✨
      </p>

      {questions.map((q) => (
        <div key={q.key} className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">{q.label}</label>

          {q.type === 'slider' && (() => {
            const bounds = getBounds(q)
            return (
              <div className="space-y-1">
                <input
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={q.step ?? 1}
                  value={answers[q.key] as number}
                  onChange={(e) => set(q.key, Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between items-center text-xs text-gray-400">
                  {editingBound?.key === q.key && editingBound.side === 'min' ? (
                    <input
                      autoFocus
                      type="number"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => commitEditBound(q)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEditBound(q); if (e.key === 'Escape') setEditingBound(null) }}
                      className="w-16 border border-indigo-300 rounded px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  ) : (
                    <button
                      onClick={() => startEditBound(q.key, 'min', bounds.min)}
                      className="hover:text-indigo-500 hover:underline transition-colors cursor-text"
                      title="Click to edit minimum"
                    >
                      {q.unit}{bounds.min}
                    </button>
                  )}
                  <span className="font-semibold text-indigo-600 text-sm">
                    {q.unit}{answers[q.key]}
                  </span>
                  {editingBound?.key === q.key && editingBound.side === 'max' ? (
                    <input
                      autoFocus
                      type="number"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => commitEditBound(q)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEditBound(q); if (e.key === 'Escape') setEditingBound(null) }}
                      className="w-16 border border-indigo-300 rounded px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                    />
                  ) : (
                    <button
                      onClick={() => startEditBound(q.key, 'max', bounds.max)}
                      className="hover:text-indigo-500 hover:underline transition-colors cursor-text"
                      title="Click to edit maximum"
                    >
                      {q.unit}{bounds.max}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {q.type === 'select' && q.options && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => set(q.key, opt)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    answers[q.key] === opt
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'toggle' && q.options && q.options.length === 2 && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => set(q.key, opt)}
                  className={`px-4 py-1.5 text-sm transition-all ${
                    answers[q.key] === opt
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSubmit(answers)}
          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
        >
          Build my itinerary →
        </button>
        <button
          onClick={onSkip}
          className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
