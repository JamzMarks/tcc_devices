-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('Semaforo', 'Camera');

-- CreateTable
CREATE TABLE "public"."PendingDeletionDevice" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "resource" "public"."DeviceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingDeletionDevice_pkey" PRIMARY KEY ("id")
);
