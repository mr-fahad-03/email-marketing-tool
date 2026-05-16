import { IsArray, IsString } from 'class-validator';

export class CheckDuplicatesDto {
  @IsArray()
  @IsString({ each: true })
  emails!: string[];
}
