// backend/src/scripts/addPropertyStatus.js
require('dotenv').config();
const sequelize = require('../config/db');

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi DB berhasil');

    // Tambah ENUM value baru ke PostgreSQL
    await sequelize.query(`
      ALTER TYPE "enum_properties_status" 
      ADD VALUE IF NOT EXISTS 'READY_TO_RENT';
    `);
    console.log('✅ READY_TO_RENT ditambahkan');

    await sequelize.query(`
      ALTER TYPE "enum_properties_status" 
      ADD VALUE IF NOT EXISTS 'FULLY_OCCUPIED';
    `);
    console.log('✅ FULLY_OCCUPIED ditambahkan');

    console.log('🎉 Migrasi selesai!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migrasi gagal:', error.message);
    process.exit(1);
  }
};

migrate();