export type PhaseType = "inhale" | "hold" | "exhale";

export type BreathPhase = {
  label: string;
  seconds: number | null;
  type: PhaseType;
  variable?: boolean;
};

export type PatternSlug = "coherent" | "box" | "478" | "sigh" | "wimhof" | "buteyko";

export type BreathPattern = {
  slug: PatternSlug;
  name: string;
  description: string;
  category: "calm" | "sleep" | "focus" | "energy";
  colorHue: "blue" | "teal" | "indigo" | "coral" | "amber" | "sage";
  phases: BreathPhase[];
  caution?: string;
};

const wimHofCycles = Array.from({ length: 30 }, () => [
  { label: "Inhale", seconds: 1.5, type: "inhale" as const },
  { label: "Exhale", seconds: 1.5, type: "exhale" as const },
]).flat();

export const patterns: BreathPattern[] = [
  {
    slug: "coherent",
    name: "Coherent Breathing",
    description: "Smooth, even breaths for lasting calm",
    category: "calm",
    colorHue: "blue",
    phases: [
      { label: "Inhale", seconds: 5.5, type: "inhale" },
      { label: "Exhale", seconds: 5.5, type: "exhale" },
    ],
  },
  {
    slug: "box",
    name: "Box Breathing",
    description: "Steady counting to sharpen focus",
    category: "focus",
    colorHue: "teal",
    phases: [
      { label: "Inhale", seconds: 4, type: "inhale" },
      { label: "Hold", seconds: 4, type: "hold" },
      { label: "Exhale", seconds: 4, type: "exhale" },
      { label: "Hold", seconds: 4, type: "hold" },
    ],
  },
  {
    slug: "478",
    name: "4-7-8 Breathing",
    description: "A long exhale to help you drift off",
    category: "sleep",
    colorHue: "indigo",
    phases: [
      { label: "Inhale", seconds: 4, type: "inhale" },
      { label: "Hold", seconds: 7, type: "hold" },
      { label: "Exhale", seconds: 8, type: "exhale" },
    ],
  },
  {
    slug: "sigh",
    name: "Physiological Sigh",
    description: "One quick reset for a sudden wave of stress",
    category: "calm",
    colorHue: "coral",
    phases: [
      { label: "Inhale", seconds: 2, type: "inhale" },
      { label: "Inhale (top-up)", seconds: 1, type: "inhale" },
      { label: "Exhale", seconds: 6, type: "exhale" },
    ],
  },
  {
    slug: "wimhof",
    name: "Wim Hof Style",
    description: "Energizing breath work to wake you up",
    category: "energy",
    colorHue: "amber",
    phases: [
      ...wimHofCycles,
      { label: "Hold", seconds: null, type: "hold", variable: true },
      { label: "Recovery Inhale", seconds: 2, type: "inhale" },
    ],
    caution:
      "Not for use while driving, in water, or by those pregnant, epileptic, or with cardiovascular conditions.",
  },
  {
    slug: "buteyko",
    name: "Buteyko-Style",
    description: "Gentle, reduced breathing to retrain your calm",
    category: "calm",
    colorHue: "sage",
    phases: [
      { label: "Inhale", seconds: 3, type: "inhale" },
      { label: "Exhale", seconds: 4, type: "exhale" },
      { label: "Hold", seconds: 5, type: "hold" },
    ],
  },
];

export function getPattern(slug: string) {
  return patterns.find((pattern) => pattern.slug === slug) ?? patterns[0];
}

export function fixedPatternDuration(pattern: BreathPattern) {
  return pattern.phases.reduce((total, phase) => total + (phase.seconds ?? 0), 0);
}
