const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PropertyImage', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  propertyId: { type: DataTypes.UUID, allowNull: false },
  url:        { type: DataTypes.STRING, allowNull: false },
}, { tableName: 'property_images', timestamps: false });