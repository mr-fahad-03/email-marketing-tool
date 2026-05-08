import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTemplateImageFolderDto } from './dto/create-template-image-folder.dto';
import { ListTemplateImagesDto } from './dto/list-template-images.dto';
import { UploadTemplateImageDto } from './dto/upload-template-image.dto';
import { TemplateImagesService } from './template-images.service';
import {
  TemplateImageBrowserResponse,
  TemplateImageFileResponse,
  TemplateImageFolderResponse,
} from './types/template-image.response';

@Controller('template-images')
@UseGuards(JwtAuthGuard)
export class TemplateImagesController {
  constructor(private readonly templateImagesService: TemplateImagesService) {}

  @Get('browser')
  browse(
    @Query() query: ListTemplateImagesDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateImageBrowserResponse> {
    return this.templateImagesService.browse(query, authUser);
  }

  @Post('folders')
  createFolder(
    @Body() dto: CreateTemplateImageFolderDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateImageFolderResponse> {
    return this.templateImagesService.createFolder(dto, authUser);
  }

  @Delete('folders/:id')
  removeFolder(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    return this.templateImagesService.removeFolder(id, authUser);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadTemplateImageDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<TemplateImageFileResponse> {
    return this.templateImagesService.upload(file, dto, authUser);
  }

  @Delete('files/:id')
  removeFile(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    return this.templateImagesService.removeFile(id, authUser);
  }
}
