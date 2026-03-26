import {
  BILLING_PLAN_TIER,
  type BillingPlanKey,
} from "../billing/config";

export interface Mt5ClaimSchedulingCandidate<TConnection = unknown> {
  connectionId: string;
  userId: string;
  planKey: BillingPlanKey;
  concurrentSlotCap: number;
  currentActiveSlots: number;
  queueTier: number;
  dueAt: string | Date | null;
  lastRequestedAt: string | null;
  updatedAt: string | Date;
  connection: TConnection;
}

function toTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareCandidates(
  left: Mt5ClaimSchedulingCandidate,
  right: Mt5ClaimSchedulingCandidate
) {
  const queueTierDelta = right.queueTier - left.queueTier;
  if (queueTierDelta !== 0) {
    return queueTierDelta;
  }

  const rightHasLiveRequest = Boolean(right.lastRequestedAt);
  const leftHasLiveRequest = Boolean(left.lastRequestedAt);
  if (rightHasLiveRequest !== leftHasLiveRequest) {
    return rightHasLiveRequest ? 1 : -1;
  }

  const tierDelta = BILLING_PLAN_TIER[right.planKey] - BILLING_PLAN_TIER[left.planKey];
  if (tierDelta !== 0) {
    return tierDelta;
  }

  const activeSlotDelta = left.currentActiveSlots - right.currentActiveSlots;
  if (activeSlotDelta !== 0) {
    return activeSlotDelta;
  }

  const dueDelta = toTimestamp(left.dueAt) - toTimestamp(right.dueAt);
  if (dueDelta !== 0) {
    return dueDelta;
  }

  const requestedDelta =
    toTimestamp(right.lastRequestedAt) - toTimestamp(left.lastRequestedAt);
  if (requestedDelta !== 0) {
    return requestedDelta;
  }

  const updatedDelta = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return left.connectionId.localeCompare(right.connectionId);
}

export function selectMt5Claims<TConnection>(
  candidates: Mt5ClaimSchedulingCandidate<TConnection>[],
  limit: number
) {
  if (limit <= 0 || candidates.length === 0) {
    return [] as Mt5ClaimSchedulingCandidate<TConnection>[];
  }

  const selected: Mt5ClaimSchedulingCandidate<TConnection>[] = [];
  const selectedIds = new Set<string>();
  const grantedSlotsByUser = new Map<string, number>();

  for (let pass = 0; selected.length < limit; pass += 1) {
    const passCandidates = candidates
      .filter((candidate) => !selectedIds.has(candidate.connectionId))
      .filter((candidate) => {
        const grantedSlots = grantedSlotsByUser.get(candidate.userId) ?? 0;
        return candidate.currentActiveSlots + grantedSlots < candidate.concurrentSlotCap;
      })
      .sort(compareCandidates);

    if (passCandidates.length === 0) {
      break;
    }

    let claimedInPass = false;
    for (const candidate of passCandidates) {
      if (selected.length >= limit) {
        break;
      }

      const grantedSlots = grantedSlotsByUser.get(candidate.userId) ?? 0;
      if (grantedSlots !== pass) {
        continue;
      }

      if (candidate.currentActiveSlots + grantedSlots >= candidate.concurrentSlotCap) {
        continue;
      }

      selected.push(candidate);
      selectedIds.add(candidate.connectionId);
      grantedSlotsByUser.set(
        candidate.userId,
        grantedSlots + 1
      );
      claimedInPass = true;
    }

    if (!claimedInPass) {
      break;
    }
  }

  return selected;
}
