import axios from 'axios'
import { applyPersistedBook, getBookState, type BookActionResult } from '@/mocks/bookStore'
import { loadBotProfiles } from '@/services/botProfiles'
import { api } from '@/services/api'
import type { AccountMode, AllSettings, BookSummary, FeeTier, FeedSettings, RiskCaps, SessionSettings } from '@/types'

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as {
      error?: { message?: string; details?: { errors?: { message?: string }[] } }
    }
    const field = body?.error?.details?.errors?.find((item) => item.message)?.message
    if (field) return field
    if (body?.error?.message) return body.error.message
  }
  return fallback
}

function applySettings(data: Partial<AllSettings> | undefined, summary?: BookSummary) {
  applyPersistedBook({
    universe: data?.universe,
    session: data?.session,
    feed: data?.feed,
    risk: data?.risk,
    mode: data?.mode?.mode,
    feeTier: data?.fees
      ? { version: data.fees.version ?? '', refreshed_at: data.fees.refreshed_at ?? '' }
      : undefined,
    summary,
  })
}

export async function loadBookControl(): Promise<BookActionResult> {
  try {
    const [settings, summary] = await Promise.all([api.getSettings(), api.getSummaryStats()])
    applySettings(settings.data as AllSettings, summary.data as BookSummary)
    return { ok: true, message: '' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not load book settings.') }
  }
}

export async function persistSession(session: SessionSettings): Promise<BookActionResult> {
  try {
    const response = await api.updateSessionSettings(session)
    applyPersistedBook({ session: response.data as SessionSettings })
    return { ok: true, message: 'Session settings saved.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not save session settings.') }
  }
}

export async function persistFeed(feed: FeedSettings): Promise<BookActionResult> {
  try {
    const response = await api.updateFeedSettings({ primary: 'sip', iex_diagnostic: feed.iex_diagnostic })
    applyPersistedBook({ feed: response.data as FeedSettings })
    return { ok: true, message: 'Feed settings saved. SIP remains the production feed.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not save feed settings.') }
  }
}

export async function persistRisk(risk: RiskCaps): Promise<BookActionResult> {
  try {
    const response = await api.updateRiskSettings({ ...risk })
    applyPersistedBook({ risk: response.data as RiskCaps })
    await loadBotProfiles()
    return { ok: true, message: 'Book risk caps saved. Bot parameters were clamped to the new ceiling.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not save risk caps.') }
  }
}

export async function persistMode(mode: AccountMode): Promise<BookActionResult> {
  try {
    const response = await api.updateModeSettings({ mode })
    applyPersistedBook({ mode: (response.data as { mode: AccountMode }).mode })
    return { ok: true, message: 'Account mode updated. One book sizes buying power.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not save account mode.') }
  }
}

export async function persistFeeRefresh(): Promise<BookActionResult> {
  try {
    const response = await api.refreshFeeTier()
    const fee = response.data as FeeTier
    applyPersistedBook({
      feeTier: { version: fee.version ?? '', refreshed_at: fee.refreshed_at ?? '' },
    })
    return { ok: true, message: 'Fee tier refreshed from the broker snapshot.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not refresh the fee tier.') }
  }
}

export async function persistBookCommand(kind: 'flatten' | 'lock' | 'unlock'): Promise<BookActionResult> {
  try {
    if (kind === 'flatten') await api.flattenBook()
    else if (kind === 'lock') await api.lockBook()
    else await api.unlockBook()
    const summary = await api.getSummaryStats()
    applyPersistedBook({ summary: summary.data as BookSummary })
    const locked = getBookState().summary.kill_switch.locked
    if (kind === 'flatten') return { ok: true, message: 'Flatten sent. Open risk was closed.' }
    if (kind === 'lock') return { ok: true, message: 'Book locked. New risk is refused.' }
    return {
      ok: true,
      message: locked
        ? 'Unlock is refused while marked daily loss is still at the lock.'
        : 'Book unlocked. Flattened positions stay closed.',
    }
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(
        error,
        kind === 'flatten' ? 'Could not flatten the book.' : kind === 'lock' ? 'Could not lock the book.' : 'Could not unlock the book.',
      ),
    }
  }
}
