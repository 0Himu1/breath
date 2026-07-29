import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  directPrisma?: PrismaClient;
};

export function getPrisma() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("[region]")) {
    throw new Error("DATABASE_URL is not configured with a real Supabase pooler host.");
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}

export function getDirectPrisma() {
  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is not configured.");
  }

  if (!globalForPrisma.directPrisma) {
    globalForPrisma.directPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DIRECT_URL,
        },
      },
    });
  }

  return globalForPrisma.directPrisma;
}
