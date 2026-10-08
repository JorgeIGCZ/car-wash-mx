/*
  Warnings:

  - A unique constraint covering the columns `[evidenceToken]` on the table `Wash` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Wash` ADD COLUMN `evidenceRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `evidenceRevokedAt` DATETIME(3) NULL,
    ADD COLUMN `evidenceToken` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `EvidenceVideo` (
    `id` VARCHAR(191) NOT NULL,
    `washId` INTEGER NOT NULL,
    `zone` ENUM('INTERIOR', 'EXTERIOR') NOT NULL,
    `activeSlot` VARCHAR(64) NULL,
    `requestKey` VARCHAR(36) NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `note` VARCHAR(1000) NULL,
    `status` ENUM('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED', 'SUPERSEDED') NOT NULL DEFAULT 'UPLOADING',
    `originalKey` VARCHAR(512) NOT NULL,
    `processedKey` VARCHAR(512) NULL,
    `contentType` VARCHAR(100) NOT NULL,
    `expectedBytes` INTEGER NOT NULL,
    `byteSize` INTEGER NULL,
    `durationSeconds` DOUBLE NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `originalEtag` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `uploadExpiresAt` DATETIME(3) NOT NULL,
    `uploadedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processingOwner` VARCHAR(64) NULL,
    `errorCode` VARCHAR(64) NULL,
    `originalDeletedAt` DATETIME(3) NULL,
    `processedDeletedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `EvidenceVideo_activeSlot_key`(`activeSlot`),
    UNIQUE INDEX `EvidenceVideo_originalKey_key`(`originalKey`),
    UNIQUE INDEX `EvidenceVideo_processedKey_key`(`processedKey`),
    INDEX `EvidenceVideo_washId_zone_idx`(`washId`, `zone`),
    INDEX `EvidenceVideo_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `EvidenceVideo_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `EvidenceVideo_washId_requestKey_key`(`washId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvidenceEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `washId` INTEGER NOT NULL,
    `videoId` VARCHAR(64) NULL,
    `actorId` INTEGER NULL,
    `action` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EvidenceEvent_washId_createdAt_idx`(`washId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EvidenceWorkerState` (
    `id` VARCHAR(32) NOT NULL,
    `owner` VARCHAR(64) NOT NULL,
    `leaseUntil` DATETIME(3) NOT NULL,
    `heartbeatAt` DATETIME(3) NOT NULL,
    `lastCleanupAt` DATETIME(3) NULL,
    `lastError` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Wash_evidenceToken_key` ON `Wash`(`evidenceToken`);

-- AddForeignKey
ALTER TABLE `EvidenceVideo` ADD CONSTRAINT `EvidenceVideo_washId_fkey` FOREIGN KEY (`washId`) REFERENCES `Wash`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceVideo` ADD CONSTRAINT `EvidenceVideo_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EvidenceEvent` ADD CONSTRAINT `EvidenceEvent_washId_fkey` FOREIGN KEY (`washId`) REFERENCES `Wash`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
