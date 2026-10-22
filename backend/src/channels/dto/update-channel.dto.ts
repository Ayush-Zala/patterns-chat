import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  @MinLength(2, { message: 'Channel name must be at least 2 characters' })
  @MaxLength(40, { message: 'Channel name cannot exceed 40 characters' })
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'Channel name can only contain lowercase letters, numbers, hyphens, and underscores',
  })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(250)
  topic?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
