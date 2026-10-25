import { ISmsProvider } from "./provider.interface";

export class RouteAProvider implements ISmsProvider {
  public readonly name = "ROUTE_A";
  public readonly priority = 1;
  private balance = 1000;
  private readonly failureRate = 0.3; // 30% failure rate

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
