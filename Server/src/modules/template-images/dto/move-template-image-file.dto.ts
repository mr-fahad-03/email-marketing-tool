import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MoveTemplateImageFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly folderId?: string;
}
