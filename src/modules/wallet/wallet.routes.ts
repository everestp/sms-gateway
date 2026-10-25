import { Router } from "express";
import { WalletController } from "./wallet.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const createWalletRouter = (
  walletController: WalletController,
): Router => {
  const router = Router();

  // All wallet actions require a valid Bearer token
  router.use(authMiddleware);

  router.get("/balance", (req, res, next) =>
    walletController.getBalance(req, res, next),
  );

  return router;
};
