import { Router } from "express";
import { AuthController } from "../modules/auth/auth.controller";
import { WalletController } from "../modules/wallet/wallet.controller";
import { ProviderController } from "../modules/provider/provider.controller";
import { SmsController } from "../modules/sms/sms.controller";

import { createAuthRouter } from "../modules/auth/auth.routes";
import { createWalletRouter } from "../modules/wallet/wallet.routes";
import { createProviderRouter } from "../modules/provider/provider.routes";
import { createSmsRouter } from "../modules/sms/sms.routes";

interface V1RouterDependencies {
  authController: AuthController;
  walletController: WalletController;
  providerController: ProviderController;
  smsController: SmsController;
}

export const createV1Router = (deps: V1RouterDependencies): Router => {
  const router = Router();

  router.use("/auth", createAuthRouter(deps.authController));
  router.use("/wallet", createWalletRouter(deps.walletController));
  router.use("/routes", createProviderRouter(deps.providerController));
  router.use("/sms", createSmsRouter(deps.smsController));

  return router;
};
