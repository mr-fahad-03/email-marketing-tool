import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProviderTemplatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  readonly limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly page?: number;

  @IsOptional()
  @IsString()
  readonly search?: string;

  @IsOptional()
  @IsString()
  readonly category?: string;
}
