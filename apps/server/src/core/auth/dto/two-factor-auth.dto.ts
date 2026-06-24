import { IsUUID, IsNotEmpty, IsString, Length } from 'class-validator';

export class Enable2FaDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Token must be exactly 6 digits' })
  token: string;
}

export class Verify2FaLoginDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Token must be exactly 6 digits' })
  token: string;
}
