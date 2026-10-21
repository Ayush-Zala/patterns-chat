import { IsNotEmpty, IsString } from 'class-validator';

export class JoinWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Invite or join code is required' })
  joinCode!: string;
}
