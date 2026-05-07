import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class RenderMjmlDto {
  @Transform(({ value }) => (typeof value === 'string' ? value : String(value ?? '')))
  @IsString()
  @MinLength(1)
  readonly mjml!: string;
}
