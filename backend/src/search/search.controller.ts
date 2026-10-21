import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('workspaces/:workspaceId/search')
  async search(
    @CurrentUser() user: { id: string },
    @Param('workspaceId') workspaceId: string,
    @Query('q') query: string,
    @Query('filter') filter?: 'all' | 'messages' | 'files' | 'channels' | 'people',
    @Query('inChannel') inChannel?: string,
    @Query('fromUser') fromUser?: string,
  ) {
    return this.searchService.searchWorkspace(
      user.id,
      workspaceId,
      query || '',
      filter || 'all',
      inChannel,
      fromUser,
    );
  }
}
