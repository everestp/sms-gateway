import { Router } from "express";
import { AuthController } from "./auth.controller";

export const createAuthRouter = (authController: AuthController): Router => {
  const router = Router();

  router.post("/register", (req, res, next) =>
    authController.register(req, res, next),
  );
  router.post("/login", (req, res, next) =>
    authController.login(req, res, next),
  );

  return router;
};
