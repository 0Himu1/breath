import { PrismaClient } from "@prisma/client";

const wimHofCycles = Array.from({ length: 30 }, () => [
  { label: "Inhale", seconds: 1.5, type: "inhale" },
  { label: "Exhale", seconds: 1.5, type: "exhale" },
]).flat();

const patterns = [
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

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

for (const pattern of patterns) {
  await prisma.pattern.upsert({
    where: { slug: pattern.slug },
    create: pattern,
    update: pattern,
  });
}

await prisma.$disconnect();
