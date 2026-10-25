import { PrismaClient } from "@prisma/client";

export interface IProviderRepository {
  recordAudit(routeName: string, isSuccess: boolean): Promise<void>;
  get24hStats(
    routeName: string,
  ): Promise<{ total: number; successful: number }>;
}

export class ProviderRepository implements IProviderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordAudit(routeName: string, isSuccess: boolean): Promise<void> {
    await this.prisma.routeAudit.create({
      data: {
        routeName,
        isSuccess,
      },
    });
  }

  async get24hStats(
    routeName: string,
  ): Promise<{ total: number; successful: number }> {
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const total = await this.prisma.routeAudit.count({
      where: {
        routeName,
        createdAt: { gte: past24h },
      },
    });

    const successful = await this.prisma.routeAudit.count({
      where: {
        routeName,
        isSuccess: true,
        createdAt: { gte: past24h },
      },
    });

    return { total, successful };
  }
}
