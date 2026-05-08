import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListTemplateImagesDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly folderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  readonly search?: string;
}
