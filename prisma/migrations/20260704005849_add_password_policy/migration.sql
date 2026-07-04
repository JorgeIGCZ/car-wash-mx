-- AlterTable
ALTER TABLE `User` ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;
