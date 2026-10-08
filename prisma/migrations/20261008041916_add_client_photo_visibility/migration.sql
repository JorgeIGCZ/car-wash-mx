-- AlterTable
ALTER TABLE `WashPhoto` ADD COLUMN `clientNote` VARCHAR(1000) NULL,
    ADD COLUMN `clientVisible` BOOLEAN NOT NULL DEFAULT false;
