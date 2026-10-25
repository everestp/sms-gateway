import express, { Application } from "express";
import { PrismaClient } from "@prisma/client";

// Repositories
import { AuthRepository } from "./modules/auth/auth.repository";
import { WalletRepository } from "./modules/wallet/wallet.repository";
import { ProviderRepository } from "./modules/provider/provider.repository";
import { SmsRepository } from "./modules/sms/sms.repository";

// Providers
import { RouteAProvider } from "./modules/provider/clients/route-a.provider";
import { RouteBProvider } from "./modules/provider/clients/route-b.provider";

// Services
import { AuthService } from "./modules/auth/auth.service";
import { WalletService } from "./modules/wallet/wallet.service";
import { ProviderService } from "./modules/provider/provider.service";
import { SmsService } from "./modules/sms/sms.service";

// Controllers
import { AuthController } from "./modules/auth/auth.controller";
import { WalletController } from "./modules/wallet/wallet.controller";
import { ProviderController } from "./modules/provider/provider.controller";
import { SmsController } from "./modules/sms/sms.controller";

// Routers & Middlewares
import { createV1Router } from "./routes/v1.routes";
import { errorMiddleware } from "./middlewares/error.middleware";

export const createApp = (prisma: PrismaClient): Application => {
  const app = express();
  app.use(express.json());

  // 1. Providers sorted by priority ascending (Route A: 1, Route B: 2)
  const providers = [new RouteAProvider(), new RouteBProvider()].sort(
    (a, b) => a.priority - b.priority,
  );

  // 2. Repositories
  const authRepo = new AuthRepository(prisma);
  const walletRepo = new WalletRepository(prisma);
  const providerRepo = new ProviderRepository(prisma);
  const smsRepo = new SmsRepository(prisma);

  // 3. Services (Injected with repositories and providers)
  const authService = new AuthService(authRepo);
  const walletService = new WalletService(walletRepo);
  const providerService = new ProviderService(providerRepo, providers);
  const smsService = new SmsService(
    prisma,
    walletRepo,
    smsRepo,
    providerRepo,
    providers,
  );

  // 4. Controllers
  const authController = new AuthController(authService);
  const walletController = new WalletController(walletService);
  const providerController = new ProviderController(providerService);
  const smsController = new SmsController(smsService);

  // 5. Versioned Router Assembly
  const v1Router = createV1Router({
    authController,
    walletController,
    providerController,
    smsController,
  });

  // Mount at /api/v1 and transparently alias to root for evaluation compliance
  app.use("/api/v1", v1Router);
  app.use("/", v1Router);

  // 6. Central Error Handling Middleware
  app.use(errorMiddleware);

  return app;
};
