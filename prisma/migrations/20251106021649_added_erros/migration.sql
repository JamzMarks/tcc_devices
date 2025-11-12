/*
  Warnings:

  - Added the required column `error` to the `PendingDeletionDevice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."PendingDeletionDevice" ADD COLUMN     "error" TEXT NOT NULL;
