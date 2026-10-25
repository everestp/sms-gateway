import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const defaultPassword = "Password123!";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: "test@nestnepal.com" },
    update: {},
    create: {
      email: "test@nestnepal.com",
      password: hashedPassword,
      wallet: {
        create: {
          credits: 20,
        },
      },
    },
    include: {
      wallet: true,
    },
  });

  console.log(
    `Seeded test user: ${user.email} (Wallet credits: ${user.wallet?.credits})`,
  );
  console.log(
    `Credentials: Email: test@nestnepal.com | Password: ${defaultPassword}`,
  );
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
