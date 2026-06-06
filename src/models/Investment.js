const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Investment', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  investorId:  { type: DataTypes.UUID, allowNull: false },
  propertyId:  { type: DataTypes.UUID, allowNull: false },
  tokenAmount: { type: DataTypes.INTEGER, allowNull: false },
  totalPaid:   { type: DataTypes.FLOAT,   allowNull: false },
  txHash:      { type: DataTypes.STRING,  allowNull: false },
}, { tableName: 'investments', timestamps: true });