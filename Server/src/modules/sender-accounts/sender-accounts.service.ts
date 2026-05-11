import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Transporter, createTransport } from 'nodemailer';
import { Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser } from '../../common/types/auth-user.type';
import { WorkspacesService } from '../workspaces/workspaces.service';
import {
  EmailProviderType,
  SenderAccountStatus,
  SenderChannelType,
  SenderHealthStatus,
  SenderQualityStatus,
} from './constants/sender-account.enums';
import { CreateSenderAccountDto } from './dto/create-sender-account.dto';
import { ListSenderAccountsDto } from './dto/list-sender-accounts.dto';
import { UpdateSenderAccountDto } from './dto/update-sender-account.dto';
import { SenderAccount, SenderAccountDocument } from './schemas/sender-account.schema';
import { SenderAccountSecretsService } from './sender-account-secrets.service';
import {
  SenderAccountResponse,
  SenderAccountSmtpPasswordResponse,
  SenderAccountTestResponse,
} from './types/sender-account.response';

@Injectable()
export class SenderAccountsService {
  constructor(
    @InjectModel(SenderAccount.name)
    private readonly senderAccountModel: Model<SenderAccount>,
    private readonly workspacesService: WorkspacesService,
    private readonly secretsService: SenderAccountSecretsService,
  ) {}

  async create(dto: CreateSenderAccountDto, authUser: AuthUser): Promise<SenderAccountResponse> {
    const workspaceId = await this.resolveWorkspaceId(dto.workspaceId, authUser);

    if (dto.channelType === SenderChannelType.EMAIL) {
      this.assertEmailCreatePayload(dto);
      this.assertDelayRange(dto.minDelaySeconds, dto.maxDelaySeconds);

      const created = await this.createEmailSenderAccount(dto, workspaceId);
      return this.toResponse(created, true);
    }

    this.assertWhatsappCreatePayload(dto);

    const created = await this.createWhatsappSenderAccount(dto, workspaceId);
    return this.toResponse(created, true);
  }

  async findAll(
    query: ListSenderAccountsDto,
    authUser: AuthUser,
  ): Promise<SenderAccountResponse[]> {
    const workspaceId = await this.resolveWorkspaceId(query.workspaceId, authUser);

    const filter: Record<string, unknown> = { workspaceId: this.toObjectId(workspaceId) };
    if (query.channelType) {
      filter.channelType = query.channelType;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const accounts = await this.senderAccountModel.find(filter).sort({ createdAt: -1 }).exec();

    return accounts.map((account) => this.toResponse(account, false));
  }

  async findOne(id: string, authUser: AuthUser): Promise<SenderAccountResponse> {
    const account = await this.findOwnedByWorkspace(id, authUser);
    return this.toResponse(account, false);
  }

  async update(
    id: string,
    dto: UpdateSenderAccountDto,
    authUser: AuthUser,
  ): Promise<SenderAccountResponse> {
    const account = await this.findOwnedByWorkspace(id, authUser, true);

    if (dto.name !== undefined) {
      account.name = dto.name;
    }

    if (dto.status !== undefined) {
      account.status = dto.status;
    }

    if (account.channelType === SenderChannelType.EMAIL) {
      this.assertNoWhatsappFieldsInEmailUpdate(dto);

      if (!account.email) {
        throw new AppException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'EMAIL_CONFIG_MISSING',
          'Email sender configuration is missing',
        );
      }

      if (dto.email !== undefined) {
        account.email.email = dto.email;
      }
      if (dto.providerType !== undefined) {
        account.email.providerType = dto.providerType;
      }
      if (dto.smtpHost !== undefined) {
        account.email.smtpHost = dto.smtpHost;
      }
      if (dto.smtpPort !== undefined) {
        account.email.smtpPort = dto.smtpPort;
      }
      if (dto.smtpUser !== undefined) {
        account.email.smtpUser = dto.smtpUser;
      }
      if (dto.secure !== undefined) {
        account.email.secure = dto.secure;
      }
      if (dto.dailyLimit !== undefined) {
        account.email.dailyLimit = dto.dailyLimit;
      }
      if (dto.hourlyLimit !== undefined) {
        account.email.hourlyLimit = dto.hourlyLimit;
      }
      if (dto.minDelaySeconds !== undefined) {
        account.email.minDelaySeconds = dto.minDelaySeconds;
      }
      if (dto.maxDelaySeconds !== undefined) {
        account.email.maxDelaySeconds = dto.maxDelaySeconds;
      }
      if (dto.healthStatus !== undefined) {
        account.email.healthStatus = dto.healthStatus;
      }

      this.assertDelayRange(account.email.minDelaySeconds, account.email.maxDelaySeconds);

      if (dto.smtpPass !== undefined) {
        account.secrets.smtpPassEncrypted = this.secretsService.encrypt(dto.smtpPass);
      }
    }

    if (account.channelType === SenderChannelType.WHATSAPP) {
      this.assertNoEmailFieldsInWhatsappUpdate(dto);

      if (!account.whatsapp) {
        throw new AppException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'WHATSAPP_CONFIG_MISSING',
          'WhatsApp sender configuration is missing',
        );
      }

      if (dto.phoneNumber !== undefined) {
        account.whatsapp.phoneNumber = dto.phoneNumber;
      }
      if (dto.businessAccountId !== undefined) {
        account.whatsapp.businessAccountId = dto.businessAccountId;
      }
      if (dto.phoneNumberId !== undefined) {
        account.whatsapp.phoneNumberId = dto.phoneNumberId;
      }
      if (dto.qualityStatus !== undefined) {
        account.whatsapp.qualityStatus = dto.qualityStatus;
      }
      if (dto.accessToken !== undefined) {
        account.secrets.accessTokenEncrypted = this.secretsService.encrypt(dto.accessToken);
      }
      if (dto.webhookVerifyToken !== undefined) {
        account.secrets.webhookVerifyTokenEncrypted = this.secretsService.encrypt(
          dto.webhookVerifyToken,
        );
      }
    }

    const saved = await this.saveWithDuplicateHandling(account);
    return this.toResponse(saved, true);
  }

  async remove(id: string, authUser: AuthUser): Promise<{ deleted: true; id: string }> {
    const account = await this.findOwnedByWorkspace(id, authUser);
    await this.senderAccountModel.deleteOne({ _id: account._id }).exec();

    return {
      deleted: true,
      id,
    };
  }

  async test(id: string, authUser: AuthUser): Promise<SenderAccountTestResponse> {
    const account = await this.findOwnedByWorkspace(id, authUser, true);

    if (account.channelType === SenderChannelType.EMAIL) {
      return this.testEmailAccount(account);
    }

    return this.testWhatsappAccount(account);
  }

  async revealSmtpPassword(
    id: string,
    authUser: AuthUser,
  ): Promise<SenderAccountSmtpPasswordResponse> {
    const account = await this.findOwnedByWorkspace(id, authUser, true);

    if (account.channelType !== SenderChannelType.EMAIL || !account.email) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SENDER_ACCOUNT_NOT_EMAIL',
        'SMTP password is only available for email sender accounts',
      );
    }

    const encryptedSmtpPass = account.secrets?.smtpPassEncrypted;
    if (!encryptedSmtpPass) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'SMTP_PASSWORD_NOT_SET',
        'SMTP password is not set for this sender account',
      );
    }

    return {
      smtpPass: this.secretsService.decrypt(encryptedSmtpPass),
    };
  }

  private async createEmailSenderAccount(
    dto: CreateSenderAccountDto,
    workspaceId: string,
  ): Promise<SenderAccountDocument> {
    const senderAccount = new this.senderAccountModel({
      workspaceId: this.toObjectId(workspaceId),
      channelType: SenderChannelType.EMAIL,
      name: dto.name,
      status: dto.status ?? SenderAccountStatus.ACTIVE,
      email: {
        email: dto.email,
        providerType: dto.providerType,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser,
        secure: dto.secure ?? false,
        dailyLimit: dto.dailyLimit ?? 1000,
        hourlyLimit: dto.hourlyLimit ?? 100,
        minDelaySeconds: dto.minDelaySeconds ?? 1,
        maxDelaySeconds: dto.maxDelaySeconds ?? 5,
        healthStatus: dto.healthStatus ?? SenderHealthStatus.UNKNOWN,
      },
      whatsapp: null,
      secrets: {
        smtpPassEncrypted: this.secretsService.encrypt(dto.smtpPass as string),
        accessTokenEncrypted: null,
        webhookVerifyTokenEncrypted: null,
      },
    });

    return this.saveWithDuplicateHandling(senderAccount);
  }

  private async createWhatsappSenderAccount(
    dto: CreateSenderAccountDto,
    workspaceId: string,
  ): Promise<SenderAccountDocument> {
    const senderAccount = new this.senderAccountModel({
      workspaceId: this.toObjectId(workspaceId),
      channelType: SenderChannelType.WHATSAPP,
      name: dto.name,
      status: dto.status ?? SenderAccountStatus.ACTIVE,
      email: null,
      whatsapp: {
        phoneNumber: dto.phoneNumber,
        businessAccountId: dto.businessAccountId,
        phoneNumberId: dto.phoneNumberId,
        qualityStatus: dto.qualityStatus ?? SenderQualityStatus.UNKNOWN,
      },
      secrets: {
        smtpPassEncrypted: null,
        accessTokenEncrypted: this.secretsService.encrypt(dto.accessToken as string),
        webhookVerifyTokenEncrypted: this.secretsService.encrypt(dto.webhookVerifyToken as string),
      },
    });

    return this.saveWithDuplicateHandling(senderAccount);
  }

  private async testEmailAccount(
    account: SenderAccountDocument,
  ): Promise<SenderAccountTestResponse> {
    if (!account.email || !account.secrets.smtpPassEncrypted) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'SMTP_CREDENTIALS_MISSING',
        'Email sender account is missing SMTP credentials',
      );
    }

    const smtpPass = this.secretsService.decrypt(account.secrets.smtpPassEncrypted);

    const transporter: Transporter = createTransport({
      host: account.email.smtpHost,
      port: account.email.smtpPort,
      secure: account.email.secure,
      auth: {
        user: account.email.smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    try {
      await transporter.verify();
      account.email.healthStatus = SenderHealthStatus.HEALTHY;
      account.lastTestedAt = new Date();
      await account.save();

      return {
        id: account.id,
        channelType: SenderChannelType.EMAIL,
        testedAt: account.lastTestedAt,
        result: 'passed',
        details: 'SMTP connection verified successfully',
      };
    } catch (error) {
      account.email.healthStatus = SenderHealthStatus.UNHEALTHY;
      account.lastTestedAt = new Date();
      await account.save();

      const message = error instanceof Error ? error.message : 'SMTP connection test failed';
      throw new AppException(HttpStatus.BAD_REQUEST, 'SMTP_TEST_FAILED', message);
    }
  }

  private async testWhatsappAccount(
    account: SenderAccountDocument,
  ): Promise<SenderAccountTestResponse> {
    if (!account.whatsapp || !account.secrets.accessTokenEncrypted) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_CREDENTIALS_MISSING',
        'WhatsApp sender account is missing credentials',
      );
    }

    const accessToken = this.secretsService.decrypt(account.secrets.accessTokenEncrypted);
    const endpoint = `https://graph.facebook.com/v20.0/${encodeURIComponent(
      account.whatsapp.phoneNumberId,
    )}?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(accessToken)}`;

    const response = await fetch(endpoint, { method: 'GET' });
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      const message = payload?.error?.message ?? 'WhatsApp credential test failed';
      account.lastTestedAt = new Date();
      await account.save();
      throw new AppException(HttpStatus.BAD_REQUEST, 'WHATSAPP_TEST_FAILED', message);
    }

    account.lastTestedAt = new Date();
    await account.save();

    return {
      id: account.id,
      channelType: SenderChannelType.WHATSAPP,
      testedAt: account.lastTestedAt,
      result: 'passed',
      details: 'WhatsApp credentials validated successfully',
    };
  }

  private async findOwnedByWorkspace(
    id: string,
    authUser: AuthUser,
    includeSecrets = false,
  ): Promise<SenderAccountDocument> {
    const workspaceId = await this.resolveWorkspaceId(undefined, authUser);
    const workspaceObjectId = this.toObjectId(workspaceId);

    const query = this.senderAccountModel.findOne({
      _id: this.toObjectId(id),
      workspaceId: workspaceObjectId,
    });

    if (includeSecrets) {
      query.select(
        '+secrets.smtpPassEncrypted +secrets.accessTokenEncrypted +secrets.webhookVerifyTokenEncrypted',
      );
    }

    const account = await query.exec();

    if (!account) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'SENDER_ACCOUNT_NOT_FOUND',
        'Sender account not found',
      );
    }

    return account;
  }

  private async resolveWorkspaceId(
    requestedWorkspaceId: string | undefined,
    authUser: AuthUser,
  ): Promise<string> {
    const authWorkspaceId = authUser.workspaceId;

    if (!requestedWorkspaceId && !authWorkspaceId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WORKSPACE_CONTEXT_REQUIRED',
        'workspaceId is required in token or request',
      );
    }

    if (requestedWorkspaceId && authWorkspaceId && requestedWorkspaceId !== authWorkspaceId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'WORKSPACE_ACCESS_DENIED',
        'You can only access sender accounts for your active workspace',
      );
    }

    const finalWorkspaceId = requestedWorkspaceId ?? authWorkspaceId;

    if (!finalWorkspaceId || !Types.ObjectId.isValid(finalWorkspaceId)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_WORKSPACE_ID', 'Invalid workspaceId');
    }

    const workspace = await this.workspacesService.findById(finalWorkspaceId);
    if (!workspace) {
      throw new AppException(HttpStatus.NOT_FOUND, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    return finalWorkspaceId;
  }

  private assertEmailCreatePayload(dto: CreateSenderAccountDto): void {
    const requiredFields: Array<keyof CreateSenderAccountDto> = [
      'email',
      'providerType',
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpPass',
    ];

    const missing = requiredFields.filter(
      (field) => dto[field] === undefined || dto[field] === null,
    );

    if (missing.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'EMAIL_FIELDS_REQUIRED',
        `Missing required email sender fields: ${missing.join(', ')}`,
      );
    }
  }

  private assertWhatsappCreatePayload(dto: CreateSenderAccountDto): void {
    const requiredFields: Array<keyof CreateSenderAccountDto> = [
      'phoneNumber',
      'businessAccountId',
      'phoneNumberId',
      'accessToken',
      'webhookVerifyToken',
    ];

    const missing = requiredFields.filter(
      (field) => dto[field] === undefined || dto[field] === null,
    );

    if (missing.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'WHATSAPP_FIELDS_REQUIRED',
        `Missing required WhatsApp sender fields: ${missing.join(', ')}`,
      );
    }
  }

  private assertDelayRange(minDelaySeconds?: number, maxDelaySeconds?: number): void {
    if (
      minDelaySeconds !== undefined &&
      maxDelaySeconds !== undefined &&
      maxDelaySeconds < minDelaySeconds
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_DELAY_RANGE',
        'maxDelaySeconds must be greater than or equal to minDelaySeconds',
      );
    }
  }

  private assertNoWhatsappFieldsInEmailUpdate(dto: UpdateSenderAccountDto): void {
    const invalidWhatsappFields: Array<keyof UpdateSenderAccountDto> = [
      'phoneNumber',
      'businessAccountId',
      'phoneNumberId',
      'accessToken',
      'webhookVerifyToken',
      'qualityStatus',
    ];

    const provided = invalidWhatsappFields.filter(
      (field) => dto[field] !== undefined && dto[field] !== null,
    );

    if (provided.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_WHATSAPP_FIELDS_FOR_EMAIL',
        `Cannot update WhatsApp fields for email sender account: ${provided.join(', ')}`,
      );
    }
  }

  private assertNoEmailFieldsInWhatsappUpdate(dto: UpdateSenderAccountDto): void {
    const invalidEmailFields: Array<keyof UpdateSenderAccountDto> = [
      'email',
      'providerType',
      'smtpHost',
      'smtpPort',
      'smtpUser',
      'smtpPass',
      'secure',
      'dailyLimit',
      'hourlyLimit',
      'minDelaySeconds',
      'maxDelaySeconds',
      'healthStatus',
    ];

    const provided = invalidEmailFields.filter(
      (field) => dto[field] !== undefined && dto[field] !== null,
    );

    if (provided.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'INVALID_EMAIL_FIELDS_FOR_WHATSAPP',
        `Cannot update email fields for WhatsApp sender account: ${provided.join(', ')}`,
      );
    }
  }

  private toResponse(
    account: SenderAccountDocument,
    includeSecretPresenceFromLoadedDoc: boolean,
  ): SenderAccountResponse {
    const base = {
      id: account.id,
      workspaceId: account.workspaceId.toString(),
      channelType: account.channelType,
      name: account.name,
      status: account.status,
      lastTestedAt: account.lastTestedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    if (account.channelType === SenderChannelType.EMAIL && account.email) {
      const hasSmtpPass = includeSecretPresenceFromLoadedDoc
        ? Boolean(account.secrets?.smtpPassEncrypted)
        : true;

      return {
        ...base,
        channelType: SenderChannelType.EMAIL,
        email: account.email.email,
        providerType: account.email.providerType as EmailProviderType,
        smtpHost: account.email.smtpHost,
        smtpPort: account.email.smtpPort,
        smtpUser: account.email.smtpUser,
        smtpPass: this.secretsService.maskSecret(hasSmtpPass),
        secure: account.email.secure,
        dailyLimit: account.email.dailyLimit,
        hourlyLimit: account.email.hourlyLimit,
        minDelaySeconds: account.email.minDelaySeconds,
        maxDelaySeconds: account.email.maxDelaySeconds,
        healthStatus: account.email.healthStatus,
      };
    }

    if (account.channelType === SenderChannelType.WHATSAPP && account.whatsapp) {
      const hasAccessToken = includeSecretPresenceFromLoadedDoc
        ? Boolean(account.secrets?.accessTokenEncrypted)
        : true;
      const hasWebhookVerifyToken = includeSecretPresenceFromLoadedDoc
        ? Boolean(account.secrets?.webhookVerifyTokenEncrypted)
        : true;

      return {
        ...base,
        channelType: SenderChannelType.WHATSAPP,
        phoneNumber: account.whatsapp.phoneNumber,
        businessAccountId: account.whatsapp.businessAccountId,
        phoneNumberId: account.whatsapp.phoneNumberId,
        accessToken: this.secretsService.maskSecret(hasAccessToken),
        webhookVerifyToken: this.secretsService.maskSecret(hasWebhookVerifyToken),
        qualityStatus: account.whatsapp.qualityStatus,
      };
    }

    throw new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INVALID_SENDER_ACCOUNT_STATE',
      'Sender account configuration is invalid for channel type',
    );
  }

  private async saveWithDuplicateHandling(
    account: SenderAccountDocument,
  ): Promise<SenderAccountDocument> {
    try {
      return await account.save();
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'SENDER_ACCOUNT_ALREADY_EXISTS',
          'A sender account with the same unique key already exists for this workspace',
        );
      }

      throw error;
    }
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ID', 'Invalid ObjectId');
    }

    return new Types.ObjectId(id);
  }
}
