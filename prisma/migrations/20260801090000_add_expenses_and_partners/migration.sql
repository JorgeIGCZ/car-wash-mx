-- Add partner settings to users and register operational expenses.
ALTER TABLE `User`
    ADD COLUMN `isPartner` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `partnerSharePercentage` DECIMAL(5, 2) NULL;

CREATE TABLE `Expense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseDate` DATETIME(3) NOT NULL,
    `concept` VARCHAR(160) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `takenFromCash` BOOLEAN NOT NULL DEFAULT false,
    `reimbursable` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `partnerId` INTEGER NULL,
    `createdById` INTEGER NOT NULL,

    INDEX `Expense_expenseDate_idx`(`expenseDate`),
    INDEX `Expense_partnerId_expenseDate_idx`(`partnerId`, `expenseDate`),
    INDEX `Expense_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Expense` ADD CONSTRAINT `Expense_partnerId_fkey` FOREIGN KEY (`partnerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
