'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { BreathPattern } from '@/lib/patterns';
import type { LocalPreference } from '@/lib/local-db';
import { breathMoment, VARIABLE_HOLD_SECONDS } from '@/lib/breath-motion';
import { BreathVisual, PhaseRail, visualGuides } from './breath-visual';
import { useSessionMotion } from './use-session-motion';

export function SessionScreen({ pattern, preference, onFinish }: {
  pattern: BreathPattern;
  preference: LocalPreference;
  onFinish: (durationSec: number, completed: boolean) => void | Promise<void>;
}) {
  const [elapsed, setElapsed] = useState(0);
  const { root, stage, togglePause, finish, recover } = useSessionMotion();
  const [saveError, setSaveError] = useState('');
  const reducedMotion = useReducedMotion();
  const finished = useRef(false);
  const cycleDuration = pattern.phases.reduce((sum, phase) => sum + (phase.seconds ?? VARIABLE_HOLD_SECONDS), 0);
  const target = pattern.slug === 'wimhof' ? cycleDuration * preference.wimHofRounds : preference.sessionDurationMin * 60;
  const moment = breathMoment(pattern, Math.min(elapsed, target - 0.001));
  const phase = pattern.phases[moment.index];
  const remaining = Math.max(0, Math.ceil(moment.seconds - moment.elapsed));
  const totalRemaining = Math.max(0, Math.ceil(target - elapsed));
  const onTime = useCallback((time: number) => { setElapsed(time); }, []);
  const closing = stage === 'stopping' || stage === 'completing';
  const paused = stage === 'paused';

  const saveAfterMotion = useCallback((completed: boolean, seconds: number) => {
    setSaveError('');
    void Promise.resolve().then(() => onFinish(seconds, completed)).catch(() => {
      finished.current = false;
      setSaveError('Could not save this session. Try ending it again.');
      recover();
    });
  }, [onFinish, recover]);

  useEffect(() => {
    if (stage === 'running' && elapsed >= target && !finished.current) {
      finished.current = true;
      finish(true, () => saveAfterMotion(true, Math.round(target)));
    }
  }, [elapsed, target, finish, saveAfterMotion, stage]);

  useEffect(() => {
    if (stage !== 'running') return;
    if (preference.hapticsEnabled && 'vibrate' in navigator) navigator.vibrate(40);
    if (!preference.soundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = phase.type === 'inhale' ? 440 : phase.type === 'exhale' ? 300 : 360;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.045, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => { if (context.state !== 'closed') void context.close(); };
    return () => { oscillator.onended = null; if (context.state !== 'closed') void context.close(); };
  }, [moment.index, phase.type, preference.hapticsEnabled, preference.soundEnabled, stage]);

  const finishNow = () => {
    if (finished.current) return;
    finished.current = true;
    finish(false, () => saveAfterMotion(false, Math.round(Math.min(elapsed, target))));
  };
  const style = {
    '--pattern-bg': `var(--pattern-${pattern.slug}-bg)`,
    '--pattern-accent': `var(--pattern-${pattern.slug}-accent)`,
  } as CSSProperties;

  const instruction = stage === 'starting' ? 'Settle in' : paused ? 'Paused' : stage === 'resuming' ? 'Resuming' : stage === 'stopping' ? 'Ending session' : stage === 'completing' ? 'Complete' : phase.label;
  const guidance = stage === 'starting' ? 'Your first breath begins in a moment' : paused ? 'Continue whenever you are ready' : stage === 'resuming' ? 'Return to the same breath' : closing ? 'Take a moment. Your progress will be saved.' : phase.type === 'hold' ? 'Rest here. No movement needed.' : reducedMotion ? 'Follow the phase and countdown' : phase.type === 'inhale' ? 'Follow the shape as it opens' : 'Let the shape gently settle';

  return <motion.section ref={root} className="breath-session" data-session-stage={stage} style={style} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <header className="session-header">
      <p>{pattern.name}</p>
      <button className="quiet-icon-button" onClick={finishNow} disabled={closing} aria-label="End session" title="End session"><X size={22} aria-hidden="true" /></button>
    </header>
    <div className="session-center">
      <div className="session-art"><div className="session-completion-ring" aria-hidden="true" /><BreathVisual pattern={pattern} playing={stage === 'running' && elapsed < target} onTime={onTime} /></div>
      <div className="session-instruction" role="status" aria-live="polite" aria-atomic="true">
        <h1 tabIndex={-1}>{instruction}</h1>
        <p>{guidance}</p>
      </div>
      <p className="breath-countdown" aria-hidden="true">{remaining}<span>seconds</span></p>
      <PhaseRail pattern={pattern} activeIndex={moment.index} />
      <p className="session-guide">{visualGuides[pattern.slug]}</p>
      {saveError && <p className="session-save-error" role="alert">{saveError}</p>}
    </div>
    <footer className="session-footer">
      <p>{pattern.slug === 'wimhof' && <>Round {Math.min(moment.round + 1, preference.wimHofRounds)} of {preference.wimHofRounds}<span className="footer-divider" />{moment.index < 60 && <>Breath {Math.floor(moment.index / 2) + 1} of 30<span className="footer-divider" /></>}</>}{Math.floor(totalRemaining / 60)}:{String(totalRemaining % 60).padStart(2, '0')} remaining</p>
      <button className="pause-session" onClick={togglePause} disabled={stage !== 'running' && !paused} aria-label={paused ? 'Resume session' : 'Pause session'}>
        <span className="session-control-icon" aria-hidden="true">{paused || stage === 'resuming' ? <Play size={17} /> : <Pause size={17} />}</span>{stage === 'starting' ? 'Starting' : closing ? 'Ending' : stage === 'resuming' ? 'Resuming' : paused ? 'Resume' : 'Pause'}
      </button>
    </footer>
    <div className="session-progress" role="progressbar" aria-label="Session progress" aria-valuenow={Math.min(100, Math.round(elapsed / target * 100))} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ transform: `scaleX(${Math.min(1, elapsed / target)})` }} />
    </div>
  </motion.section>;
}
