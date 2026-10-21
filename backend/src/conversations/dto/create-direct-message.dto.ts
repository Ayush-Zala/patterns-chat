import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @IsNumber()
  fileSize!: number;
}

export class CreateDirectMessageDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  content?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class FindOrCreateConversationDto {
  @IsString()
  @IsNotEmpty()
  recipientId!: string;
}
