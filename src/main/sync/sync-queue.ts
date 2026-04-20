import { getLocalDb } from '../db/local-db'

export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'REPLACE'

export function enqueueSync(
  entityName: string,
  entityPublicId: string,
  action: SyncAction,
  payload: unknown
): void {
  const db = getLocalDb()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO sync_queue (
      entity_name,
      entity_public_id,
      action,
      payload_json,
      status,
      retries,
      last_error,
      created_at,
      updated_at
    ) VALUES (
      @entityName,
      @entityPublicId,
      @action,
      @payloadJson,
      'PENDING',
      0,
      NULL,
      @now,
      @now
    )
  `).run({
    entityName,
    entityPublicId,
    action,
    payloadJson: JSON.stringify(payload),
    now
  })
}
