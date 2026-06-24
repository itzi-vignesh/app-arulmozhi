import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { InsertableAuditLog, AuditLog } from '@docmost/db/types/entity.types';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { sql } from 'kysely';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class AuditRepository {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async create(
    auditLog: InsertableAuditLog,
    trx?: KyselyTransaction,
  ): Promise<AuditLog> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('auditLogs')
      .values(auditLog)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async findPaginated(workspaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('auditLogs')
      .select((eb) => [
        'auditLogs.id',
        'auditLogs.workspaceId',
        'auditLogs.userId',
        'auditLogs.action',
        'auditLogs.resourceType',
        'auditLogs.resourceId',
        'auditLogs.metadata',
        'auditLogs.ipAddress',
        'auditLogs.createdAt',
        sql<string>`action`.as('event'),
        jsonObjectFrom(
          eb.selectFrom('users')
            .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'auditLogs.userId')
        ).as('actor'),
        sql<any>`(
          CASE
            WHEN audit_logs.resource_type = 'USER' THEN (
              SELECT json_build_object('id', u.id, 'name', u.name)
              FROM users u WHERE u.id = audit_logs.resource_id
            )
            WHEN audit_logs.resource_type = 'PAGE' THEN (
              SELECT json_build_object('id', p.id, 'name', p.title)
              FROM pages p WHERE p.id = audit_logs.resource_id
            )
            WHEN audit_logs.resource_type = 'SPACE' THEN (
              SELECT json_build_object('id', s.id, 'name', s.name, 'slug', s.slug)
              FROM spaces s WHERE s.id = audit_logs.resource_id
            )
            ELSE NULL
          END
        )`.as('resource')
      ])
      .where('auditLogs.workspaceId', '=', workspaceId);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'createdAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }
}
