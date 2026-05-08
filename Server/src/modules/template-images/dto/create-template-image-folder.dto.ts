import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTemplateImageFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  readonly name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly parentId?: string;
}
