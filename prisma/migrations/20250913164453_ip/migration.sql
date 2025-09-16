/*
  Warnings:

  - Added the required column `ip` to the `Camera` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ip` to the `Semaforo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Camera" ADD COLUMN     "ip" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Semaforo" ADD COLUMN     "ip" TEXT NOT NULL,
ADD COLUMN     "subPackId" INTEGER;

-- CreateTable
CREATE TABLE "public"."SubPack" (
    "id" SERIAL NOT NULL,
    "node" TEXT NOT NULL,
    "packId" INTEGER NOT NULL,

    CONSTRAINT "SubPack_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Semaforo" ADD CONSTRAINT "Semaforo_subPackId_fkey" FOREIGN KEY ("subPackId") REFERENCES "public"."SubPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubPack" ADD CONSTRAINT "SubPack_packId_fkey" FOREIGN KEY ("packId") REFERENCES "public"."Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
