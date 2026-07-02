// Utilities to unify and dedupe usage history across sources
// Note: Keep this focused and framework-agnostic

export type UsageSource = 'usage_logs' | 'plans';

export interface UnifiedUsageItem {
  id: string;
  source: UsageSource;
  plan_type: string;
  amount: number;
  date: string;       // ISO date string (YYYY-MM-DD)
  created_at: string; // Original created_at from source row
}

export interface RawUsageLog {
  id: string;
  plan_type: string;
  date_selected: string; // date
  amount: number;
  created_at: string;
  user_id?: string;
}

export interface RawPlan {
  id: string;
  user_id: string;
  plan_type: string;
  amount: number;
  start_date: string; // date
  end_date: string;   // date
  is_active: boolean;
  created_at: string;
}

// Normalize to YYYY-MM-DD for robust deduping
function toDateOnly(d: string) {
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return d;
  }
}

// Build a stable dedupe key. Prefer plans over usage_logs when both exist for same day/plan/amount.
function makeKey(plan_type: string, date: string, amount: number) {
  const day = toDateOnly(date);
  const amt = Math.round(Number(amount));
  return `${plan_type}__${day}__${amt}`;
}

export function buildCombinedUsage(usageLogs: RawUsageLog[], plans: RawPlan[]): UnifiedUsageItem[] {
  const map = new Map<string, UnifiedUsageItem & { priority: number }>();

  // Lower priority for usage_logs (0), higher for plans (1) so plans replace duplicates
  for (const log of usageLogs) {
    const item: UnifiedUsageItem = {
      id: log.id,
      source: 'usage_logs',
      plan_type: log.plan_type,
      amount: Number(log.amount),
      date: log.date_selected,
      created_at: log.created_at,
    };
    const key = makeKey(item.plan_type, item.date, item.amount);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, priority: 0 });
    }
  }

  for (const plan of plans) {
    const item: UnifiedUsageItem = {
      id: plan.id,
      source: 'plans',
      plan_type: plan.plan_type,
      amount: Number(plan.amount),
      date: plan.start_date,
      created_at: plan.created_at,
    };
    const key = makeKey(item.plan_type, item.date, item.amount);
    const existing = map.get(key);
    // Replace if not present or lower priority
    if (!existing || (existing as any).priority < 1) {
      map.set(key, { ...item, priority: 1 });
    }
  }

  const list = Array.from(map.values()).map(({ priority, ...rest }) => rest);
  // Sort by date desc, fallback to created_at
  return list.sort((a, b) => {
    const ad = new Date(toDateOnly(a.date)).getTime();
    const bd = new Date(toDateOnly(b.date)).getTime();
    if (bd !== ad) return bd - ad;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
