import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'
import { getLocalDb } from '../db/local-db'
import { supabase } from '../supabase/client'

type AppRole = 'ADMIN' | 'CASHIER' | 'SUPERVISOR'

type AuthUser = {
  id: number
  name: string
  username: string
  role: AppRole
  active: boolean
  source: 'local' | 'remote'
}

type LocalUserRow = {
  id: number
  name: string
  username: string
  role: AppRole
  active: number
  passwordHashLocal: string | null
}

let currentUser: AuthUser | null = null

export function registerAuthIpc(): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    const normalizedUsername = username.trim().toLowerCase()
    const db = getLocalDb()

    const localUser = db
      .prepare(
        `
        SELECT
          id,
          name,
          username,
          role,
          active,
          "passwordHashLocal" as passwordHashLocal
        FROM "User"
        WHERE lower(username) = lower(?)
          AND active = 1
          AND "deletedAt" IS NULL
        LIMIT 1
        `
      )
      .get(normalizedUsername) as LocalUserRow | undefined

    if (localUser?.passwordHashLocal) {
      const isLocalPasswordValid = await bcrypt.compare(password, localUser.passwordHashLocal)

      if (isLocalPasswordValid) {
        currentUser = {
          id: localUser.id,
          name: localUser.name,
          username: localUser.username,
          role: localUser.role,
          active: Boolean(localUser.active),
          source: 'local'
        }

        return currentUser
      }
    }

    const { data, error } = await supabase.rpc('pos_login', {
      p_username: normalizedUsername,
      p_password: password
    })

    if (error) {
      return null
    }

    const remoteUser = Array.isArray(data) ? data[0] : null

    if (!remoteUser) {
      return null
    }

    const passwordHashLocal = await bcrypt.hash(password, 10)

    db.prepare(
      `
      INSERT INTO "User" (
        id,
        username,
        name,
        role,
        active,
        "passwordHashLocal",
        "updatedAt",
        "lastRemoteLoginAt"
      ) VALUES (
        @id,
        @username,
        @name,
        @role,
        @active,
        @passwordHashLocal,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        name = excluded.name,
        role = excluded.role,
        active = excluded.active,
        "passwordHashLocal" = excluded."passwordHashLocal",
        "updatedAt" = CURRENT_TIMESTAMP,
        "lastRemoteLoginAt" = CURRENT_TIMESTAMP
      `
    ).run({
      id: remoteUser.id,
      username: remoteUser.username,
      name: remoteUser.name,
      role: remoteUser.role,
      active: remoteUser.active ? 1 : 0,
      passwordHashLocal
    })

    currentUser = {
      id: remoteUser.id,
      name: remoteUser.name,
      username: remoteUser.username,
      role: remoteUser.role,
      active: Boolean(remoteUser.active),
      source: 'remote'
    }

    return currentUser
  })

  ipcMain.handle('auth:me', async () => {
    return currentUser
  })

  ipcMain.handle('auth:logout', async () => {
    currentUser = null
    return { ok: true }
  })
}
