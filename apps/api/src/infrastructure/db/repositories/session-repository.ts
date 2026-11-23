import { and, eq, lte } from 'drizzle-orm';
import type { SessionRepository } from '../../../application/ports/session-repository';
import type { Database } from '../client';
import { sessions } from '../schema';

/** Adaptador Drizzle de `SessionRepository`. */
export function createDrizzleSessionRepository(db: Database): SessionRepository {
  return {
    async create(session) {
      await db.insert(sessions).values(session);
    },

    async findById(id) {
      const [row] = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
          expiresAt: sessions.expiresAt,
          createdAt: sessions.createdAt,
        })
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);
      return row ?? null;
    },

    async delete(id) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },

    async deleteAllForUser(userId) {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },

    async deleteExpiredForUser(userId, now) {
      // Mismo criterio que `isSessionExpired`: caducada desde `expiresAt` (incluido).
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));
    },
  };
}
