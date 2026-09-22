import type {
  AccountMode,
  ActivityLogEntry,
  BookScenario,
  BookSummary,
  BotProfile,
  BotProfileInput,
  BotRiskParameters,
  FeeTier,
  FeedSettings,
  RiskCaps,
  SessionSettings,
  Trade,
  UniverseFilters,
  UniverseSnapshot,
} from '@/types'

/** Book screens read this store until the control-plane API exists. */
export const BOOK_USE_MOCK = true

export const RISK_HARD_CAPS = {
  risk_per_trade_pct: 0.25,
  max_open_stop_risk_pct: 0.75,
  soft_throttle_pct: -1,
  stop_new_risk_pct: -1.5,
  hard_daily_lock_pct: -2,
  max_positions: 3,
  single_name_notional_pct: 25,
  min_score: 70,
  min_target_r: 1.5,
  cost_multiple: 3,
} as const

export const UNIVERSE_LIMITS = {
  topNMin: 50,
  topNMax: 100,
  minPrice: 5,
  spreadMin: 10,
  spreadMax: 15,
} as const

export const defaultUniverseFilters: UniverseFilters = {
  top_n: 75,
  min_price: 5,
  max_spread_bps: 12,
}

export const defaultSession: SessionSettings = {
  rth_enabled: true,
  extended_hours: false,
}

export const defaultFeed: FeedSettings = {
  primary: 'sip',
  iex_diagnostic: false,
}

export const defaultRisk: RiskCaps = {
  risk_per_trade_pct: 0.25,
  max_open_stop_risk_pct: 0.75,
  soft_throttle_pct: -1,
  stop_new_risk_pct: -1.5,
  hard_daily_lock_pct: -2,
  max_positions: 3,
  single_name_notional_pct: 25,
  min_score: 70,
  min_target_r: 1.5,
  cost_multiple: 3,
}

export const defaultFeeTier: FeeTier = {
  version: '2026-09-01',
  refreshed_at: '2026-09-01T14:30:00.000Z',
}

const sampleMembers = [
  { symbol: 'AAPL', price: 228.4, dollar_volume: 8_420_000_000, spread_bps: 1.2 },
  { symbol: 'MSFT', price: 428.15, dollar_volume: 6_110_000_000, spread_bps: 1.4 },
  { symbol: 'NVDA', price: 118.62, dollar_volume: 18_900_000_000, spread_bps: 2.1 },
  { symbol: 'AMZN', price: 186.33, dollar_volume: 5_040_000_000, spread_bps: 1.8 },
  { symbol: 'META', price: 582.9, dollar_volume: 4_220_000_000, spread_bps: 2.4 },
  { symbol: 'GOOGL', price: 164.08, dollar_volume: 3_870_000_000, spread_bps: 1.6 },
  { symbol: 'AVGO', price: 172.44, dollar_volume: 3_150_000_000, spread_bps: 3.2 },
  { symbol: 'JPM', price: 214.7, dollar_volume: 1_980_000_000, spread_bps: 1.9 },
]

function snapshotFor(filters: UniverseFilters, members = sampleMembers): UniverseSnapshot {
  return {
    as_of: '2026-09-21T14:35:00.000Z',
    filters: { ...filters },
    members: members.filter(
      (member) => member.price >= filters.min_price && member.spread_bps <= filters.max_spread_bps
    ),
  }
}

const sampleTrades: Trade[] = [
  {
    id: 'trd-1001',
    bot_id: '',
    symbol: 'NVDA',
    type: 'sell',
    quantity: 8,
    price: 119.1,
    timestamp: '2026-09-21T14:12:00.000Z',
    status: 'filled',
    profit_loss: 42.4,
    profit_loss_pct: 0.46,
    reason_code: 'TARGET_HIT',
    shortfall: 0.04,
    regime: 'trend',
    session: 'rth',
  },
  {
    id: 'trd-1002',
    bot_id: '',
    symbol: 'AAPL',
    type: 'buy',
    quantity: 12,
    price: 227.85,
    timestamp: '2026-09-21T13:46:00.000Z',
    status: 'filled',
    reason_code: 'SCORE_72',
    shortfall: 0.02,
    regime: 'trend',
    session: 'rth',
  },
]

const vetoLogs: ActivityLogEntry[] = [
  {
    id: 'log-veto-cost',
    timestamp: '2026-09-21T14:20:00.000Z',
    level: 'info',
    category: 'risk',
    message: 'NVDA skipped. Round-trip cost exceeded 3× the gross target.',
    reason_code: 'NO_TRADE_COST',
    details: { reason_code: 'NO_TRADE_COST', symbol: 'NVDA', score: 74 },
  },
  {
    id: 'log-veto-stale',
    timestamp: '2026-09-21T14:05:00.000Z',
    level: 'warning',
    category: 'system',
    message: 'AMD frozen. Quote age exceeded the freshness gate.',
    reason_code: 'NO_TRADE_STALE_DATA',
    details: { reason_code: 'NO_TRADE_STALE_DATA', symbol: 'AMD' },
  },
]

function summaryFor(scenario: BookScenario): BookSummary {
  const base: BookSummary = {
    equity: 5000,
    marked_daily_pnl: -18.4,
    marked_daily_pnl_pct: -0.37,
    daily_lock_pct: -2,
    throttle_stage: 'normal',
    open_stop_risk: 18.75,
    open_stop_risk_pct: 0.38,
    position_count: 2,
    max_positions: 3,
    regime: 'trend',
    data_freshness: { stale: false, age_seconds: 4, feed: 'sip' },
    kill_switch: { halted: false, locked: false },
  }

  if (scenario === 'empty') {
    return {
      ...base,
      marked_daily_pnl: 0,
      marked_daily_pnl_pct: 0,
      open_stop_risk: 0,
      open_stop_risk_pct: 0,
      position_count: 0,
      regime: null,
    }
  }

  if (scenario === 'stale') {
    return {
      ...base,
      data_freshness: { stale: true, age_seconds: 180, feed: 'sip' },
    }
  }

  if (scenario === 'locked') {
    return {
      ...base,
      marked_daily_pnl: -105,
      marked_daily_pnl_pct: -2.1,
      throttle_stage: 'locked',
      open_stop_risk: 0,
      open_stop_risk_pct: 0,
      position_count: 0,
      regime: 'transition',
      kill_switch: { halted: true, locked: true },
    }
  }

  return base
}

export const defaultBotRisk: BotRiskParameters = {
  risk_per_trade_pct: 0.25,
  max_open_stop_risk_pct: 0.75,
  max_positions: 3,
  single_name_notional_pct: 25,
  min_score: 70,
  min_target_r: 1.5,
  cost_multiple: 3,
  sleeve_loss_limit_pct: -1.5,
}

const emptyStats = {
  marked_pnl: 0,
  marked_pnl_pct: 0,
  trade_count: 0,
  win_rate: 0,
  expectancy: 0,
  veto_count: 0,
}

function seedBots(): BotProfile[] {
  const liquid: UniverseFilters = { top_n: 75, min_price: 5, max_spread_bps: 12 }
  const tight: UniverseFilters = { top_n: 50, min_price: 20, max_spread_bps: 10 }
  return [
    {
      id: 'bot-liquid',
      name: 'Liquid leaders',
      status: 'running',
      universe: liquid,
      snapshot: snapshotFor(liquid),
      risk: { ...defaultBotRisk },
      stats: {
        marked_pnl: 86.2,
        marked_pnl_pct: 1.72,
        trade_count: 14,
        win_rate: 57,
        expectancy: 0.18,
        veto_count: 22,
      },
    },
    {
      id: 'bot-tight',
      name: 'Tight spreads',
      status: 'stopped',
      universe: tight,
      snapshot: snapshotFor(tight),
      risk: { ...defaultBotRisk, risk_per_trade_pct: 0.15, max_positions: 2, sleeve_loss_limit_pct: -1 },
      stats: {
        marked_pnl: -12.4,
        marked_pnl_pct: -0.25,
        trade_count: 6,
        win_rate: 33,
        expectancy: -0.04,
        veto_count: 9,
      },
    },
  ]
}

export interface BookState {
  scenario: BookScenario
  universe: UniverseFilters
  snapshot: UniverseSnapshot
  session: SessionSettings
  feed: FeedSettings
  risk: RiskCaps
  mode: AccountMode
  feeTier: FeeTier
  summary: BookSummary
  trades: Trade[]
  activity: ActivityLogEntry[]
  bots: BotProfile[]
}

function createState(scenario: BookScenario): BookState {
  const universe = { ...defaultUniverseFilters }
  return {
    scenario,
    universe,
    snapshot: snapshotFor(universe, scenario === 'empty' ? [] : sampleMembers),
    session: { ...defaultSession },
    feed: { ...defaultFeed },
    risk: { ...defaultRisk },
    mode: 'paper',
    feeTier: { ...defaultFeeTier },
    summary: summaryFor(scenario),
    trades: scenario === 'empty' ? [] : sampleTrades,
    activity: vetoLogs,
    bots: seedBots(),
  }
}

let state: BookState = createState('normal')
const listeners = new Set<() => void>()

function emit(next: BookState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function getBookState(): BookState {
  return state
}

export function subscribeBook(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type BookActionResult = { ok: boolean; message: string }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function setBookScenario(scenario: BookScenario) {
  const current = state
  const next = createState(scenario)
  emit({
    ...next,
    universe: current.universe,
    session: current.session,
    feed: current.feed,
    risk: current.risk,
    mode: current.mode,
    feeTier: current.feeTier,
    bots: current.bots,
    snapshot: snapshotFor(current.universe, scenario === 'empty' ? [] : sampleMembers),
  })
}

export function saveUniverseFilters(filters: UniverseFilters): BookActionResult {
  const universe: UniverseFilters = {
    top_n: Math.round(clamp(filters.top_n, UNIVERSE_LIMITS.topNMin, UNIVERSE_LIMITS.topNMax)),
    min_price: Math.max(UNIVERSE_LIMITS.minPrice, filters.min_price),
    max_spread_bps: clamp(filters.max_spread_bps, UNIVERSE_LIMITS.spreadMin, UNIVERSE_LIMITS.spreadMax),
  }
  emit({
    ...state,
    universe,
    snapshot: snapshotFor(universe, state.scenario === 'empty' ? [] : sampleMembers),
  })
  return { ok: true, message: 'Universe filters saved. Membership snapshot refreshed.' }
}

export function resetUniverseFilters(): BookActionResult {
  return saveUniverseFilters(defaultUniverseFilters)
}

export function saveSession(session: SessionSettings): BookActionResult {
  emit({
    ...state,
    session: {
      rth_enabled: session.rth_enabled,
      extended_hours: session.extended_hours,
    },
  })
  return { ok: true, message: 'Session settings saved. Extended hours stay off the live path.' }
}

export function saveFeed(feed: FeedSettings): BookActionResult {
  emit({
    ...state,
    feed: { primary: 'sip', iex_diagnostic: feed.iex_diagnostic },
  })
  return { ok: true, message: 'Feed settings saved. SIP remains the production feed.' }
}

export function saveRisk(risk: RiskCaps): BookActionResult {
  const next: RiskCaps = {
    risk_per_trade_pct: clamp(risk.risk_per_trade_pct, 0.01, RISK_HARD_CAPS.risk_per_trade_pct),
    max_open_stop_risk_pct: clamp(risk.max_open_stop_risk_pct, 0.01, RISK_HARD_CAPS.max_open_stop_risk_pct),
    soft_throttle_pct: clamp(risk.soft_throttle_pct, RISK_HARD_CAPS.soft_throttle_pct, -0.1),
    stop_new_risk_pct: clamp(risk.stop_new_risk_pct, RISK_HARD_CAPS.stop_new_risk_pct, -0.2),
    hard_daily_lock_pct: clamp(risk.hard_daily_lock_pct, RISK_HARD_CAPS.hard_daily_lock_pct, -0.3),
    max_positions: Math.round(clamp(risk.max_positions, 1, RISK_HARD_CAPS.max_positions)),
    single_name_notional_pct: clamp(risk.single_name_notional_pct, 1, RISK_HARD_CAPS.single_name_notional_pct),
    min_score: Math.round(clamp(risk.min_score, RISK_HARD_CAPS.min_score, 100)),
    min_target_r: Math.max(RISK_HARD_CAPS.min_target_r, risk.min_target_r),
    cost_multiple: Math.max(RISK_HARD_CAPS.cost_multiple, risk.cost_multiple),
  }
  emit({
    ...state,
    risk: next,
    summary: { ...state.summary, max_positions: next.max_positions, daily_lock_pct: next.hard_daily_lock_pct },
    bots: state.bots.map((bot) => ({ ...bot, risk: clampBotRisk(bot.risk, next) })),
  })
  return { ok: true, message: 'Book risk caps saved. Bot parameters were clamped to the new ceiling.' }
}

export function saveMode(mode: AccountMode): BookActionResult {
  emit({ ...state, mode })
  return { ok: true, message: 'Account mode updated. One book sizes buying power.' }
}

export function refreshFeeTier(): BookActionResult {
  const refreshed_at = new Date().toISOString()
  emit({
    ...state,
    feeTier: { version: refreshed_at.slice(0, 10), refreshed_at },
  })
  return { ok: true, message: 'Fee tier refreshed from the broker snapshot.' }
}

export function flattenBook(): BookActionResult {
  emit({
    ...state,
    summary: {
      ...state.summary,
      position_count: 0,
      open_stop_risk: 0,
      open_stop_risk_pct: 0,
    },
  })
  return { ok: true, message: 'Flatten sent. Open risk was closed.' }
}

export function lockBook(): BookActionResult {
  emit({
    ...state,
    summary: {
      ...state.summary,
      throttle_stage: 'locked',
      kill_switch: { halted: true, locked: true },
    },
  })
  return { ok: true, message: 'Book locked. New risk is refused.' }
}

export function unlockBook(): BookActionResult {
  if (state.summary.marked_daily_pnl_pct <= state.summary.daily_lock_pct) {
    return {
      ok: false,
      message: 'Unlock is refused while marked daily loss is still at the lock.',
    }
  }
  emit({
    ...state,
    summary: {
      ...state.summary,
      throttle_stage: 'normal',
      kill_switch: { halted: false, locked: false },
    },
  })
  return { ok: true, message: 'Book unlocked. Flattened positions stay closed.' }
}

export function clampUniverseFilters(filters: UniverseFilters): UniverseFilters {
  return {
    top_n: Math.round(clamp(filters.top_n, UNIVERSE_LIMITS.topNMin, UNIVERSE_LIMITS.topNMax)),
    min_price: Math.max(UNIVERSE_LIMITS.minPrice, filters.min_price),
    max_spread_bps: clamp(filters.max_spread_bps, UNIVERSE_LIMITS.spreadMin, UNIVERSE_LIMITS.spreadMax),
  }
}

export function previewUniverse(filters: UniverseFilters): UniverseSnapshot {
  const universe = clampUniverseFilters(filters)
  return snapshotFor(universe, state.scenario === 'empty' ? [] : sampleMembers)
}

export function clampBotRisk(risk: BotRiskParameters, book: RiskCaps = state.risk): BotRiskParameters {
  return {
    risk_per_trade_pct: clamp(risk.risk_per_trade_pct, 0.01, book.risk_per_trade_pct),
    max_open_stop_risk_pct: clamp(risk.max_open_stop_risk_pct, 0.01, book.max_open_stop_risk_pct),
    max_positions: Math.round(clamp(risk.max_positions, 1, book.max_positions)),
    single_name_notional_pct: clamp(risk.single_name_notional_pct, 1, book.single_name_notional_pct),
    min_score: Math.round(clamp(risk.min_score, book.min_score, 100)),
    min_target_r: Math.max(book.min_target_r, risk.min_target_r),
    cost_multiple: Math.max(book.cost_multiple, risk.cost_multiple),
    sleeve_loss_limit_pct: clamp(risk.sleeve_loss_limit_pct, book.hard_daily_lock_pct, -0.1),
  }
}

function profileFromInput(id: string, input: BotProfileInput, stats: BotProfile['stats'], status: BotProfile['status']): BotProfile {
  const universe = clampUniverseFilters(input.universe)
  return {
    id,
    name: input.name.trim(),
    status,
    universe,
    snapshot: snapshotFor(universe, state.scenario === 'empty' ? [] : sampleMembers),
    risk: clampBotRisk(input.risk),
    stats,
  }
}

export function createBotProfile(input: BotProfileInput): BookActionResult {
  if (!input.name.trim()) {
    return { ok: false, message: 'A bot needs a name.' }
  }
  const profile = profileFromInput(`bot-${Date.now()}`, input, emptyStats, 'stopped')
  emit({ ...state, bots: [...state.bots, profile] })
  return { ok: true, message: `${profile.name} created. Start it when you want that universe scanned.` }
}

export function updateBotProfile(id: string, input: BotProfileInput): BookActionResult {
  const existing = state.bots.find((bot) => bot.id === id)
  if (!existing) {
    return { ok: false, message: 'That bot no longer exists.' }
  }
  if (!input.name.trim()) {
    return { ok: false, message: 'A bot needs a name.' }
  }
  const profile = profileFromInput(id, input, existing.stats, existing.status)
  emit({ ...state, bots: state.bots.map((bot) => (bot.id === id ? profile : bot)) })
  return { ok: true, message: `${profile.name} saved. Risk parameters stay inside the book caps.` }
}

export function deleteBotProfile(id: string): BookActionResult {
  const existing = state.bots.find((bot) => bot.id === id)
  if (!existing) {
    return { ok: false, message: 'That bot no longer exists.' }
  }
  emit({ ...state, bots: state.bots.filter((bot) => bot.id !== id) })
  return { ok: true, message: `${existing.name} removed. Its past fills stay on the book.` }
}

export function startBotProfile(id: string): BookActionResult {
  const existing = state.bots.find((bot) => bot.id === id)
  if (!existing) {
    return { ok: false, message: 'That bot no longer exists.' }
  }
  if (state.summary.kill_switch.locked || state.summary.kill_switch.halted) {
    return { ok: false, message: 'The book is halted. Unlock it before starting a bot.' }
  }
  emit({
    ...state,
    bots: state.bots.map((bot) => (bot.id === id ? { ...bot, status: 'running' } : bot)),
  })
  return { ok: true, message: `${existing.name} is scanning its universe on this book.` }
}

export function stopBotProfile(id: string): BookActionResult {
  const existing = state.bots.find((bot) => bot.id === id)
  if (!existing) {
    return { ok: false, message: 'That bot no longer exists.' }
  }
  emit({
    ...state,
    bots: state.bots.map((bot) => (bot.id === id ? { ...bot, status: 'stopped' } : bot)),
  })
  return { ok: true, message: `${existing.name} stopped. Open positions stay on the book until you flatten them.` }
}

export function engageKillSwitch(): BookActionResult {
  emit({
    ...state,
    summary: {
      ...state.summary,
      kill_switch: { ...state.summary.kill_switch, halted: true },
    },
  })
  return { ok: true, message: 'Kill switch is on. New entries are halted.' }
}
