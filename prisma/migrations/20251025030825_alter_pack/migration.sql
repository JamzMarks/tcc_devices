/*
  Warnings:

  - You are about to drop the column `node` on the `Pack` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[deviceId]` on the table `Camera` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cicle` to the `Pack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Pack` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."SubPack" DROP CONSTRAINT "SubPack_packId_fkey";

-- DropIndex
DROP INDEX "public"."Camera_macAddress_key";

-- AlterTable
ALTER TABLE "public"."Camera" ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Pack" DROP COLUMN "node",
ADD COLUMN     "cicle" INTEGER NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Semaforo" ALTER COLUMN "isActive" SET DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Camera_deviceId_key" ON "public"."Camera"("deviceId");

-- AddForeignKey
ALTER TABLE "public"."SubPack" ADD CONSTRAINT "SubPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "public"."Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
