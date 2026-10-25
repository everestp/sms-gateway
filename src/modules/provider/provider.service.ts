import { ISmsProvider } from "./clients/provider.interface";
import { IProviderRepository } from "./provider.repository";

export interface RouteHealthReport {
  route: string;
  priority: number;
  balance: number;
  successRate24h: string;
  healthPercentage: string;
}

export class ProviderService {
  constructor(
    private readonly providerRepo: IProviderRepository,
    private readonly providers: ISmsProvider[],
  ) {}

  async getRoutesHealth(): Promise<RouteHealthReport[]> {
    const report: RouteHealthReport[] = [];
    const targetSafeThreshold = 500;

    for (const provider of this.providers) {
      const balance = await provider.getBalance();
      const stats = await this.providerRepo.get24hStats(provider.name);

      const successRate =
        stats.total === 0 ? 100 : (stats.successful / stats.total) * 100;
      const balanceFactor = Math.min(
        100,
        (balance / targetSafeThreshold) * 100,
      );

      // Formula: (24h Success Rate * 0.7) + (Balance Factor * 0.3)
      const healthScore = successRate * 0.7 + balanceFactor * 0.3;

      report.push({
        route: provider.name,
        priority: provider.priority,
        balance,
        successRate24h: `${successRate.toFixed(2)}%`,
        healthPercentage: `${healthScore.toFixed(2)}%`,
      });
    }

    return report;
  }
}
