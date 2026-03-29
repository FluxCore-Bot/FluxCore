import type { Giveaway } from "@fluxcore/types";

/**
 * Select random winners from a giveaway's entrants.
 * Returns an array of user IDs.
 */
export function selectWinners(giveaway: Giveaway, count?: number): string[] {
  const numWinners = count ?? giveaway.winners;
  const entrants = [...giveaway.entrantIds];

  if (entrants.length === 0) return [];

  const winners: string[] = [];
  const maxWinners = Math.min(numWinners, entrants.length);

  for (let i = 0; i < maxWinners; i++) {
    const index = Math.floor(Math.random() * entrants.length);
    winners.push(entrants[index]);
    entrants.splice(index, 1);
  }

  return winners;
}

/**
 * Reroll winners, excluding previous winners from the pool.
 */
export function rerollWinners(
  giveaway: Giveaway,
  count?: number,
  excludeIds?: string[],
): string[] {
  const excludeSet = new Set(excludeIds ?? giveaway.winnerIds);
  const eligibleEntrants = giveaway.entrantIds.filter((id) => !excludeSet.has(id));

  const numWinners = count ?? giveaway.winners;
  const maxWinners = Math.min(numWinners, eligibleEntrants.length);

  if (eligibleEntrants.length === 0) return [];

  const pool = [...eligibleEntrants];
  const winners: string[] = [];

  for (let i = 0; i < maxWinners; i++) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool[index]);
    pool.splice(index, 1);
  }

  return winners;
}
