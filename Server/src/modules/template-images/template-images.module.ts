import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TemplateImageFile, TemplateImageFileSchema } from './schemas/template-image-file.schema';
import {
  TemplateImageFolder,
  TemplateImageFolderSchema,
} from './schemas/template-image-folder.schema';
import { TemplateImagesController } from './template-images.controller';
import { TemplateImagesService } from './template-images.service';

@Module({
  imports: [
    AuthModule,
    WorkspacesModule,
    MongooseModule.forFeature([
      { name: TemplateImageFolder.name, schema: TemplateImageFolderSchema },
      { name: TemplateImageFile.name, schema: TemplateImageFileSchema },
    ]),
  ],
  controllers: [TemplateImagesController],
  providers: [TemplateImagesService],
  exports: [TemplateImagesService, MongooseModule],
})
export class TemplateImagesModule {}
