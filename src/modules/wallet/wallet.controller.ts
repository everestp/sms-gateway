import { Response, NextFunction } from "express";
import { WalletService } from "./wallet.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";

export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  async getBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const balanceData = await this.walletService.getUserBalance(
        req.user.userId,
      );

      return res.status(200).json({
        success: true,
        message: "Wallet balance retrieved successfully",
        data: balanceData,
      });
    } catch (err) {
      next(err);
    }
  }
}
