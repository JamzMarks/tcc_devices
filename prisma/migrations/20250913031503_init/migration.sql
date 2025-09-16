-- CreateTable
CREATE TABLE "public"."Semaforo" (
    "id" SERIAL NOT NULL,
    "macAddress" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "packId" INTEGER,

    CONSTRAINT "Semaforo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Camera" (
    "id" SERIAL NOT NULL,
    "macAddress" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pack" (
    "id" SERIAL NOT NULL,
    "node" TEXT NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Semaforo_macAddress_key" ON "public"."Semaforo"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Camera_macAddress_key" ON "public"."Camera"("macAddress");

-- AddForeignKey
ALTER TABLE "public"."Semaforo" ADD CONSTRAINT "Semaforo_packId_fkey" FOREIGN KEY ("packId") REFERENCES "public"."Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
