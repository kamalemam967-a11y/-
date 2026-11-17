import {
  LoyaltyTier,
  UserLoyaltyProfile,
} from '../types/pharmacy';

export const POINTS_STEP = 10;
export const MIN_REDEEM_POINTS = 20;
export const EGP_PER_POINT = 0.5; // 10 points = 5 EGP discount
export const EGP_SPENT_PER_POINT = 100; // 1 point earned per 100 EGP spent

export interface TierSummary {
  tier: LoyaltyTier;
  multiplier: number;
  nextTier: LoyaltyTier | null;
  nextTierThreshold: number | null;
  pointsToNextTier: number;
  progressPercent: number;
}

export function calculateLoyaltyTier(lifetimeEarned: number): TierSummary {
  if (lifetimeEarned >= 1500) {
    return {
      tier: 'platinum',
      multiplier: 1.5,
      nextTier: null,
      nextTierThreshold: null,
      pointsToNextTier: 0,
      progressPercent: 100,
    };
  }
  if (lifetimeEarned >= 500) {
    const progress = ((lifetimeEarned - 500) / (1500 - 500)) * 100;
    return {
      tier: 'gold',
      multiplier: 1.25,
      nextTier: 'platinum',
      nextTierThreshold: 1500,
      pointsToNextTier: Math.max(0, 1500 - lifetimeEarned),
      progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
    };
  }
  const progress = (lifetimeEarned / 500) * 100;
  return {
    tier: 'silver',
    multiplier: 1,
    nextTier: 'gold',
    nextTierThreshold: 500,
    pointsToNextTier: Math.max(0, 500 - lifetimeEarned),
    progressPercent: Math.min(100, Math.max(0, Math.round(progress))),
  };
}

export function pointsToEgpDiscount(points: number): number {
  return Math.floor(Math.max(0, points) * EGP_PER_POINT);
}

export function getMaxRedeemablePoints(
  availablePoints: number,
  eligibleOrderSubtotalEgp: number
): number {
  if (availablePoints < MIN_REDEEM_POINTS || eligibleOrderSubtotalEgp < 10) {
    return 0;
  }
  const maxPointsByOrder = Math.floor(eligibleOrderSubtotalEgp / EGP_PER_POINT);
  const capped = Math.min(availablePoints, maxPointsByOrder);
  const roundedDown = Math.floor(capped / POINTS_STEP) * POINTS_STEP;
  return roundedDown >= MIN_REDEEM_POINTS ? roundedDown : 0;
}

export function previewEarnedPoints(
  amountPaidEgp: number,
  lifetimeEarned: number
): number {
  if (amountPaidEgp < EGP_SPENT_PER_POINT) return 0;
  const { multiplier } = calculateLoyaltyTier(lifetimeEarned);
  return Math.max(1, Math.floor((amountPaidEgp / EGP_SPENT_PER_POINT) * multiplier));
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'default-visitor';
  try {
    let id = localStorage.getItem('mar_pharmacy_visitor_id');
    if (!id) {
      id = `v-${crypto.randomUUID()}`;
      localStorage.setItem('mar_pharmacy_visitor_id', id);
    }
    return id;
  } catch {
    return 'default-visitor';
  }
}

export async function fetchLoyaltyProfile(): Promise<UserLoyaltyProfile> {
  const res = await fetch('/api/loyalty', {
    headers: { 'X-Visitor-Id': getVisitorId() },
  });
  if (!res.ok) {
    throw new Error('Failed to load loyalty profile');
  }
  return (await res.json()) as UserLoyaltyProfile;
}

export async function updateLoyaltyProfile(payload: {
  fullName: string;
  phone: string;
  address: string;
}): Promise<UserLoyaltyProfile> {
  const res = await fetch('/api/loyalty/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': getVisitorId(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data as UserLoyaltyProfile;
}

export async function recordLoyaltyOrder(payload: {
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  subtotalPaidAfterDiscounts: number;
  redeemPoints: number;
}): Promise<{
  profile: UserLoyaltyProfile;
  pointsRedeemed: number;
  pointsDiscount: number;
  pointsEarned: number;
}> {
  const res = await fetch('/api/loyalty/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': getVisitorId(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to record loyalty order');
  }
  return data as {
    profile: UserLoyaltyProfile;
    pointsRedeemed: number;
    pointsDiscount: number;
    pointsEarned: number;
  };
}
