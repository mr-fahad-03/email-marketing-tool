import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ListProviderTemplatesDto } from './dto/list-provider-templates.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { RenderMjmlDto } from './dto/render-mjml.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';
import {
  MjmlProviderStatusResponse,
  MjmlRenderResponse,
  ProviderTemplateDetailResponse,
  ProviderTemplateListResponse,
  TemplateListResponse,
  TemplatePreviewResponse,
  TemplateResponse,
} from './types/template.response';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  create(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateResponse> {
    return this.templatesService.create(dto, authUser);
  }

  @Get()
  findAll(
    @Query() query: ListTemplatesDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateListResponse> {
    return this.templatesService.findAll(query, authUser);
  }

  @Get('library/providers/mjml/status')
  getMjmlProviderStatus(): MjmlProviderStatusResponse {
    return this.templatesService.getMjmlProviderStatus();
  }

  @Get('library/providers/mjml/templates')
  listMjmlTemplates(
    @Query() query: ListProviderTemplatesDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ProviderTemplateListResponse> {
    return this.templatesService.listMjmlTemplates(query, authUser);
  }

  @Get('library/providers/mjml/templates/:templateId')
  getMjmlTemplateById(
    @Param('templateId') templateId: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ProviderTemplateDetailResponse> {
    return this.templatesService.getMjmlTemplateById(templateId, authUser);
  }

  @Post('library/providers/mjml/render')
  renderMjml(@Body() dto: RenderMjmlDto): Promise<MjmlRenderResponse> {
    return this.templatesService.renderMjml(dto.mjml);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateResponse> {
    return this.templatesService.findOne(id, authUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateResponse> {
    return this.templatesService.update(id, dto, authUser);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    return this.templatesService.remove(id, authUser);
  }

  @Post(':id/preview')
  preview(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: PreviewTemplateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplatePreviewResponse> {
    return this.templatesService.preview(id, dto, authUser);
  }
}
