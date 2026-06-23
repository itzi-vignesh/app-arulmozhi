import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { InsertableAuditLog, AuditLog } from '@docmost/db/types/entity.types';

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
}
