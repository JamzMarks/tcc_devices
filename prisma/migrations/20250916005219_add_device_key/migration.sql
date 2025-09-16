/*
  Warnings:

  - Added the required column `deviceKey` to the `Camera` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceKey` to the `Semaforo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Camera" ADD COLUMN     "deviceKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Semaforo" ADD COLUMN     "deviceKey" TEXT NOT NULL;
