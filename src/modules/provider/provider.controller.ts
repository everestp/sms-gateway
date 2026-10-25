import { Request, Response, NextFunction } from "express";
import { ProviderService } from "./provider.service";

export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  async getHealth(_req: Request, res: Response, next: NextFunction) {
    try {
      const healthData = await this.providerService.getRoutesHealth();

      return res.status(200).json({
        success: true,
        message: "Routes health metrics retrieved successfully",
        data: healthData,
      });
    } catch (err) {
      next(err);
    }
  }
}
