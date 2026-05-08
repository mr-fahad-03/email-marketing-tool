import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'template_image_folders' })
export class TemplateImageFolder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'TemplateImageFolder',
    default: null,
    index: true,
  })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 80 })
  name!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TemplateImageFolderDocument = HydratedDocument<TemplateImageFolder>;
export const TemplateImageFolderSchema = SchemaFactory.createForClass(TemplateImageFolder);

TemplateImageFolderSchema.index({ workspaceId: 1, parentId: 1, name: 1 }, { unique: true });
