import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('resource_type', 'varchar', (col) => col)
    .addColumn('resource_id', 'uuid', (col) => col)
    .addColumn('metadata', 'jsonb', (col) => col)
    .addColumn('ip_address', 'varchar', (col) => col)
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_workspace_created_at')
    .ifNotExists()
    .on('audit_logs')
    .columns(['workspace_id', 'created_at desc'])
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_user_id')
    .ifNotExists()
    .on('audit_logs')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_logs').execute();
}
