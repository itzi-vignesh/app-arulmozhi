import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditResourceType } from '../../audit/audit.constants';
import * as OTPAuth from 'otpauth';

@Injectable()
export class TwoFactorAuthService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly auditService: AuditService,
  ) {}

  async generateSecret(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;

    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();

    await this.db
      .updateTable('users')
      .set({ twoFactorSecret: secretBase32, updatedAt: new Date() })
      .where('id', '=', userId)
      .execute();

    return { secret: secretBase32, otpauthUrl };
  }

  async enable2FA(userId: string, token: string, workspaceId: string): Promise<void> {
    const user = await this.db
      .selectFrom('users')
      .select(['twoFactorSecret', 'email'])
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication has not been set up yet');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta === null) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.db
      .updateTable('users')
      .set({ is2faEnabled: true, updatedAt: new Date() })
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .execute();

    await this.auditService.createAuditEntry({
      workspaceId,
      userId,
      action: AuditAction['2FA_ENABLED'],
      resourceType: AuditResourceType.USER,
      resourceId: userId,
    });
  }

  async verifyLoginToken(userId: string, token: string, workspaceId: string): Promise<void> {
    const user = await this.db
      .selectFrom('users')
      .select(['twoFactorSecret', 'is2faEnabled', 'email'])
      .where('id', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!user || !user.is2faEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta === null) {
      throw new BadRequestException('Invalid 2FA token');
    }

    await this.auditService.createAuditEntry({
      workspaceId,
      userId,
      action: AuditAction['2FA_LOGIN_SUCCESS'],
      resourceType: AuditResourceType.USER,
      resourceId: userId,
    });
  }
}
