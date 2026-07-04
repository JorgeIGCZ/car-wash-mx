-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'ADMINISTRATIVE', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE `CommissionRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `userId` INTEGER NOT NULL,
    `vehicleTypeId` INTEGER NOT NULL,
    `packageId` INTEGER NOT NULL,

    INDEX `CommissionRule_vehicleTypeId_packageId_idx`(`vehicleTypeId`, `packageId`),
    UNIQUE INDEX `CommissionRule_userId_vehicleTypeId_packageId_key`(`userId`, `vehicleTypeId`, `packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WashCommission` (
    `washId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,

    INDEX `WashCommission_userId_idx`(`userId`),
    PRIMARY KEY (`washId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommissionRule` ADD CONSTRAINT `CommissionRule_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionRule` ADD CONSTRAINT `CommissionRule_vehicleTypeId_fkey` FOREIGN KEY (`vehicleTypeId`) REFERENCES `VehicleType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionRule` ADD CONSTRAINT `CommissionRule_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `ServicePackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCommission` ADD CONSTRAINT `WashCommission_washId_fkey` FOREIGN KEY (`washId`) REFERENCES `Wash`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WashCommission` ADD CONSTRAINT `WashCommission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
