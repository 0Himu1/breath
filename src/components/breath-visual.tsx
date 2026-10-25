'use client';

import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { BreathPattern, PatternSlug } from '@/lib/patterns';
import { VARIABLE_HOLD_SECONDS } from '@/lib/breath-motion';

// Preserve real seconds across slow frames; visibilitychange handles intentional pauses.
if (typeof window !== 'undefined') gsap.ticker.lagSmoothing(0);

export const visualGuides: Record<PatternSlug, string> = {
  coherent: 'Let the rings open on your inhale and settle on your exhale.',
  box: 'Follow the light around four equal sides. Keep still during each hold.',
  '478': 'Open with the crescent, rest at the top, then soften into a long exhale.',
  sigh: 'Raise the arches, add the small top-up, then let both settle.',
  wimhof: 'Follow the rays through each breath, then rest during the hold.',
  buteyko: 'Let the petals open just a little, then rest after the exhale.',
};

export function PhaseRail({ pattern, activeIndex }: { pattern: BreathPattern; activeIndex: number }) {
  const phases = pattern.slug === 'wimhof'
    ? [pattern.phases[0], pattern.phases[1], pattern.phases[60], pattern.phases[61]]
    : pattern.phases;
  const active = pattern.slug === 'wimhof' ? (activeIndex < 60 ? activeIndex % 2 : activeIndex - 58) : activeIndex;
  return <ol className="phase-rail" aria-label="Breathing sequence">
    {phases.map((phase, index) => <li key={index} aria-current={active === index ? 'step' : undefined}>
      <span>{phase.label === 'Inhale (top-up)' ? 'Top-up' : phase.label === 'Recovery Inhale' ? 'Recovery' : phase.label}</span>
      <span className="phase-duration">{phase.seconds ?? VARIABLE_HOLD_SECONDS}s</span>
    </li>)}
  </ol>;
}

/** One GSAP playhead controls both the drawing and the session clock. */
export function BreathVisual({ pattern, playing = true, miniature = false, onTime }: {
  pattern: BreathPattern;
  playing?: boolean;
  miniature?: boolean;
  onTime?: (seconds: number) => void;
}) {
  const root = useRef<SVGSVGElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const playingRef = useRef(playing);
  const onTimeRef = useRef(onTime);
  useLayoutEffect(() => { onTimeRef.current = onTime; });
  useLayoutEffect(() => { playingRef.current = playing; }, [playing]);

  useLayoutEffect(() => {
    if (miniature || !root.current) return;
    const media = gsap.matchMedia();
    let savedTime = 0;
    const context = gsap.context(() => {
      media.add({ reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, match => {
        const reduced = Boolean(match.conditions?.reduced);
        let lastTick = -1;
        const tl = gsap.timeline({ paused: true, repeat: -1, onUpdate: () => {
          const tick = Math.floor(tl.totalTime() * 10);
          if (tick !== lastTick) {
            lastTick = tick;
            onTimeRef.current?.(tl.totalTime());
          }
        } });
        timeline.current = tl;
        const clock = { value: 0 };
        const total = pattern.phases.reduce((sum, phase) => sum + (phase.seconds ?? VARIABLE_HOLD_SECONDS), 0);
        tl.to(clock, { value: 1, duration: total, ease: 'none' }, 0);
        if (!reduced) {
          const select = gsap.utils.selector(root);
          const volume = select('.breath-volume');
          const echo = select('.breath-echo');
          const topup = select('.breath-topup');
          const cursor = select('.breath-cursor');
          const rays = select('.breath-rays');
          const petalsLeft = select('.breath-petals-left');
          const petalsRight = select('.breath-petals-right');
          gsap.set([...volume, ...echo, ...topup, ...rays, ...petalsLeft, ...petalsRight], { svgOrigin: '160 160' });
          gsap.set(volume, { scale: pattern.slug === 'buteyko' ? 0.94 : 0.58 });
          if (echo.length) gsap.set(echo, { scale: 0.7, opacity: 0.35 });
          if (topup.length) gsap.set(topup, { scale: 0.82, opacity: 0 });
          if (cursor.length) gsap.set(cursor, { x: -100, y: 100 });
          if (rays.length) gsap.set(rays, { scale: 0.72, opacity: 0.35 });
          const corners = [[-100, -100], [100, -100], [100, 100], [-100, 100]];
          let at = 0;
          let level = 0;
          for (const [index, phase] of pattern.phases.entries()) {
            const duration = phase.seconds ?? VARIABLE_HOLD_SECONDS;
            if (phase.type === 'inhale') level = pattern.slug === 'sigh' && index === 0 ? 0.7 : 1;
            if (phase.type === 'exhale') level = 0;
            const scale = pattern.slug === 'buteyko' ? 0.94 + level * 0.1 : 0.58 + level * 0.42;
            tl.to(volume, { scale, duration, ease: 'sine.inOut' }, at);
            if (echo.length) tl.to(echo, { scale: 0.7 + level * 0.3, opacity: 0.35 + level * 0.4, duration, ease: 'sine.inOut' }, at);
            if (cursor.length) tl.to(cursor, { x: corners[index % 4][0], y: corners[index % 4][1], duration, ease: 'none' }, at);
            if (topup.length) tl.to(topup, { scale: index === 1 ? 1 : 0.82, opacity: index === 1 ? 0.9 : 0, duration, ease: 'sine.inOut' }, at);
            if (petalsLeft.length) tl.to(petalsLeft, { rotation: -6 * level, opacity: 0.55 + 0.3 * level, duration, ease: 'sine.inOut' }, at);
            if (petalsRight.length) tl.to(petalsRight, { rotation: 6 * level, opacity: 0.55 + 0.3 * level, duration, ease: 'sine.inOut' }, at);
            if (rays.length) tl.to(rays, { scale: 0.72 + level * 0.28, opacity: 0.35 + level * 0.55, duration, ease: 'sine.inOut' }, at);
            at += duration;
          }
        }
        tl.totalTime(savedTime, true);
        tl.paused(!playingRef.current || document.hidden);
        return () => { savedTime = tl.totalTime(); tl.kill(); };
      });
    }, root);
    return () => { media.revert(); context.revert(); timeline.current = null; };
  }, [pattern, miniature]);

  useEffect(() => {
    const sync = () => timeline.current?.paused(!playing || document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [playing]);

  return (
    <svg ref={root} className={`breath-art${miniature ? ' breath-art-mini' : ''}`} viewBox="0 0 320 320" fill="none" aria-hidden="true" focusable="false" data-visual={pattern.slug}>
      <Geometry slug={pattern.slug} />
    </svg>
  );
}

function Geometry({ slug }: { slug: PatternSlug }) {
  switch (slug) {
    case 'coherent':
      return <>
        <circle cx="160" cy="160" r="132" stroke="currentColor" opacity="0.13" />
        <g className="breath-echo"><circle cx="160" cy="160" r="121" stroke="currentColor" strokeWidth="1.5" /><circle cx="160" cy="160" r="103" stroke="currentColor" opacity="0.5" /></g>
        <g className="breath-volume"><circle cx="160" cy="160" r="87" fill="currentColor" opacity="0.1" /><circle cx="160" cy="160" r="71" fill="currentColor" opacity="0.16" /><circle cx="160" cy="160" r="54" fill="currentColor" opacity="0.7" /><circle cx="142" cy="141" r="8" fill="var(--surface)" opacity="0.25" /></g>
      </>;
    case 'box':
      return <>
        <rect x="60" y="60" width="200" height="200" rx="1" stroke="currentColor" opacity="0.4" />
        <rect x="76" y="76" width="168" height="168" rx="1" stroke="currentColor" opacity="0.1" />
        <g className="breath-volume"><rect x="93" y="93" width="134" height="134" rx="24" fill="currentColor" opacity="0.12" /><rect x="118" y="118" width="84" height="84" rx="14" fill="currentColor" opacity="0.6" /></g>
        {[[60,60],[260,60],[260,260],[60,260]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="currentColor" opacity="0.5" />)}
        <g className="breath-cursor"><circle cx="160" cy="160" r="13" fill="var(--pattern-bg)" /><circle cx="160" cy="160" r="6" fill="currentColor" /><circle cx="160" cy="160" r="10" stroke="currentColor" opacity="0.45" /></g>
      </>;
    case '478':
      return <>
        <path d="M 246 75 A 121 121 0 1 0 246 245" stroke="currentColor" opacity="0.16" />
        <g className="breath-volume">
          <path d="M 193 55 A 110 110 0 1 0 250 224 A 115 115 0 0 1 193 55Z" fill="currentColor" opacity="0.22" />
          <path d="M 187 77 A 87 87 0 1 0 228 213 A 94 94 0 0 1 187 77Z" fill="currentColor" opacity="0.65" />
          <circle cx="228" cy="105" r="5" fill="currentColor" />
          <circle cx="251" cy="139" r="2.5" fill="currentColor" opacity="0.5" />
        </g>
      </>;
    case 'sigh':
      return <>
        <path d="M60 254H260" stroke="currentColor" opacity="0.16" strokeLinecap="round" />
        <path d="M44 232C44 129 88 60 160 60S276 129 276 232" stroke="currentColor" opacity="0.12" />
        <g className="breath-volume" stroke="currentColor" strokeLinecap="round">
          <path d="M72 230C72 144 106 90 160 90S248 144 248 230" strokeWidth="23" opacity="0.12" />
          <path d="M86 230C86 152 116 108 160 108S234 152 234 230" strokeWidth="10" opacity="0.45" />
          <path d="M112 230C112 170 132 139 160 139S208 170 208 230" strokeWidth="5" opacity="0.85" />
        </g>
        <g className="breath-topup" stroke="currentColor" strokeLinecap="round">
          <path d="M113 62Q160 17 207 62" strokeWidth="12" opacity="0.14" />
          <path d="M113 62Q160 17 207 62" strokeWidth="3" />
        </g>
      </>;
    case 'wimhof':
      return <>
        <circle cx="160" cy="160" r="132" stroke="currentColor" opacity="0.13" />
        <g className="breath-rays">{Array.from({length: 16}, (_, i) => <path key={i} d="M160 31V58" stroke="currentColor" strokeWidth={i % 2 ? 1 : 2} strokeLinecap="round" transform={`rotate(${i * 22.5} 160 160)`} />)}</g>
        <g className="breath-volume"><circle cx="160" cy="160" r="84" fill="currentColor" opacity="0.1" /><circle cx="160" cy="160" r="65" stroke="currentColor" opacity="0.5" /><circle cx="160" cy="160" r="47" fill="currentColor" opacity="0.75" /></g>
      </>;
    case 'buteyko':
      return <>
        <circle cx="160" cy="160" r="126" stroke="currentColor" opacity="0.1" />
        <g className="breath-volume">
          <g className="breath-petals-left">
            <path d="M151 151C81 151 49 101 64 64C101 49 151 81 151 151Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.6" />
            <path d="M169 169C239 169 271 219 256 256C219 271 169 239 169 169Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeOpacity="0.6" />
          </g>
          <g className="breath-petals-right">
            <path d="M169 151C169 81 219 49 256 64C271 101 239 151 169 151Z" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeOpacity="0.6" />
            <path d="M151 169C151 239 101 271 64 256C49 219 81 169 151 169Z" fill="currentColor" fillOpacity="0.32" stroke="currentColor" strokeOpacity="0.6" />
          </g>
          <circle cx="160" cy="160" r="8" fill="currentColor" opacity="0.8" />
        </g>
      </>;
  }
}
