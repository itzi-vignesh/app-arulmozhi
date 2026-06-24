import { IsUUID, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalAction } from '../page-approval.constants';

export class SubmitForReviewDto {
  @IsUUID()
  @IsNotEmpty()
  pageId: string;
}

export class ReviewPageDto {
  @IsUUID()
  @IsNotEmpty()
  pageId: string;

  @IsEnum(ApprovalAction)
  @IsNotEmpty()
  action: ApprovalAction;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
