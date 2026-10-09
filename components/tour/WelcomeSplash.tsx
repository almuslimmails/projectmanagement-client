'use client'
import { useEffect, useState } from 'react'

const SESSION_KEY = 'welcome-splash-shown-v1'
const VISIBLE_MS = 1600      // fully-visible window
const FADE_MS    = 500       // fade-out duration

// Full-viewport branded intro. Renders once per browser session (session-storage flag)
// then unmounts. Fade-out is CSS-driven for a soft exit.
export default function WelcomeSplash() {
  const [phase, setPhase] = useState<'off' | 'in' | 'out'>('off')

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Bail if we already showed the splash this session.
    if (window.sessionStorage.getItem(SESSION_KEY)) return
    window.sessionStorage.setItem(SESSION_KEY, '1')
    // Kick off the animation on the next frame so the fade-in transition fires.
    const rafId = requestAnimationFrame(() => setPhase('in'))
    const t1 = setTimeout(() => setPhase('out'), VISIBLE_MS)
    const t2 = setTimeout(() => setPhase('off'), VISIBLE_MS + FADE_MS)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, [])

  function skip() { setPhase('off') }

  if (phase === 'off') return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${phase === 'out' ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: 'radial-gradient(120% 100% at 50% 40%, #4F1051 0%, #3F0E40 45%, #2A0B2B 100%)' }}
      role="dialog"
      aria-label="Tathkarah Project Tracker — welcome"
    >
      {/* Skip button */}
      <button onClick={skip}
        className="absolute top-4 right-4 text-[11px] font-medium text-white/50 hover:text-white/90 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors">
        Skip →
      </button>

      <div className="flex flex-col items-center gap-6 px-6">
        {/* Brand mark — matches the sidebar badge, scaled up + animated */}
        <div className={`transition-transform duration-700 ease-out ${phase === 'in' ? 'scale-100' : 'scale-90'}`}>
          <div className="relative">
            {/* soft glow */}
            <div className="absolute inset-0 rounded-3xl bg-white/20 blur-2xl scale-125" />
            <div className="relative w-24 h-24 rounded-3xl bg-white text-[#3F0E40] flex items-center justify-center text-5xl font-extrabold shadow-2xl">
              T
            </div>
          </div>
        </div>

        <div className={`flex flex-col items-center gap-2 transition-all duration-700 delay-100 ${phase === 'in' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <h1 className="text-white font-extrabold text-3xl tracking-tight text-center">
            Tathkarah Project Tracker
          </h1>
          <p className="text-white/60 text-sm tracking-wide uppercase font-medium">
            Plan · Track · Ship
          </p>
        </div>

        {/* Three-dot loader */}
        <div className={`flex items-center gap-1.5 mt-2 transition-opacity duration-500 delay-300 ${phase === 'in' ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '240ms' }} />
        </div>
      </div>
    </div>
  )
}
