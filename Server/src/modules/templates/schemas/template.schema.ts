import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  TEMPLATE_CATEGORY_VALUES,
  TEMPLATE_CHANNEL_VALUES,
  TEMPLATE_EDITOR_VALUES,
  TEMPLATE_LAYOUT_PRESET_VALUES,
  TEMPLATE_STATUS_VALUES,
  TEMPLATE_VISIBILITY_VALUES,
  TemplateCategory,
  TemplateChannelType,
  TemplateEditorType,
  TemplateLayoutPreset,
  TemplateStatus,
  TemplateVisibility,
} from '../constants/template.enums';

@Schema({ _id: false })
export class EmailTemplateContent {
  @Prop({ required: true })
  subject!: string;

  @Prop({ default: '' })
  previewText!: string;

  @Prop({ required: true })
  htmlBody!: string;

  @Prop({ default: '' })
  textBody!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  designJson?: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  mjmlBody?: string | null;
}

@Schema({ _id: false })
export class WhatsAppTemplateContent {
  @Prop({ required: true })
  templateName!: string;

  @Prop({ required: true })
  language!: string;

  @Prop({ type: [String], default: [] })
  bodyParams!: string[];

  @Prop({ type: [String], default: [] })
  headerParams!: string[];

  @Prop({ type: [String], default: [] })
  buttonParams!: string[];
}

@Schema({ timestamps: true, collection: 'templates' })
export class Template {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 120 })
  name!: string;

  @Prop({ type: String, enum: TEMPLATE_CHANNEL_VALUES, required: true, index: true })
  channelType!: TemplateChannelType;

  @Prop({ type: String, enum: TEMPLATE_CATEGORY_VALUES, default: TemplateCategory.GENERAL })
  category!: TemplateCategory;

  @Prop({ type: String, enum: TEMPLATE_STATUS_VALUES, default: TemplateStatus.DRAFT })
  status!: TemplateStatus;

  @Prop({ type: String, enum: TEMPLATE_VISIBILITY_VALUES, default: TemplateVisibility.PERSONAL })
  visibility!: TemplateVisibility;

  @Prop({ type: String, enum: TEMPLATE_EDITOR_VALUES, default: TemplateEditorType.HTML })
  editorType!: TemplateEditorType;

  @Prop({ type: String, enum: TEMPLATE_LAYOUT_PRESET_VALUES, default: undefined })
  layoutPreset?: TemplateLayoutPreset;

  @Prop({ type: [String], default: [] })
  variables!: string[];

  @Prop({ type: EmailTemplateContent, default: null })
  email!: EmailTemplateContent | null;

  @Prop({ type: WhatsAppTemplateContent, default: null })
  whatsapp!: WhatsAppTemplateContent | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TemplateDocument = HydratedDocument<Template>;
export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.index({ workspaceId: 1, channelType: 1, name: 1 }, { unique: true });
