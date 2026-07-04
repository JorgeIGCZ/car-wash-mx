-- CreateTable
CREATE TABLE `WashPhoto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `objectKey` VARCHAR(512) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `byteSize` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `washId` INTEGER NOT NULL,

    UNIQUE INDEX `WashPhoto_objectKey_key`(`objectKey`),
    INDEX `WashPhoto_washId_createdAt_idx`(`washId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WashPhoto` ADD CONSTRAINT `WashPhoto_washId_fkey` FOREIGN KEY (`washId`) REFERENCES `Wash`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
