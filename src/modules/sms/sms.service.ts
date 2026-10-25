import { PrismaClient, MessageStatus } from "@prisma/client";
import { IWalletRepository } from "../wallet/wallet.repository";
import { ISmsRepository } from "./sms.repository";
import { IProviderRepository } from "../provider/provider.repository";
import { ISmsProvider } from "../provider/clients/provider.interface";
import { PhoneNormalizer } from "./utils/phone-normalizer";
import { SegmentCounter } from "./utils/segment-counter";
import { AppError } from "../../middlewares/error.middleware";

export interface SendSmsResult {
  recipient: string;
  status: "SENT" | "FAILED";
  route?: string;
  refundedCredits?: number;
  failureTrail?: string;
}

export class SmsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly walletRepo: IWalletRepository,
    private readonly smsRepo: ISmsRepository,
    private readonly providerRepo: IProviderRepository,
    private readonly providers: ISmsProvider[],
  ) {}

  async sendBulkSms(
    userId: string,
    rawRecipients: string[],
    message: string,
  ): Promise<SendSmsResult[]> {
    if (
      !rawRecipients ||
      !Array.isArray(rawRecipients) ||
      rawRecipients.length === 0
    ) {
      throw new AppError(
        'The "to" field must contain at least one phone number',
        400,
      );
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      throw new AppError('The "message" field cannot be empty', 400);
    }

    // 1. Validate & Normalize Numbers[cite: 3, 4]
    const normalizedRecipients = rawRecipients.map((phone) =>
      PhoneNormalizer.normalize(phone),
    );
    const invalidNumbers = normalizedRecipients
      .filter((item) => !item.isValid)
      .map((item) => item.raw);

    if (invalidNumbers.length > 0) {
      throw new AppError(
        `Invalid Nepali phone numbers detected: ${invalidNumbers.join(", ")}`,
        400,
      );
    }

    // 2. Calculate Segments and Upfront Required Credits[cite: 3, 4]
    const { encoding, segments } = SegmentCounter.calculate(message);
    const costPerRecipient = segments;
    const totalRequiredCredits = costPerRecipient * normalizedRecipients.length;

    // 3. Concurrency-Safe Upfront Wallet Deduction via Transaction & Row Lock[cite: 2, 4]
    let lockedWalletId = "";
    await this.prisma.$transaction(async (tx) => {
      const wallet = await this.walletRepo.getWalletForUpdate(tx, userId);

      if (!wallet) {
        throw new AppError("Wallet not found", 404);
      }

      if (wallet.credits < totalRequiredCredits) {
        throw new AppError(
          `Insufficient credits. Required: ${totalRequiredCredits}, Available: ${wallet.credits}`,
          400,
        );
      }

      lockedWalletId = wallet.id;
      await this.walletRepo.deductCredits(tx, wallet.id, totalRequiredCredits);
    });

    const results: SendSmsResult[] = [];

    // 4. Dispatch Loop with Priority Route Failover[cite: 4]
    for (const item of normalizedRecipients) {
      let isDelivered = false;
      let activeRouteName = "";
      const failureReasons: string[] = [];

      for (const provider of this.providers) {
        const balance = await provider.getBalance();
        if (balance <= 0) {
          failureReasons.push(`${provider.name}: No Balance`);
          continue;
        }

        const isSuccess = await provider.send(item.normalized, message);
        await this.providerRepo.recordAudit(provider.name, isSuccess);

        if (isSuccess) {
          isDelivered = true;
          activeRouteName = provider.name;
          break;
        }

        failureReasons.push(`${provider.name}: Network Drop`);
      }

      // 5. Automated Refund if All Routes Fail[cite: 4]
      if (!isDelivered) {
        await this.prisma.$transaction(async (tx) => {
          await this.walletRepo.refundCredits(
            tx,
            lockedWalletId,
            costPerRecipient,
          );
        });

        const failureTrail = failureReasons.join(" -> ");

        await this.smsRepo.createLog({
          userId,
          recipient: item.normalized,
          message,
          encoding,
          segments,
          cost: costPerRecipient,
          status: MessageStatus.FAILED,
          failureTrail,
        });

        results.push({
          recipient: item.normalized,
          status: "FAILED",
          refundedCredits: costPerRecipient,
          failureTrail,
        });
      } else {
        await this.smsRepo.createLog({
          userId,
          recipient: item.normalized,
          message,
          encoding,
          segments,
          cost: costPerRecipient,
          status: MessageStatus.SENT,
          routeUsed: activeRouteName,
        });

        results.push({
          recipient: item.normalized,
          status: "SENT",
          route: activeRouteName,
        });
      }
    }

    return results;
  }

  async getLogs(userId: string, query: any) {
    const page = Math.max(1, parseInt(query.page as string, 10) || 1);
    const limit = Math.max(
      1,
      Math.min(100, parseInt(query.limit as string, 10) || 10),
    );

    let status: MessageStatus | undefined;
    if (query.status) {
      const uppercaseStatus = (query.status as string).toUpperCase();
      if (["PENDING", "SENT", "FAILED"].includes(uppercaseStatus)) {
        status = uppercaseStatus as MessageStatus;
      }
    }

    return this.smsRepo.getLogs({
      userId,
      page,
      limit,
      status,
      recipient: query.recipient ? String(query.recipient).trim() : undefined,
      date: query.date ? String(query.date).trim() : undefined,
    });
  }
}
