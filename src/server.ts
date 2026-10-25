import { createApp } from "./app";
import { prisma } from "./config/prisma";
import { ENV } from "./config/env";

const app = createApp(prisma);

const server = app.listen(ENV.PORT, () => {
  console.log(`Mini SMS Gateway running on port ${ENV.PORT}`);
  console.log(`Routes mounted at /api/v1 and /`);
});

const handleGracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("Database connections closed. Gateway stopped cleanly.");
    process.exit(0);
  });
};

process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
