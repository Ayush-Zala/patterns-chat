import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsArray, IsDateString } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[];

  @IsString()
  @IsOptional()
  workspaceId?: string;
}
