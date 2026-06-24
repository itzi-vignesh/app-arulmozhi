import { Module } from '@nestjs/common';
import { PageApprovalController } from './page-approval.controller';
import { PageApprovalService } from './page-approval.service';

@Module({
  imports: [],
  controllers: [PageApprovalController],
  providers: [PageApprovalService],
  exports: [PageApprovalService],
})
export class PageApprovalModule {}
