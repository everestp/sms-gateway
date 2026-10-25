import { Router } from "express";
import { SmsController } from "./sms.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

export const createSmsRouter = (smsController: SmsController): Router => {
  const router = Router();

  router.use(authMiddleware);

  router.post("/send", (req, res, next) => smsController.send(req, res, next));
  router.get("/logs", (req, res, next) =>
    smsController.getLogs(req, res, next),
  );

  return router;
};
