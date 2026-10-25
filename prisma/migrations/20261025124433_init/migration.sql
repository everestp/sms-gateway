-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "encoding" TEXT NOT NULL,
    "segments" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "route_used" TEXT,
    "failure_trail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_audits" (
    "id" TEXT NOT NULL,
    "route_name" TEXT NOT NULL,
    "is_success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "message_logs_status_idx" ON "message_logs"("status");

-- CreateIndex
CREATE INDEX "message_logs_created_at_idx" ON "message_logs"("created_at");

-- CreateIndex
CREATE INDEX "message_logs_recipient_idx" ON "message_logs"("recipient");

-- CreateIndex
CREATE INDEX "route_audits_route_name_created_at_idx" ON "route_audits"("route_name", "created_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
