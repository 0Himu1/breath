import type { BreathPattern } from './patterns';

export const VARIABLE_HOLD_SECONDS = 30;

/** Read the same phase boundaries used by the animation timeline. */
export function breathMoment(pattern: BreathPattern, elapsed: number) {
  const duration = pattern.phases.reduce(
    (sum, phase) => sum + (phase.seconds ?? VARIABLE_HOLD_SECONDS), 0,
  );
  let position = Math.max(0, elapsed) % duration;
  for (let index = 0; index < pattern.phases.length; index++) {
    const seconds = pattern.phases[index].seconds ?? VARIABLE_HOLD_SECONDS;
    if (position < seconds) {
      return { index, elapsed: position, seconds, round: Math.floor(elapsed / duration) };
    }
    position -= seconds;
  }
  return { index: 0, elapsed: 0, seconds: pattern.phases[0].seconds ?? VARIABLE_HOLD_SECONDS, round: 0 };
}
