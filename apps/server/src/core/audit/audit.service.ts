import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditRepository } from './audit.repository';
import { AuditAction, AuditResourceType } from './audit.constants';
import { InsertableAuditLog, AuditLog } from '@docmost/db/types/entity.types';
import {
  AuditContext,
  AUDIT_CONTEXT_KEY,
} from '../../common/middlewares/audit-context.middleware';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly cls: ClsService,
  ) {}

  async getAuditLogsPaginated(workspaceId: string, pagination: PaginationOptions) {
    return this.auditRepository.findPaginated(workspaceId, pagination);
  }

  async createAuditEntry(data: InsertableAuditLog): Promise<AuditLog> {
    return this.auditRepository.create(data);
  }

  async logLogin(userId: string, workspaceId: string): Promise<void> {
    const auditContext = this.cls.get<AuditContext>(AUDIT_CONTEXT_KEY);
    const ipAddress = auditContext?.ipAddress ?? null;

    await this.createAuditEntry({
      workspaceId,
      userId,
      action: AuditAction.LOGIN,
      resourceType: AuditResourceType.USER,
      resourceId: userId,
      ipAddress,
    });
  }
}
