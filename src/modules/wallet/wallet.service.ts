import { IWalletRepository } from "./wallet.repository";
import { AppError } from "../../middlewares/error.middleware";

export class WalletService {
  constructor(private readonly walletRepo: IWalletRepository) {}

  async getUserBalance(userId: string): Promise<{ credits: number }> {
    const wallet = await this.walletRepo.findByUserId(userId);

    if (!wallet) {
      throw new AppError("Wallet not found for this user", 404);
    }

    return {
      credits: wallet.credits,
    };
  }
}
