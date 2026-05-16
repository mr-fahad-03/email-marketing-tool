import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkDeleteContactsDto } from './dto/bulk-delete-contacts.dto';
import { BulkCategoryUpdateDto } from './dto/bulk-category-update.dto';
import { BulkTagUpdateDto } from './dto/bulk-tag-update.dto';
import { CheckDuplicatesDto } from './dto/check-duplicates.dto';
import { CreateContactCategoryDto } from './dto/create-contact-category.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactsService } from './contacts.service';
import {
  ContactCategorySummaryResponse,
  ContactImportResultResponse,
  ContactListResponse,
  ContactResponse,
} from './types/contact.response';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post('check-duplicates')
  checkDuplicates(
    @Body() dto: CheckDuplicatesDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<string[]> {
    return this.contactsService.checkDuplicates(dto, authUser);
  }

  @Post()
  create(
    @Body() dto: CreateContactDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactResponse> {
    return this.contactsService.create(dto, authUser);
  }

  @Post('categories')
  createCategory(
    @Body() dto: CreateContactCategoryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ category: string }> {
    return this.contactsService.createCategory(dto, authUser);
  }

  @Get()
  findAll(
    @Query() query: ListContactsDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactListResponse> {
    return this.contactsService.findAll(query, authUser);
  }

  @Get('categories/summary')
  getCategorySummary(
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactCategorySummaryResponse> {
    return this.contactsService.getCategorySummary(authUser);
  }

  @Delete('categories/:category')
  removeCategory(
    @Param('category') category: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ category: string; modified: number }> {
    return this.contactsService.removeCategory(category, authUser);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactResponse> {
    return this.contactsService.findOne(id, authUser);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactResponse> {
    return this.contactsService.update(id, dto, authUser);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ deleted: true; id: string }> {
    return this.contactsService.remove(id, authUser);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importContacts(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportContactsDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<ContactImportResultResponse> {
    return this.contactsService.importCsv(file, dto, authUser);
  }

  @Post('bulk-labels')
  bulkLabelUpdate(
    @Body() dto: BulkTagUpdateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ requested: number; modified: number }> {
    return this.contactsService.bulkTagUpdate(dto, authUser);
  }

  @Post('bulk-category')
  bulkCategoryUpdate(
    @Body() dto: BulkCategoryUpdateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ requested: number; modified: number }> {
    return this.contactsService.bulkCategoryUpdate(dto, authUser);
  }

  @Post('bulk-tags')
  bulkTagUpdate(
    @Body() dto: BulkTagUpdateDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ requested: number; modified: number }> {
    return this.contactsService.bulkTagUpdate(dto, authUser);
  }

  @Post('bulk-delete')
  bulkDelete(
    @Body() dto: BulkDeleteContactsDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<{ requested: number; deleted: number }> {
    return this.contactsService.bulkDelete(dto, authUser);
  }
}
