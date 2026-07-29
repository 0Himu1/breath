import { NextResponse } from "next/server";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { getDirectPrisma, getPrisma } from "@/lib/prisma";
import { getPattern } from "@/lib/patterns";

type SessionPayload = {
  id: string;
  patternSlug: string;
  startedAt: string;
  durationSec: number;
  completed: boolean;
  moodBefore?: number;
  moodAfter?: number;
};

type PrismaLike = ReturnType<typeof getPrisma>;

export async function POST(request: Request) {
  let body:
    | {
        anonymousUserId?: string;
        session?: SessionPayload;
      }
    | undefined;

  try {
    body = (await request.json()) as {
      anonymousUserId?: string;
      session?: SessionPayload;
    };

    if (!body.anonymousUserId || !body.session?.id || !body.session.patternSlug) {
      return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
    }

    const session = body.session;
    const pattern = getPattern(session.patternSlug);
    await syncSession(getPrisma(), body.anonymousUserId, session);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (shouldRetryWithDirectUrl(error)) {
      try {
        if (body?.anonymousUserId && body.session?.id && body.session.patternSlug) {
          await syncSession(getDirectPrisma(), body.anonymousUserId, body.session);
          console.warn("Session sync used DIRECT_URL fallback after pooled URL failed.");
          return NextResponse.json({ ok: true, fallback: "direct" });
        }
      } catch (fallbackError) {
        console.error("Session sync DIRECT_URL fallback failed", fallbackError);
      }
    }

    console.error("Session sync failed", error);
    return NextResponse.json({ error: "Session sync failed" }, { status: 503 });
  }
}

async function syncSession(
  prisma: PrismaLike,
  anonymousUserId: string,
  session: SessionPayload,
) {
  const pattern = getPattern(session.patternSlug);
    const savedPattern = await prisma.pattern.upsert({
      where: { slug: pattern.slug },
      create: {
        slug: pattern.slug,
        name: pattern.name,
        description: pattern.description,
        category: pattern.category,
        colorHue: pattern.colorHue,
        phases: pattern.phases,
      },
      update: {
        name: pattern.name,
        description: pattern.description,
        category: pattern.category,
        colorHue: pattern.colorHue,
        phases: pattern.phases,
      },
    });

    await prisma.anonymousUser.upsert({
      where: { id: anonymousUserId },
      create: { id: anonymousUserId },
      update: {},
    });

    await prisma.session.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        anonymousUserId,
        patternId: savedPattern.id,
        startedAt: new Date(session.startedAt),
        durationSec: Math.max(0, Math.round(session.durationSec)),
        completed: session.completed,
        moodBefore: session.moodBefore,
        moodAfter: session.moodAfter,
      },
      update: {
        durationSec: Math.max(0, Math.round(session.durationSec)),
        completed: session.completed,
        moodBefore: session.moodBefore,
        moodAfter: session.moodAfter,
      },
    });
}

function shouldRetryWithDirectUrl(error: unknown) {
  return (
    error instanceof PrismaClientInitializationError ||
    (error instanceof Error &&
      (error.message.includes("tenant/user") ||
        error.message.includes("Can't reach database server")))
  );
}
