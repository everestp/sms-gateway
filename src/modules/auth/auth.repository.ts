import { PrismaClient, User } from "@prisma/client";

export interface IAuthRepository {
  findByEmail(email: string): Promise<User | null>;
  create(
    email: string,
    passwordHash: string,
    initialCredits: number,
  ): Promise<User>;
}

export class AuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(
    email: string,
    passwordHash: string,
    initialCredits = 100,
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
        wallet: {
          create: {
            credits: initialCredits,
          },
        },
      },
    });
  }
}
