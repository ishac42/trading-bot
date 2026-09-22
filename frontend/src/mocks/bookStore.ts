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
  Position,
  RiskCaps,
  SessionSettings,
  Trade,
  UniverseFilters,
  UniverseMember,
  UniverseSnapshot,
  BookSocketEvent,
  DataHealthPayload,
  PriceUpdatePayload,
  RegimeChangedPayload,
  RiskEventPayload,
  UniverseUpdatedPayload,
} from '@/types'

/**
 * Book screens read this store until they call the control-plane API.
 * It starts empty. Saving settings does not place an order.
 */
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
  version: '',
  refreshed_at: '',
}

function snapshotFor(filters: UniverseFilters, members: UniverseMember[] = []): UniverseSnapshot {
  return {
    as_of: '',
    filters: { ...filters },
    members: members.filter(
      (member) => member.price >= filters.min_price && member.spread_bps <= filters.max_spread_bps
    ),
  }
}

function withPositionTotals(summary: BookSummary, positions: Position[]): BookSummary {
  const openStop = positions.reduce((sum, item) => sum + (item.open_stop_risk ?? 0), 0)
  return {
    ...summary,
    position_count: positions.length,
    open_stop_risk: openStop,
    open_stop_risk_pct: summary.equity > 0 ? (openStop / summary.equity) * 100 : 0,
  }
}

function summaryFor(scenario: BookScenario): BookSummary {
  const base: BookSummary = {
    equity: 0,
    marked_daily_pnl: 0,
    marked_daily_pnl_pct: 0,
    daily_lock_pct: -2,
    throttle_stage: 'normal',
    open_stop_risk: 0,
    open_stop_risk_pct: 0,
    position_count: 0,
    max_positions: 3,
    regime: null,
    data_freshness: { stale: true, age_seconds: null, feed: 'sip' },
    kill_switch: { halted: false, locked: false },
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
      equity: 5000,
      marked_daily_pnl: -105,
      marked_daily_pnl_pct: -2.1,
      throttle_stage: 'locked',
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

export function completeBot(raw: Partial<BotProfile> | null | undefined): BotProfile {
  const universe = { ...defaultUniverseFilters, ...(raw?.universe ?? {}) }
  return {
    id: String(raw?.id ?? ''),
    name: raw?.name || 'Bot',
    status: raw?.status === 'running' ? 'running' : 'stopped',
    universe,
    risk: { ...defaultBotRisk, ...(raw?.risk ?? {}) },
    stats: { ...emptyStats, ...(raw?.stats ?? {}) },
    snapshot: {
      as_of: raw?.snapshot?.as_of ?? '',
      filters: { ...universe, ...(raw?.snapshot?.filters ?? {}) },
      members: raw?.snapshot?.members ?? [],
    },
  }
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
  botsLoaded: boolean
  positions: Position[]
}

function createState(scenario: BookScenario): BookState {
  const universe = { ...defaultUniverseFilters }
  return {
    scenario,
    universe,
    snapshot: snapshotFor(universe),
    session: { ...defaultSession },
    feed: { ...defaultFeed },
    risk: { ...defaultRisk },
    mode: 'paper',
    feeTier: { ...defaultFeeTier },
    summary: summaryFor(scenario),
    trades: [],
    activity: [],
    bots: [],
    botsLoaded: false,
    positions: [],
  }
}

let state: BookState = createState('normal')
let botListEpoch = 0
const listeners = new Set<() => void>()

export function botListEpochNow(): number {
  return botListEpoch
}

export function bumpBotListEpoch(): number {
  botListEpoch += 1
  return botListEpoch
}

export function applyServerBots(bots: BotProfile[], epoch: number) {
  if (epoch !== botListEpoch) return
  emit({ ...state, bots: (bots ?? []).map((bot) => completeBot(bot)), botsLoaded: true })
}

export function markBotsLoaded(epoch: number) {
  if (epoch !== botListEpoch) return
  emit({ ...state, botsLoaded: true })
}

export function applyServerBot(bot: BotProfile) {
  bumpBotListEpoch()
  const saved = completeBot(bot)
  const bots = state.bots.some((item) => item.id === saved.id)
    ? state.bots.map((item) => (item.id === saved.id ? saved : item))
    : [...state.bots, saved]
  emit({ ...state, bots, botsLoaded: true })
}

export function applyServerBotRemoval(id: string, name: string): BookActionResult {
  bumpBotListEpoch()
  emit({ ...state, bots: state.bots.filter((bot) => bot.id !== id), botsLoaded: true })
  return { ok: true, message: `${name} removed. Its past fills stay on the book.` }
}

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

export function resetBook() {
  botListEpoch = 0
  emit(createState('empty'))
}

export function replaceBookSlice(
  partial: Partial<Pick<BookState, 'bots' | 'positions' | 'trades' | 'activity' | 'summary'>>
) {
  const positions = partial.positions ?? state.positions
  const summary = withPositionTotals(partial.summary ?? state.summary, positions)
  emit({ ...state, ...partial, positions, summary })
}

export function setBookScenario(scenario: BookScenario) {
  const current = state
  const next = createState(scenario)
  const positions = scenario === 'empty' || scenario === 'locked' ? [] : current.positions
  emit({
    ...next,
    universe: current.universe,
    session: current.session,
    feed: current.feed,
    risk: current.risk,
    mode: current.mode,
    feeTier: current.feeTier,
    bots: current.bots,
    botsLoaded: current.botsLoaded,
    trades: scenario === 'empty' ? [] : current.trades,
    activity: scenario === 'empty' ? [] : current.activity,
    positions,
    summary: withPositionTotals(next.summary, positions),
    snapshot: snapshotFor(current.universe, scenario === 'empty' ? [] : current.snapshot.members),
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
    snapshot: snapshotFor(universe, state.snapshot.members),
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

export function applyPersistedBook(partial: {
  universe?: UniverseFilters
  session?: SessionSettings
  feed?: FeedSettings
  risk?: RiskCaps
  mode?: AccountMode
  feeTier?: FeeTier
  summary?: BookSummary
}) {
  const risk = { ...defaultRisk, ...(partial.risk ?? state.risk ?? {}) }
  const summary = partial.summary
    ? { ...partial.summary, max_positions: risk.max_positions, daily_lock_pct: risk.hard_daily_lock_pct }
    : { ...state.summary, max_positions: risk.max_positions, daily_lock_pct: risk.hard_daily_lock_pct }
  emit({
    ...state,
    universe: partial.universe ?? state.universe,
    session: partial.session ?? state.session,
    feed: partial.feed ? { primary: 'sip', iex_diagnostic: Boolean(partial.feed.iex_diagnostic) } : state.feed,
    risk,
    mode: partial.mode ?? state.mode,
    feeTier: partial.feeTier ?? state.feeTier,
    summary,
    bots: partial.risk
      ? state.bots.map((bot) => {
          const filled = completeBot(bot)
          return { ...filled, risk: clampBotRisk(filled.risk, risk) }
        })
      : state.bots,
  })
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
    positions: [],
    summary: withPositionTotals(state.summary, []),
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
  return snapshotFor(universe, state.snapshot.members)
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
    snapshot: snapshotFor(universe),
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

export function closeBookPosition(id: string): BookActionResult {
  const position = state.positions.find((item) => item.id === id)
  if (!position) {
    return { ok: false, message: 'That position is already closed.' }
  }
  const positions = state.positions.filter((item) => item.id !== id)
  emit({
    ...state,
    positions,
    summary: withPositionTotals(state.summary, positions),
  })
  return { ok: true, message: `Closed ${position.symbol}. The bot keeps running.` }
}

function snapshotFromMembers(filters: UniverseFilters, asOf: string, members: UniverseMember[]): UniverseSnapshot {
  return {
    as_of: asOf,
    filters: { ...filters },
    members: members.filter(
      (member) => member.price >= filters.min_price && member.spread_bps <= filters.max_spread_bps
    ),
  }
}

export function applyBookSocketEvent(event: BookSocketEvent, payload: unknown): void {
  if (event === 'risk_event') {
    const data = payload as RiskEventPayload
    const locked =
      data.locked ?? (data.throttle_stage === 'locked' ? true : state.summary.kill_switch.locked)
    const positions = locked ? [] : state.positions
    emit({
      ...state,
      positions,
      summary: withPositionTotals(
        {
          ...state.summary,
          throttle_stage: data.throttle_stage ?? (locked ? 'locked' : state.summary.throttle_stage),
          marked_daily_pnl: data.marked_daily_pnl ?? state.summary.marked_daily_pnl,
          marked_daily_pnl_pct: data.marked_daily_pnl_pct ?? state.summary.marked_daily_pnl_pct,
          kill_switch: {
            halted: data.halted ?? (locked || state.summary.kill_switch.halted),
            locked,
          },
        },
        positions
      ),
    })
    return
  }

  if (event === 'regime_changed') {
    const data = payload as RegimeChangedPayload
    emit({ ...state, summary: { ...state.summary, regime: data.regime } })
    return
  }

  if (event === 'data_health') {
    const data = payload as DataHealthPayload
    emit({
      ...state,
      summary: {
        ...state.summary,
        data_freshness: {
          stale: data.stale,
          age_seconds: data.age_seconds,
          feed: data.feed ?? state.summary.data_freshness.feed,
        },
      },
    })
    return
  }

  if (event === 'universe_updated') {
    const data = payload as UniverseUpdatedPayload
    emit({
      ...state,
      snapshot: snapshotFromMembers(state.universe, data.as_of, data.members),
      bots: state.bots.map((bot) => ({
        ...bot,
        snapshot: snapshotFromMembers(bot.universe, data.as_of, data.members),
      })),
    })
    return
  }

  if (event === 'trade_executed') {
    const trade = payload as Trade
    if (state.trades.some((item) => item.id === trade.id)) return
    emit({ ...state, trades: [trade, ...state.trades] })
    return
  }

  if (event === 'position_updated') {
    const update = payload as Partial<Position> & { id: string }
    emit({
      ...state,
      positions: state.positions.map((position) =>
        position.id === update.id ? { ...position, ...update } : position
      ),
    })
    return
  }

  if (event === 'price_update') {
    const data = payload as PriceUpdatePayload
    const positions = state.positions.map((position) => {
      if (position.symbol !== data.symbol || !position.is_open) return position
      return {
        ...position,
        current_price: data.price,
        unrealized_pnl: (data.price - position.entry_price) * position.quantity,
      }
    })
    emit({ ...state, positions, summary: withPositionTotals(state.summary, positions) })
  }
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
