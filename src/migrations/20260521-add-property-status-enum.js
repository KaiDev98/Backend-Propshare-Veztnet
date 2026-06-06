'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL: harus tambah nilai ENUM secara manual
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_properties_status" ADD VALUE IF NOT EXISTS 'READY_TO_RENT';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_properties_status" ADD VALUE IF NOT EXISTS 'FULLY_OCCUPIED';`
    );
  },

  async down(queryInterface, Sequelize) {
    // PostgreSQL tidak support DROP VALUE dari ENUM
    // Tidak ada rollback untuk ini
    console.warn('Rollback ENUM value tidak didukung PostgreSQL');
  },
};