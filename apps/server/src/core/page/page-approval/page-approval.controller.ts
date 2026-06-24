import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PageApprovalService } from './page-approval.service';
import { SubmitForReviewDto, ReviewPageDto } from './dto/page-approval.dto';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../../common/helpers/types/permission';

@UseGuards(JwtAuthGuard)
@Controller('page-approval')
export class PageApprovalController {
  constructor(private readonly pageApprovalService: PageApprovalService) {}

  @HttpCode(HttpStatus.OK)
  @Post('submit')
  async submitForReview(
    @Body() dto: SubmitForReviewDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pageApprovalService.submitForReview(dto.pageId, user.id, workspace.id);
    return { message: 'Page submitted for review successfully' };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @Post('review')
  async reviewPage(
    @Body() dto: ReviewPageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.pageApprovalService.reviewPage(
      dto.pageId,
      user.id,
      dto.action,
      workspace.id,
      dto.rejectionReason,
    );
    return { message: `Page successfully processed` };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @Get('pending')
  async getPendingApprovals(
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageApprovalService.getPendingApprovals(workspace.id);
  }
}
