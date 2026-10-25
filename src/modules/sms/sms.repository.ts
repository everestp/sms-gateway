import { PrismaClient, Prisma, MessageStatus } from "@prisma/client";

export interface CreateMessageLogInput {
  userId: string;
  recipient: string;
  message: string;
  encoding: string;
  segments: number;
  cost: number;
  status: MessageStatus;
  routeUsed?: string;
  failureTrail?: string;
}

export interface GetLogsFilter {
  userId: string;
  page: number;
  limit: number;
  status?: MessageStatus;
  recipient?: string;
  date?: string;
}

export interface ISmsRepository {
  createLog(
    data: CreateMessageLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  getLogs(
    filter: GetLogsFilter,
  ): Promise<{ total: number; page: number; limit: number; logs: any[] }>;
}

export class SmsRepository implements ISmsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prisma;
  }

  async createLog(
    data: CreateMessageLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).messageLog.create({
      data: {
        userId: data.userId,
        recipient: data.recipient,
        message: data.message,
        encoding: data.encoding,
        segments: data.segments,
        cost: data.cost,
        status: data.status,
        routeUsed: data.routeUsed,
        failureTrail: data.failureTrail,
      },
    });
  }

  async getLogs(
    filter: GetLogsFilter,
  ): Promise<{ total: number; page: number; limit: number; logs: any[] }> {
    const { userId, page, limit, status, recipient, date } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.MessageLogWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    if (recipient) {
      where.recipient = { contains: recipient };
    }

    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const startOfDay = new Date(parsedDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(parsedDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        where.createdAt = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.messageLog.count({ where }),
      this.prisma.messageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { total, page, limit, logs };
  }
}
