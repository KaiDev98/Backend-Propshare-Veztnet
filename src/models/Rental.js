const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Rental', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId:   { type: DataTypes.UUID, allowNull: false },
  roomId:     { type: DataTypes.UUID },
  propertyId: { type: DataTypes.UUID },
  startDate:  { type: DataTypes.DATE, allowNull: false },
  endDate:    { type: DataTypes.DATE },
  notes:      { type: DataTypes.STRING },
  status: {
    type:         DataTypes.ENUM('PENDING','ACTIVE','CANCELLED','ENDED','REJECTED'),
    defaultValue: 'PENDING',
  },
}, { tableName: 'rentals', timestamps: true });