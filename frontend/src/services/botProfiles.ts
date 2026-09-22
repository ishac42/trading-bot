import axios from 'axios'
import {
  applyServerBot,
  applyServerBotRemoval,
  applyServerBots,
  botListEpochNow,
  clampBotRisk,
  clampUniverseFilters,
  markBotsLoaded,
  type BookActionResult,
} from '@/mocks/bookStore'
import { api } from '@/services/api'
import type { BotProfile, BotProfileInput } from '@/types'

function normalize(raw: BotProfile): BotProfile {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status === 'running' ? 'running' : 'stopped',
    universe: raw.universe,
    risk: raw.risk,
    stats: raw.stats,
    snapshot: {
      as_of: raw.snapshot?.as_of ?? '',
      filters: raw.snapshot?.filters ?? raw.universe,
      members: raw.snapshot?.members ?? [],
    },
  }
}

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

function writeBody(input: BotProfileInput) {
  return {
    name: input.name.trim(),
    universe: clampUniverseFilters(input.universe),
    risk: clampBotRisk(input.risk),
  }
}

export async function loadBotProfiles(): Promise<BookActionResult> {
  const epoch = botListEpochNow()
  try {
    const response = await api.getBots()
    applyServerBots((response.data as BotProfile[]).map(normalize), epoch)
    return { ok: true, message: '' }
  } catch (error) {
    markBotsLoaded(epoch)
    return { ok: false, message: errorMessage(error, 'Could not load bots.') }
  }
}

export async function saveBotProfile(input: BotProfileInput, id?: string): Promise<BookActionResult> {
  const body = writeBody(input)
  if (!body.name) {
    return { ok: false, message: 'A bot needs a name.' }
  }
  try {
    const response = id ? await api.updateBot(id, body) : await api.createBot(body)
    const saved = normalize(response.data as BotProfile)
    applyServerBot(saved)
    return {
      ok: true,
      message: id ? `${saved.name} saved.` : `${saved.name} saved.`,
    }
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not save the bot.') }
  }
}

export async function removeBotProfile(id: string, name: string): Promise<BookActionResult> {
  try {
    await api.deleteBot(id)
    return applyServerBotRemoval(id, name)
  } catch (error) {
    return { ok: false, message: errorMessage(error, 'Could not delete the bot.') }
  }
}

export async function setBotProfileRunning(id: string, running: boolean): Promise<BookActionResult> {
  try {
    const response = running ? await api.startBot(id) : await api.stopBot(id)
    const saved = normalize(response.data as BotProfile)
    applyServerBot(saved)
    return {
      ok: true,
      message: running
        ? `${saved.name} is scanning its universe on this book.`
        : `${saved.name} stopped. Open positions stay on the book until you flatten them.`,
    }
  } catch (error) {
    return { ok: false, message: errorMessage(error, running ? 'Could not start the bot.' : 'Could not stop the bot.') }
  }
}
