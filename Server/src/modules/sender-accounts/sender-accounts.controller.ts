import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSenderAccountDto } from './dto/create-sender-account.dto';
import { ListSenderAccountsDto } from './dto/list-sender-accounts.dto';
import { UpdateSenderAccountDto } from './dto/update-sender-account.dto';
import { SenderAccountsService } from './sender-accounts.service';
import {
  SenderAccountResponse,
  SenderAccountSmtpPasswordResponse,
  SenderAccountTestResponse,
} from './types/sender-account.response';

@Controller('sender-accounts')
@UseGuards(JwtAuthGuard)
export class SenderAccountsController {
  constructor(private readonly senderAccountsService: SenderAccountsService) {}

  @Post()
  create(
    @Body() dto: CreateSenderAccountDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountResponse> {
    return this.senderAccountsService.create(dto, authUser);
  }

  @Get()
  findAll(
    @Query() query: ListSenderAccountsDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountResponse[]> {
    return this.senderAccountsService.findAll(query, authUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountResponse> {
    return this.senderAccountsService.findOne(id, authUser);
  }

  @Get(':id/reveal-smtp-password')
  revealSmtpPassword(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountSmtpPasswordResponse> {
    return this.senderAccountsService.revealSmtpPassword(id, authUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateSenderAccountDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountResponse> {
    return this.senderAccountsService.update(id, dto, authUser);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    return this.senderAccountsService.remove(id, authUser);
  }

  @Post(':id/test')
  test(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<SenderAccountTestResponse> {
    return this.senderAccountsService.test(id, authUser);
  }
}
