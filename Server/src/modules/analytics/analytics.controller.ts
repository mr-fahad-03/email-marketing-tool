import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventQueryFiltersDto } from '../../common/dto/event-query-filters.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('campaigns/:campaignIdentifier')
  getCampaignAnalytics(
    @Param('campaignIdentifier') campaignIdentifier: string,
    @Query() filters: EventQueryFiltersDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.analyticsService.getCampaignAnalytics(campaignIdentifier, filters, authUser);
  }

  @Get('senders/:id')
  getSenderAnalytics(
    @Param('id', ParseObjectIdPipe) senderId: string,
    @Query() filters: EventQueryFiltersDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<Record<string, unknown>> {
    return this.analyticsService.getSenderAnalytics(senderId, filters, authUser);
  }
}
