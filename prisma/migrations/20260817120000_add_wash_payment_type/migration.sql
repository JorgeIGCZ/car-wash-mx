-- Add payment type to service records. Existing rows default to cash.
ALTER TABLE `Wash`
    ADD COLUMN `paymentType` ENUM('CASH', 'CARD', 'TRANSFER') NOT NULL DEFAULT 'CASH' AFTER `chargedPrice`;
