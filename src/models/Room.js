const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Room', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  propertyId:    { type: DataTypes.UUID, allowNull: false },
  roomNumber:    { type: DataTypes.STRING, allowNull: false },
  pricePerMonth: { type: DataTypes.FLOAT, defaultValue: 0 },
  isAvailable:   { type: DataTypes.BOOLEAN, defaultValue: true },
  status:        { type: DataTypes.STRING, defaultValue: 'AVAILABLE' },
  facilities:    { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
}, { tableName: 'rooms', timestamps: false });