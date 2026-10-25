import { Response, NextFunction } from "express";
import { SmsService } from "./sms.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";

export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const { to, message } = req.body;
      const results = await this.smsService.sendBulkSms(
        req.user.userId,
        to,
        message,
      );

      return res.status(200).json({
        success: true,
        message: "SMS dispatch completed",
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

  async getLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.userId) {
        throw new AppError("Unauthorized access", 401);
      }

      const logsData = await this.smsService.getLogs(
        req.user.userId,
        req.query,
      );

      return res.status(200).json({
        success: true,
        message: "SMS logs retrieved successfully",
        data: logsData,
      });
    } catch (err) {
      next(err);
    }
  }
}
