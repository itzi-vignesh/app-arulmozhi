import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE, DbAuditService } from './audit.service';

@Global()
@Module({
  providers: [
    {
      provide: AUDIT_SERVICE,
      useClass: DbAuditService,
    },
  ],
  exports: [AUDIT_SERVICE],
})
export class NoopAuditModule {}
