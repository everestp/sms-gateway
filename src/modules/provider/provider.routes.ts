import { Router } from "express";
import { ProviderController } from "./provider.controller";

export const createProviderRouter = (
  controller: ProviderController,
): Router => {
  const router = Router();

  router.get("/health", (req, res, next) =>
    controller.getHealth(req, res, next),
  );

  return router;
};
