const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Payment', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  rentalId:      { type: DataTypes.UUID, allowNull: false },
  amount:        { type: DataTypes.FLOAT, allowNull: false },
  paymentDate:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: {
    type:         DataTypes.ENUM('PENDING','SUCCESS','VERIFIED','FAILED'),
    defaultValue: 'PENDING',
  },
  paymentProof:  { type: DataTypes.STRING },
  txHash:        { type: DataTypes.STRING },
  paymentType:   { type: DataTypes.STRING },
  month:         { type: DataTypes.INTEGER },
  year:          { type: DataTypes.INTEGER },
  isDistributed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'payments', timestamps: false });