import { getPrisma } from "@fluxcore/database";
import type { Suggestion, SuggestionStatus } from "./types.js";
import { SUGGESTIONS_PAGE_SIZE } from "./constants.js";

export async function createSuggestion(
  guildId: string,
  userId: string,
  content: string,
): Promise<Suggestion> {
  const prisma = getPrisma();
  const row = await prisma.suggestion.create({
    data: { guildId, userId, content },
  });
  return row as Suggestion;
}

export async function getSuggestion(id: number, guildId: string): Promise<Suggestion | null> {
  const prisma = getPrisma();
  const row = await prisma.suggestion.findFirst({
    where: { id, guildId },
  });
  return row as Suggestion | null;
}

export async function updateSuggestionStatus(
  id: number,
  guildId: string,
  status: SuggestionStatus,
  statusBy: string,
  statusReason?: string,
): Promise<Suggestion | null> {
  const prisma = getPrisma();

  const existing = await prisma.suggestion.findFirst({
    where: { id, guildId },
  });
  if (!existing) return null;

  const row = await prisma.suggestion.update({
    where: { id },
    data: {
      status,
      statusBy,
      statusReason: statusReason ?? null,
    },
  });
  return row as Suggestion;
}

export async function updateSuggestionMessageId(
  id: number,
  messageId: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.suggestion.update({
    where: { id },
    data: { messageId },
  });
}

export async function updateSuggestionVotes(
  id: number,
  upvotes: number,
  downvotes: number,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.suggestion.update({
    where: { id },
    data: { upvotes, downvotes },
  });
}

export async function getSuggestions(
  guildId: string,
  options: {
    status?: SuggestionStatus;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ suggestions: Suggestion[]; total: number }> {
  const prisma = getPrisma();
  const page = options.page ?? 1;
  const limit = options.limit ?? SUGGESTIONS_PAGE_SIZE;

  const where: { guildId: string; status?: string } = { guildId };
  if (options.status) {
    where.status = options.status;
  }

  const [suggestions, total] = await Promise.all([
    prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.suggestion.count({ where }),
  ]);

  return { suggestions: suggestions as Suggestion[], total };
}

export async function deleteSuggestion(id: number, guildId: string): Promise<boolean> {
  const prisma = getPrisma();
  const result = await prisma.suggestion.deleteMany({
    where: { id, guildId },
  });
  return result.count > 0;
}
