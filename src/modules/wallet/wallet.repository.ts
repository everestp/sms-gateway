import { PrismaClient, Prisma, Wallet } from "@prisma/client";

export interface IWalletRepository {
  findByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Wallet | null>;
  getWalletForUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ id: string; credits: number } | null>;
  deductCredits(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
  ): Promise<Wallet>;
  refundCredits(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
  ): Promise<Wallet>;
}

export class WalletRepository implements IWalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prisma;
  }

  async findByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Wallet | null> {
    return this.getClient(tx).wallet.findUnique({
      where: { userId },
    });
  }

  /**
   * Acquires a row-level lock on the user's wallet record.
   * Any concurrent request attempting to access this wallet row will block until
   * the active transaction commits or rolls back, preventing double-spending.
   */
  async getWalletForUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ id: string; credits: number } | null> {
    const wallets = await tx.$queryRaw<Array<{ id: string; credits: number }>>`
      SELECT id, credits FROM "wallets" WHERE "user_id" = ${userId} FOR UPDATE
    `;

    return wallets.length > 0 ? wallets[0] : null;
  }

  async deductCredits(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
  ): Promise<Wallet> {
    return tx.wallet.update({
      where: { id: walletId },
      data: {
        credits: {
          decrement: amount,
        },
      },
    });
  }

  async refundCredits(
    tx: Prisma.TransactionClient,
    walletId: string,
    amount: number,
  ): Promise<Wallet> {
    return tx.wallet.update({
      where: { id: walletId },
      data: {
        credits: {
          increment: amount,
        },
      },
    });
  }
}
