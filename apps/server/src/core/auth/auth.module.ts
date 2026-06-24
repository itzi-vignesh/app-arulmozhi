import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { SignupService } from './services/signup.service';
import { TokenModule } from './token.module';
import { TwoFactorAuthController } from './controllers/two-factor-auth.controller';
import { TwoFactorAuthService } from './services/two-factor-auth.service';

@Module({
  imports: [TokenModule, WorkspaceModule],
  controllers: [AuthController, TwoFactorAuthController],
  providers: [AuthService, SignupService, JwtStrategy, TwoFactorAuthService],
  exports: [SignupService],
})
export class AuthModule {}
