'use client';

import gsap from 'gsap';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type SessionStage = 'starting' | 'running' | 'paused' | 'resuming' | 'stopping' | 'completing';
type Transition = 'enter' | 'pause' | 'resume' | 'stop' | 'complete';

/** Playback stays frozen while lifecycle motion is in progress. */
export function useSessionMotion() {
  const root = useRef<HTMLElement>(null);
  const context = useRef<gsap.Context | null>(null);
  const current = useRef<gsap.core.Timeline | null>(null);
  const [stage, setStage] = useState<SessionStage>('starting');
  const stageRef = useRef<SessionStage>('starting');

  const setCurrentStage = useCallback((next: SessionStage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  const animate = useCallback((kind: Transition, onComplete?: () => void) => {
    current.current?.kill();
    context.current?.add(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tl = gsap.timeline({ onComplete });
      current.current = tl;
      if (kind === 'enter') {
        tl.fromTo('.session-art', { scale: reduced ? 1 : 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: reduced ? 0.15 : 0.55, ease: 'power3.out' })
          .fromTo('.session-instruction, .breath-countdown, .session-center > .phase-rail, .session-guide', { y: reduced ? 0 : 6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, stagger: reduced ? 0 : 0.035, ease: 'power2.out' }, reduced ? 0 : 0.14)
          .fromTo('.session-footer', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
      } else if (kind === 'pause' || kind === 'resume') {
        const paused = kind === 'pause';
        tl.to('.session-art', { scale: reduced ? 1 : paused ? 0.96 : 1, opacity: paused ? 0.55 : 1, duration: reduced ? 0.12 : 0.28, ease: 'power2.out' })
          .to('.breath-countdown, .session-center > .phase-rail', { opacity: paused ? 0.8 : 1, duration: 0.18 }, 0)
          .fromTo('.session-control-icon', { scale: reduced ? 1 : 0.8, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.18, ease: 'power2.out' }, 0);
      } else {
        if (kind === 'complete') {
          tl.fromTo('.session-completion-ring', { scale: 0.92, opacity: 0 }, { scale: reduced ? 1 : 1.08, opacity: 0.5, duration: 0.22, ease: 'power2.out' })
            .to('.session-completion-ring', { scale: reduced ? 1 : 1.3, opacity: 0, duration: reduced ? 0.12 : 0.35, ease: 'power2.out' });
        }
        const at = kind === 'complete' ? (reduced ? 0.15 : 0.3) : 0;
        tl.to('.session-art', { scale: reduced ? 1 : 0.86, opacity: 0, duration: reduced ? 0.15 : 0.34, ease: 'power2.inOut' }, at)
          .to('.breath-countdown, .session-center > .phase-rail, .session-guide, .session-footer', { opacity: 0, duration: 0.18 }, at)
          .to('.session-instruction', { opacity: 0, y: reduced ? 0 : -5, duration: 0.18 }, at + 0.15);
      }
    });
  }, []);

  useLayoutEffect(() => {
    const scoped = gsap.context(() => {}, root);
    context.current = scoped;
    animate('enter', () => {
      setCurrentStage('running');
      root.current?.querySelector<HTMLHeadingElement>('h1')?.focus({ preventScroll: true });
    });
    return () => { current.current?.kill(); scoped.revert(); context.current = null; };
  }, [animate, setCurrentStage]);

  const togglePause = useCallback(() => {
    if (stageRef.current === 'running') {
      setCurrentStage('paused');
      animate('pause');
    } else if (stageRef.current === 'paused') {
      setCurrentStage('resuming');
      animate('resume', () => setCurrentStage('running'));
    }
  }, [animate, setCurrentStage]);

  const finish = useCallback((completed: boolean, onComplete: () => void) => {
    if (stageRef.current === 'stopping' || stageRef.current === 'completing') return;
    setCurrentStage(completed ? 'completing' : 'stopping');
    animate(completed ? 'complete' : 'stop', onComplete);
  }, [animate, setCurrentStage]);

  const recover = useCallback(() => {
    setCurrentStage('resuming');
    animate('enter', () => { setCurrentStage('paused'); animate('pause'); });
  }, [animate, setCurrentStage]);

  return { root, stage, togglePause, finish, recover };
}
