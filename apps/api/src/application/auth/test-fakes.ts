// Fakes en memoria de los puertos de autenticación, solo para los tests de aplicación.
import type { CurrentUser } from '@incidapp/shared';
import type { Session } from '../../domain/auth/session';
import type { UserAccount } from '../../domain/auth/user';
import type { AuditEntry, AuditLogWriter } from '../ports/audit-log-writer';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';
import type { SessionRepository } from '../ports/session-repository';
import type { SessionTokens } from '../ports/session-tokens';
import type { CurrentUserRecord, UserRepository } from '../ports/user-repository';

export interface FakeUser extends UserAccount {
  departments: CurrentUser['departments'];
}

export class InMemoryUsers implements UserRepository {
  constructor(public readonly users: FakeUser[] = []) {}

  async findAccountByEmail(email: string): Promise<UserAccount | null> {
    const user = this.users.find((candidate) => candidate.email === email);
    if (!user) return null;
    const { departments: _departments, ...account } = user;
    return account;
  }

  async findCurrentUser(id: string): Promise<CurrentUserRecord | null> {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    const { id: userId, email, name, role, departments, active } = user;
    return { user: { id: userId, email, name, role, departments }, active };
  }
}

export class InMemorySessions implements SessionRepository {
  readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(id);
    }
  }

  async deleteExpiredForUser(userId: string, now: Date): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && session.expiresAt.getTime() <= now.getTime()) {
        this.sessions.delete(id);
      }
    }
  }
}

export class InMemoryAuditLog implements AuditLogWriter {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Hasher reversible y barato: `fake:<contraseña>`. Registra cada hash y cada verificación. */
export class FakePasswordHasher implements PasswordHasher {
  readonly verifications: { hash: string; password: string }[] = [];
  readonly hashed: string[] = [];

  async hash(password: string): Promise<string> {
    this.hashed.push(password);
    return `fake:${password}`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    this.verifications.push({ hash, password });
    return hash === `fake:${password}`;
  }
}

/** Tokens secuenciales (`token-1`, `token-2`…) con `idFor` = `id(<token>)`. */
export class FakeSessionTokens implements SessionTokens {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `token-${this.counter}`;
  }

  idFor(token: string): string {
    return `id(${token})`;
  }
}

export class FixedClock implements Clock {
  constructor(public current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
