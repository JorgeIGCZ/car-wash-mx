ALTER TABLE `Wash`
  ADD COLUMN `deletedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedById` INTEGER NULL;

CREATE INDEX `Wash_deletedAt_idx` ON `Wash`(`deletedAt`);
CREATE INDEX `Wash_deletedById_idx` ON `Wash`(`deletedById`);

ALTER TABLE `Wash`
  ADD CONSTRAINT `Wash_deletedById_fkey`
  FOREIGN KEY (`deletedById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
