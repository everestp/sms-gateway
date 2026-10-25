export interface ISmsProvider {
  readonly name: string;
  readonly priority: number;
  getBalance(): Promise<number>;
  send(to: string, message: string): Promise<boolean>;
}
