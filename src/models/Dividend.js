const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Dividend', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  investorId: { type: DataTypes.UUID, allowNull: false },
  propertyId: { type: DataTypes.UUID, allowNull: false },
  amount:     { type: DataTypes.FLOAT, allowNull: false },
  txHash:     { type: DataTypes.STRING },
  status:     { type: DataTypes.STRING, defaultValue: 'PENDING' },
  claimedAt:  { type: DataTypes.DATE },
}, { tableName: 'dividends', timestamps: true });