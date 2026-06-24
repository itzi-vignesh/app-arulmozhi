import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Res, NotFoundException } from '@nestjs/common';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';
import { Enable2FaDto, Verify2FaLoginDto } from '../dto/two-factor-auth.dto';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../session/session.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { FastifyReply } from 'fastify';

@Controller('auth/2fa')
export class TwoFactorAuthController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly userRepo: UserRepo,
    private readonly sessionService: SessionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('generate')
  async generate(
    @AuthUser() user: User,
  ) {
    return this.twoFactorAuthService.generateSecret(user.id, user.email);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('enable')
  async enable(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: Enable2FaDto,
  ) {
    await this.twoFactorAuthService.enable2FA(user.id, dto.token, workspace.id);
    return { success: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verify(
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: Verify2FaLoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.twoFactorAuthService.verifyLoginToken(dto.userId, dto.token, workspace.id);

    const user = await this.userRepo.findById(dto.userId, workspace.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = await this.sessionService.createSessionAndToken(user);

    res.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });

    return { success: true };
  }
}
