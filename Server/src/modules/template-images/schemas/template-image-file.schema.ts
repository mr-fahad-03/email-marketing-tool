import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'template_image_files' })
export class TemplateImageFile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'TemplateImageFolder',
    default: null,
    index: true,
  })
  folderId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, maxlength: 255 })
  originalName!: string;

  @Prop({ required: true, trim: true, maxlength: 255 })
  storedName!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  mimeType!: string;

  @Prop({ required: true, min: 1 })
  sizeBytes!: number;

  @Prop({ required: true, trim: true, maxlength: 500 })
  relativePath!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  publicPath!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  createdByUserId!: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TemplateImageFileDocument = HydratedDocument<TemplateImageFile>;
export const TemplateImageFileSchema = SchemaFactory.createForClass(TemplateImageFile);

TemplateImageFileSchema.index({ workspaceId: 1, folderId: 1, createdAt: -1 });
