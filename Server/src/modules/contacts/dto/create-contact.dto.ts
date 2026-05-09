import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ContactEmailStatus,
  ContactSource,
  ContactSubscriptionStatus,
  ContactWhatsappStatus,
} from '../constants/contact.enums';


export class CreateContactDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  readonly firstName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  readonly lastName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  readonly fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  readonly email?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(30)
  readonly phone?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  readonly company?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  readonly category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean);
    }

    return value;
  })
  @IsArray()
  @IsString({ each: true })
  readonly labels?: string[];

  @IsOptional()
  @IsObject()
  readonly customFields?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(ContactEmailStatus)
  readonly emailStatus?: ContactEmailStatus;

  @IsOptional()
  @IsEnum(ContactWhatsappStatus)
  readonly whatsappStatus?: ContactWhatsappStatus;

  @IsOptional()
  @IsEnum(ContactSubscriptionStatus)
  readonly subscriptionStatus?: ContactSubscriptionStatus;

  @IsOptional()
  @IsEnum(ContactSource)
  readonly source?: ContactSource;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  readonly notes?: string;
}

