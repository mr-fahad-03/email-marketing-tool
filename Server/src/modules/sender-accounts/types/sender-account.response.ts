import {
  EmailProviderType,
  SenderAccountStatus,
  SenderChannelType,
  SenderHealthStatus,
  SenderQualityStatus,
} from '../constants/sender-account.enums';

interface SenderAccountBaseResponse {
  id: string;
  workspaceId: string;
  channelType: SenderChannelType;
  name: string;
  status: SenderAccountStatus;
  lastTestedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EmailSenderAccountResponse extends SenderAccountBaseResponse {
  channelType: SenderChannelType.EMAIL;
  email: string;
  providerType: EmailProviderType;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string | null;
  secure: boolean;
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  healthStatus: SenderHealthStatus;
}

export interface WhatsappSenderAccountResponse extends SenderAccountBaseResponse {
  channelType: SenderChannelType.WHATSAPP;
  phoneNumber: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string | null;
  webhookVerifyToken: string | null;
  qualityStatus: SenderQualityStatus;
}

export type SenderAccountResponse = EmailSenderAccountResponse | WhatsappSenderAccountResponse;

export interface SenderAccountTestResponse {
  id: string;
  channelType: SenderChannelType;
  testedAt: Date;
  result: 'passed' | 'failed';
  details: string;
}

export interface SenderAccountSmtpPasswordResponse {
  smtpPass: string;
}
