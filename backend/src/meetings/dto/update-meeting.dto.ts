import { IsString, IsOptional, IsInt, Min, IsArray, IsDateString } from 'class-validator';

export class UpdateMeetingDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsInt()
  @Min(5)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsString()
  @IsOptional()
  status?: string; // SCHEDULED, LIVE, COMPLETED, CANCELLED

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[];
}
