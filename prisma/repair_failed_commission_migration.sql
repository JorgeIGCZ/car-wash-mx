ALTER TABLE `CommissionRule`
    ADD CONSTRAINT `CommissionRule_vehicleTypeId_fkey`
    FOREIGN KEY (`vehicleTypeId`) REFERENCES `VehicleType`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CommissionRule`
    ADD CONSTRAINT `CommissionRule_packageId_fkey`
    FOREIGN KEY (`packageId`) REFERENCES `ServicePackage`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
