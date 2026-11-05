import type { Tier } from '@prisma/client';

const TIER_RANK: Record<Tier, number> = { CORE: 0, CAMPUS: 1, CLINICAL: 2 };
/** Tiers a reader at `tier` may see. Kept free of the database client so it can be used anywhere. */
export const tiersUpTo = (tier: Tier): Tier[] => (Object.keys(TIER_RANK) as Tier[]).filter(t => TIER_RANK[t] <= TIER_RANK[tier]);
