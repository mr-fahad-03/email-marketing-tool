import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import {
  CONTACT_EMAIL_STATUS_VALUES,
  CONTACT_SOURCE_VALUES,
  CONTACT_SUBSCRIPTION_STATUS_VALUES,
  CONTACT_WHATSAPP_STATUS_VALUES,
  ContactEmailStatus,
  ContactSource,
  ContactSubscriptionStatus,
  ContactWhatsappStatus,
} from '../constants/contact.enums';

@Schema({ timestamps: true, collection: 'contacts' })
export class Contact {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Workspace', required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ type: String, default: '' })
  firstName!: string;

  @Prop({ type: String, default: '' })
  lastName!: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  fullName!: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, default: null, trim: true })
  phone!: string | null;

  @Prop({ type: String, required: true, select: false })
  emailNormalized!: string;

  @Prop({ type: String, default: null, select: false })
  phoneNormalized!: string | null;

  @Prop({ type: String, default: '' })
  company!: string;

  @Prop({ type: String, default: '' })
  category!: string;

  @Prop({ type: [String], default: [] })
  labels!: string[];

  // Legacy compatibility field. Use `labels` in new code.
  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  customFields!: Record<string, unknown>;

  @Prop({
    type: String,
    enum: CONTACT_EMAIL_STATUS_VALUES,
    default: ContactEmailStatus.UNKNOWN,
  })
  emailStatus!: ContactEmailStatus;

  @Prop({
    type: String,
    enum: CONTACT_WHATSAPP_STATUS_VALUES,
    default: ContactWhatsappStatus.UNKNOWN,
  })
  whatsappStatus!: ContactWhatsappStatus;

  @Prop({
    type: String,
    enum: CONTACT_SUBSCRIPTION_STATUS_VALUES,
    default: ContactSubscriptionStatus.SUBSCRIBED,
  })
  subscriptionStatus!: ContactSubscriptionStatus;

  @Prop({ type: String, enum: CONTACT_SOURCE_VALUES, default: ContactSource.MANUAL })
  source!: ContactSource;

  @Prop({ type: String, default: '' })
  notes!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ContactDocument = HydratedDocument<Contact>;
export const ContactSchema = SchemaFactory.createForClass(Contact);

ContactSchema.index(
  { workspaceId: 1, emailNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: {
      emailNormalized: { $type: 'string', $exists: true, $ne: '' },
    },
  },
);

ContactSchema.index({ workspaceId: 1, phoneNormalized: 1 });

ContactSchema.index({ workspaceId: 1, tags: 1 });
ContactSchema.index({ workspaceId: 1, category: 1 });
ContactSchema.index({ workspaceId: 1, labels: 1 });
ContactSchema.index({ workspaceId: 1, fullName: 1 });
ContactSchema.index({ workspaceId: 1, createdAt: -1 });
