import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignAudienceDto } from './dto/list-campaign-audience.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignListResponse, CampaignResponse } from './types/campaign.response';
import { ContactListResponse } from '../contacts/types/contact.response';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.create(dto, authUser);
  }

  @Get()
  findAll(
    @Query() query: ListCampaignsDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignListResponse> {
    return this.campaignsService.findAll(query, authUser);
  }

  @Get(':id/contacts')
  findAudience(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: ListCampaignAudienceDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactListResponse> {
    return this.campaignsService.findAudience(id, query, authUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.findOne(id, authUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.update(id, dto, authUser);
  }

  @Post(':id/start')
  start(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.start(id, authUser);
  }

  @Post(':id/pause')
  pause(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.pause(id, authUser);
  }

  @Post(':id/resume')
  resume(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.resume(id, authUser);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<CampaignResponse> {
    return this.campaignsService.cancel(id, authUser);
  }
}
