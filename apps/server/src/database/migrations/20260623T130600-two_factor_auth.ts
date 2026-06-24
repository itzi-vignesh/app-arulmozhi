import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('two_factor_secret', 'varchar')
    .addColumn('is_2fa_enabled', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('two_factor_secret')
    .dropColumn('is_2fa_enabled')
    .execute();
}
