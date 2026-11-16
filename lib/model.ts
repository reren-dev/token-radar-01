export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface FarmPlan {
  steps: string[];
  cost_usd: number;
  time_days: number;
  strategy: string;
}

export interface BoardRow {
  slug: string;
  name: string;
  category: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  is_watchlist: boolean;
  status: 'Pre-Token' | 'Live Token' | 'Ineligible';
  eligible: boolean;
  reason: string | null;
  implied_value_usd: number;
  implied_multiple: number;
  score: number;
  farm_plan: FarmPlan;
}

export interface RadarSummary {
  as_of: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_size: number;
  early_size: number;
  live_size: number;
  total_tvl_usd: number;
  total_implied_value_usd: number;
  rows: BoardRow[];
}

export function parseSnapshot(text: string): Snapshot {
  const data = JSON.parse(text);
  return {
    as_of: data.as_of || '2026-11-14',
    source: data.source || '',
    floor_usd: data.floor_usd || 50000000,
    protocols: data.protocols || [],
    watchlist: data.watchlist || []
  };
}

function getCategoryWeight(category: string | null): number {
  if (!category) return 0.20;
  const c = category.toLowerCase();
  if (c.includes('risk curator')) return 0.28;
  if (c.includes('lending') || c.includes('cdp')) return 0.32;
  if (c.includes('dex') || c.includes('derivatives')) return 0.35;
  if (c.includes('restak') || c.includes('collateral')) return 0.30;
  if (c.includes('rwa') || c.includes('real world')) return 0.22;
  if (c.includes('yield') || c.includes('cedefi')) return 0.25;
  if (c.includes('chain') || c.includes('payment')) return 0.30;
  return 0.25;
}

function calculateAgeDays(listedAt: string | null, asOf: string): number {
  if (!listedAt) return 180;
  const listed = new Date(listedAt).getTime();
  const current = new Date(asOf).getTime();
  const diff = current - listed;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return isNaN(days) || days < 1 ? 30 : days;
}

function generateFarmPlan(p: Protocol, ageDays: number): FarmPlan {
  const chainName = p.chains && p.chains.length > 0 ? p.chains[0] : 'Ethereum';
  const cat = p.category || 'DeFi';
  let steps: string[] = [];
  let strategy = '';
  let cost = 25;
  let time = 30;

  if (cat.toLowerCase().includes('risk curator')) {
    strategy = 'Yield Curation & Vault Deposit';
    steps = [
      `Bridge assets to ${chainName} and acquire benchmark stablecoins/ETH.`,
      `Deposit liquidity into ${p.name} risk-curated strategy vaults.`,
      `Stake receipt tokens in governance incentive modules to accrue epoch points.`
    ];
    cost = 40;
    time = 45;
  } else if (cat.toLowerCase().includes('lending') || cat.toLowerCase().includes('cdp')) {
    strategy = 'Collateral Supply & Borrowing Depth';
    steps = [
      `Supply blue-chip assets (ETH/USDC) to ${p.name} liquidity pools on ${chainName}.`,
      `Maintain a conservative health factor (> 2.0) while borrowing secondary assets.`,
      `Participate in weekly liquidity mining epochs and governance voting.`
    ];
    cost = 60;
    time = 60;
  } else if (cat.toLowerCase().includes('rwa')) {
    strategy = 'RWA Yield Seeding & KYC/Compliance Vaults';
    steps = [
      `Complete required verification on ${chainName} gateway for ${p.name}.`,
      `Allocate capital into short-duration tokenized yield tranches.`,
      `Hold positions across quarterly rollover windows to qualify for native token allocation.`
    ];
    cost = 80;
    time = 90;
  } else {
    strategy = 'Core Liquidity Provision & Epoch Farming';
    steps = [
      `Establish active liquidity position on ${chainName} via ${p.name}.`,
      `Interact with protocol auxiliary features and testnet/mainnet modules.`,
      `Compound rewards bi-weekly and track loyalty multipliers.`
    ];
    cost = 30;
    time = 30;
  }

  return {
    steps,
    cost_usd: cost,
    time_days: time,
    strategy
  };
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarSummary } {
  const asOf = snapshot.as_of;
  const watchlistSet = new Set(snapshot.watchlist);
  const floorUsd = snapshot.floor_usd;

  const rows: BoardRow[] = snapshot.protocols.map((p) => {
    const isWatchlist = watchlistSet.has(p.slug);
    const hasToken = p.gecko_id !== null || p.symbol !== null || (p.mcap_usd !== null && p.mcap_usd > 0);
    
    let eligible = false;
    let status: 'Pre-Token' | 'Live Token' | 'Ineligible' = 'Ineligible';
    let reason: string | null = null;

    if (hasToken) {
      eligible = true;
      status = 'Live Token';
    } else if (isWatchlist) {
      eligible = true;
      status = 'Pre-Token';
    } else {
      eligible = false;
      status = 'Ineligible';
      if (p.tvl_usd < floorUsd) {
        reason = `Below TVL floor ($${Math.round(floorUsd / 1e6)}M)`;
      } else {
        const cat = (p.category || '').toLowerCase();
        if (cat.includes('bridge') || cat.includes('cex') || cat.includes('staking') || cat.includes('restak')) {
          reason = `Excluded category (${p.category})`;
        } else if (/\s(v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) {
          reason = 'Versioned protocol variant';
        } else if (/\b(wrapped|staked|staking)\b/i.test(p.name) || /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)/i.test(p.name)) {
          reason = 'Wrapped, staked, or exchange-linked product';
        } else {
          reason = 'Fails watchlist eligibility rules';
        }
      }
    }

    const ageDays = calculateAgeDays(p.listed_at, asOf);
    const weight = getCategoryWeight(p.category);
    const change = p.change_7d ?? 0;
    const growthFactor = 1 + Math.max(-0.6, Math.min(3.0, change / 100));
    const ageFactor = Math.max(1.0, Math.min(3.0, 1.0 + Math.log10(Math.max(1, ageDays)) * 0.35));

    let impliedValue = 0;
    if (status === 'Live Token') {
      impliedValue = p.mcap_usd || Math.round(p.tvl_usd * 0.8);
    } else {
      impliedValue = Math.round(p.tvl_usd * weight * growthFactor * ageFactor);
      if (isWatchlist) {
        impliedValue = Math.max(impliedValue, Math.round(p.tvl_usd * 0.35));
      }
    }

    const impliedMultiple = p.tvl_usd > 0 ? Number((impliedValue / p.tvl_usd).toFixed(2)) : 0.5;
    const score = impliedValue * (isWatchlist ? 1.5 : 1.0) * (1 + Math.max(0, change / 200));
    const farm_plan = generateFarmPlan(p, ageDays);

    return {
      slug: p.slug,
      name: p.name,
      category: p.category || 'Uncategorized',
      chains: p.chains || [],
      tvl_usd: p.tvl_usd,
      change_7d: change,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      is_watchlist: isWatchlist,
      status,
      eligible,
      reason,
      implied_value_usd: impliedValue,
      implied_multiple: impliedMultiple,
      score: Math.round(score),
      farm_plan
    };
  });

  // Board contains ONLY eligible rows (watchlist pre-token + live token)
  const board = rows.filter(r => r.eligible);
  board.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'Pre-Token' ? -1 : 1;
    }
    return b.score - a.score;
  });

  const early_size = snapshot.watchlist.length;
  const live_size = rows.filter(r => r.status === 'Live Token').length;
  const total_tvl_usd = rows.reduce((acc, r) => acc + r.tvl_usd, 0);
  const total_implied_value_usd = rows.reduce((acc, r) => acc + r.implied_value_usd, 0);

  const radar: RadarSummary = {
    as_of: asOf,
    floor_usd: snapshot.floor_usd,
    total_protocols: rows.length,
    watchlist_size: snapshot.watchlist.length,
    early_size,
    live_size,
    total_tvl_usd,
    total_implied_value_usd,
    rows
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (!board || board.length === 0) {
    return 'Board is empty';
  }
  const boardSlugs = new Set(board.map(r => r.slug));
  const missing = snapshot.watchlist.filter(slug => !boardSlugs.has(slug));
  if (missing.length > 0) {
    return `Board is missing watchlist protocols: ${missing.join(', ')}`;
  }
  return null;
}

export function dataScript(radar: { board: BoardRow[]; radar: RadarSummary }): string {
  return `window.RADAR_DATA = ${JSON.stringify(radar, null, 2)};\n`;
}
