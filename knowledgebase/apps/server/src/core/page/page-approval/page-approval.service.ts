import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditResourceType } from '../../audit/audit.constants';
import { PageStatus, ApprovalAction, ApprovalStatus } from './page-approval.constants';

@Injectable()
export class PageApprovalService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly auditService: AuditService,
  ) {}

  async submitForReview(pageId: string, userId: string, workspaceId: string): Promise<void> {
    await executeTx(this.db, async (trx) => {
      const page = await trx
        .selectFrom('pages')
        .select(['id', 'workspaceId', 'spaceId'])
        .where('id', '=', pageId)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      if (!page) {
        throw new NotFoundException('Page not found');
      }

      await trx
        .updateTable('pages')
        .set({ status: PageStatus.PENDING_REVIEW, updatedAt: new Date() })
        .where('id', '=', pageId)
        .execute();

      await trx
        .insertInto('pageApprovals')
        .values({
          pageId,
          requestedByUserId: userId,
          status: ApprovalStatus.PENDING,
        })
        .execute();

      const existingVerification = await trx
        .selectFrom('pageVerifications')
        .select('id')
        .where('pageId', '=', pageId)
        .executeTakeFirst();

      if (existingVerification) {
        await trx
          .updateTable('pageVerifications')
          .set({
            status: 'in_approval',
            requestedAt: new Date(),
            requestedById: userId,
            updatedAt: new Date(),
          })
          .where('id', '=', existingVerification.id)
          .execute();
      } else {
        await trx
          .insertInto('pageVerifications')
          .values({
            pageId,
            workspaceId,
            spaceId: page.spaceId,
            type: 'qms',
            status: 'in_approval',
            requestedAt: new Date(),
            requestedById: userId,
            creatorId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .execute();
      }
    });

    await this.auditService.createAuditEntry({
      workspaceId,
      userId,
      action: AuditAction.PAGE_SUBMITTED_FOR_REVIEW,
      resourceType: AuditResourceType.PAGE,
      resourceId: pageId,
    });
  }

  async reviewPage(
    pageId: string,
    reviewerId: string,
    action: ApprovalAction,
    workspaceId: string,
    rejectionReason?: string,
  ): Promise<void> {
    if (action !== ApprovalAction.APPROVE && action !== ApprovalAction.REJECT) {
      throw new BadRequestException('Invalid review action');
    }

    await executeTx(this.db, async (trx) => {
      const page = await trx
        .selectFrom('pages')
        .select(['id', 'workspaceId', 'spaceId'])
        .where('id', '=', pageId)
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst();

      if (!page) {
        throw new NotFoundException('Page not found');
      }

      const latestApproval = await trx
        .selectFrom('pageApprovals')
        .select(['id'])
        .where('pageId', '=', pageId)
        .where('status', '=', ApprovalStatus.PENDING)
        .orderBy('createdAt', 'desc')
        .executeTakeFirst();

      if (!latestApproval) {
        throw new NotFoundException('No pending review request found for this page');
      }

      const nextStatus = action === ApprovalAction.APPROVE ? PageStatus.APPROVED : PageStatus.REJECTED;
      const nextApprovalStatus = action === ApprovalAction.APPROVE ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

      await trx
        .updateTable('pages')
        .set({ status: nextStatus, updatedAt: new Date() })
        .where('id', '=', pageId)
        .execute();

      await trx
        .updateTable('pageApprovals')
        .set({
          reviewedByUserId: reviewerId,
          status: nextApprovalStatus,
          rejectionReason: action === ApprovalAction.REJECT ? (rejectionReason ?? null) : null,
          updatedAt: new Date(),
        })
        .where('id', '=', latestApproval.id)
        .execute();

      const existingVerification = await trx
        .selectFrom('pageVerifications')
        .select(['id', 'type'])
        .where('pageId', '=', pageId)
        .executeTakeFirst();

      if (existingVerification) {
        if (action === ApprovalAction.APPROVE) {
          const nextStatus = existingVerification.type === 'qms' ? 'approved' : 'verified';
          await trx
            .updateTable('pageVerifications')
            .set({
              status: nextStatus,
              verifiedAt: new Date(),
              verifiedById: reviewerId,
              rejectionComment: null,
              updatedAt: new Date(),
            })
            .where('id', '=', existingVerification.id)
            .execute();
        } else {
          await trx
            .updateTable('pageVerifications')
            .set({
              status: 'draft',
              rejectedAt: new Date(),
              rejectedById: reviewerId,
              rejectionComment: rejectionReason ?? null,
              updatedAt: new Date(),
            })
            .where('id', '=', existingVerification.id)
            .execute();
        }
      } else {
        if (action === ApprovalAction.APPROVE) {
          await trx
            .insertInto('pageVerifications')
            .values({
              pageId,
              workspaceId,
              spaceId: page.spaceId,
              type: 'qms',
              status: 'approved',
              verifiedAt: new Date(),
              verifiedById: reviewerId,
              creatorId: reviewerId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .execute();
        }
      }
    });

    const auditAction = action === ApprovalAction.APPROVE ? AuditAction.PAGE_APPROVED : AuditAction.PAGE_REJECTED;
    const metadata = action === ApprovalAction.REJECT && rejectionReason ? { rejectionReason } : null;

    await this.auditService.createAuditEntry({
      workspaceId,
      userId: reviewerId,
      action: auditAction,
      resourceType: AuditResourceType.PAGE,
      resourceId: pageId,
      metadata,
    });
  }

  async getPendingApprovals(workspaceId: string) {
    return this.db
      .selectFrom('pages')
      .innerJoin('users as creator', 'creator.id', 'pages.creatorId')
      .select([
        'pages.id',
        'pages.title',
        'pages.slugId',
        'pages.spaceId',
        'pages.createdAt',
        'creator.name as creatorName',
        'creator.avatarUrl as creatorAvatarUrl',
      ])
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.status', '=', PageStatus.PENDING_REVIEW)
      .execute();
  }
}
