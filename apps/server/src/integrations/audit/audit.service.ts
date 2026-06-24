import { Injectable, Inject } from '@nestjs/common';
import { AuditLogPayload, ActorType } from '../../common/events/audit-events';
import { ClsService } from 'nestjs-cls';
import { AUDIT_CONTEXT_KEY, AuditContext } from '../../common/middlewares/audit-context.middleware';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

export type AuditLogContext = {
  workspaceId: string;
  actorId?: string;
  actorType?: ActorType;
  ipAddress?: string;
  userAgent?: string;
};

export type IAuditService = {
  log(payload: AuditLogPayload): void | Promise<void>;
  logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): void | Promise<void>;
  logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): void | Promise<void>;
  setActorId(actorId: string): void;
  setActorType(actorType: ActorType): void;
  updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): void | Promise<void>;
};

export const AUDIT_SERVICE = Symbol('AUDIT_SERVICE');

@Injectable()
export class NoopAuditService implements IAuditService {
  log(_payload: AuditLogPayload): void {
    // No-op: swallow the log when EE module is not available
  }

  logWithContext(_payload: AuditLogPayload, _context: AuditLogContext): void {
    // No-op: swallow the log when EE module is not available
  }

  logBatchWithContext(
    _payloads: AuditLogPayload[],
    _context: AuditLogContext,
  ): void {
    // No-op: swallow the log when EE module is not available
  }

  setActorId(_actorId: string): void {
    // No-op
  }

  setActorType(_actorType: ActorType): void {
    // No-op
  }

  updateRetention(
    _workspaceId: string,
    _retentionDays: number,
  ): void {
    // No-op
  }
}

@Injectable()
export class DbAuditService implements IAuditService {
  constructor(
    private readonly cls: ClsService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private getContext(): AuditLogContext {
    const auditContext = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    return {
      workspaceId: auditContext?.workspaceId ?? '',
      actorId: auditContext?.actorId ?? undefined,
      actorType: auditContext?.actorType ?? undefined,
      ipAddress: auditContext?.ipAddress ?? undefined,
      userAgent: auditContext?.userAgent ?? undefined,
    };
  }

  async log(payload: AuditLogPayload): Promise<void> {
    const context = this.getContext();
    if (!context.workspaceId) return;
    await this.logWithContext(payload, context);
  }

  async logWithContext(
    payload: AuditLogPayload,
    context: AuditLogContext,
  ): Promise<void> {
    if (!context.workspaceId) return;
    const metadata = {
      ...(payload.changes ? { changes: payload.changes } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    };
    await this.db
      .insertInto('auditLogs')
      .values({
        workspaceId: context.workspaceId,
        userId: context.actorId ?? null,
        action: payload.event,
        resourceType: payload.resourceType ?? null,
        resourceId: payload.resourceId ?? null,
        ipAddress: context.ipAddress ?? null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      })
      .execute();
  }

  async logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): Promise<void> {
    for (const payload of payloads) {
      await this.logWithContext(payload, context);
    }
  }

  setActorId(actorId: string): void {
    const auditContext = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (auditContext) {
      auditContext.actorId = actorId;
      this.cls.set(AUDIT_CONTEXT_KEY, auditContext);
    }
  }

  setActorType(actorType: ActorType): void {
    const auditContext = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    if (auditContext) {
      auditContext.actorType = actorType;
      this.cls.set(AUDIT_CONTEXT_KEY, auditContext);
    }
  }

  async updateRetention(
    workspaceId: string,
    retentionDays: number,
  ): Promise<void> {
    await this.db
      .updateTable('workspaces')
      .set({ auditRetentionDays: retentionDays })
      .where('id', '=', workspaceId)
      .execute();
  }
}
