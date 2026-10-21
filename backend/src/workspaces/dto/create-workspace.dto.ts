import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required' })
  @MinLength(2, { message: 'Workspace name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Workspace name cannot exceed 50 characters' })
  name!: string;
}
