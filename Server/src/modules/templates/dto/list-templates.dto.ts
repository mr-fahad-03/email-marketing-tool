import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  TemplateCategory,
  TemplateChannelType,
  TemplateEditorType,
  TemplateStatus,
  TemplateVisibility,
} from '../constants/template.enums';

export class ListTemplatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;

  @IsOptional()
  @IsEnum(TemplateChannelType)
  readonly channelType?: TemplateChannelType;

  @IsOptional()
  @IsEnum(TemplateCategory)
  readonly category?: TemplateCategory;

  @IsOptional()
  @IsEnum(TemplateStatus)
  readonly status?: TemplateStatus;

  @IsOptional()
  @IsEnum(TemplateVisibility)
  readonly visibility?: TemplateVisibility;

  @IsOptional()
  @IsEnum(TemplateEditorType)
  readonly editorType?: TemplateEditorType;

  @IsOptional()
  @IsString()
  readonly search?: string;
}
