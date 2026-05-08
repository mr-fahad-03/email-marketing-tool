import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadTemplateImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly folderId?: string;
}
