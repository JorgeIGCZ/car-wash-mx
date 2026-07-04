-- Replace per-vehicle-only commissions with hierarchical rules.
-- The table is empty at deployment time, so the new required key is safe.

-- DropForeignKey
-- MariaDB may discard a redundant temporary userId index while the old
-- composite unique index exists, so recreate this foreign key explicitly.
ALTER TABLE `CommissionRule` DROP FOREIGN KEY `CommissionRule_userId_fkey`;

-- DropForeignKey
ALTER TABLE `CommissionRule` DROP FOREIGN KEY `CommissionRule_vehicleTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `CommissionRule` DROP FOREIGN KEY `CommissionRule_packageId_fkey`;

-- DropIndex
DROP INDEX `CommissionRule_userId_vehicleTypeId_packageId_key` ON `CommissionRule`;

-- DropIndex
DROP INDEX `CommissionRule_vehicleTypeId_packageId_idx` ON `CommissionRule`;

-- AlterTable
ALTER TABLE `CommissionRule`
    ADD COLUMN `scopeKey` VARCHAR(100) NOT NULL,
    ADD COLUMN `category` ENUM('NORMAL', 'INTERIOR', 'SPECIAL') NULL,
    MODIFY `vehicleTypeId` INTEGER NULL,
    MODIFY `packageId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `CommissionRule_userId_scopeKey_key`
    ON `CommissionRule`(`userId`, `scopeKey`);

-- CreateIndex
CREATE INDEX `CommissionRule_packageId_vehicleTypeId_idx`
    ON `CommissionRule`(`packageId`, `vehicleTypeId`);

-- AddForeignKey
ALTER TABLE `CommissionRule`
    ADD CONSTRAINT `CommissionRule_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionRule`
    ADD CONSTRAINT `CommissionRule_vehicleTypeId_fkey`
    FOREIGN KEY (`vehicleTypeId`) REFERENCES `VehicleType`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionRule`
    ADD CONSTRAINT `CommissionRule_packageId_fkey`
    FOREIGN KEY (`packageId`) REFERENCES `ServicePackage`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
