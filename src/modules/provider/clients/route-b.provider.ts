import { ISmsProvider } from "./provider.interface";

export class RouteBProvider implements ISmsProvider {
  public readonly name = "ROUTE_B";
  public readonly priority = 2;
  private balance = 500;
  private readonly failureRate = 0.05; // 5% failure rate

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async send(_to: string, _message: string): Promise<boolean> {
    if (this.balance <= 0) {
      return false;
    }

    if (Math.random() < this.failureRate) {
      return false;
    }

    this.balance -= 1;
    return true;
  }
}
