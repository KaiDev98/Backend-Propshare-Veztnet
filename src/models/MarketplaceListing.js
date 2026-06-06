const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketplaceListing', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sellerId:      { type: DataTypes.UUID, allowNull: false },
  propertyId:    { type: DataTypes.UUID, allowNull: false },
  tokenAmount:   { type: DataTypes.INTEGER },
  pricePerToken: { type: DataTypes.FLOAT },
  totalPrice:    { type: DataTypes.FLOAT },
  status:        { type: DataTypes.STRING, defaultValue: 'OPEN' },
  txHash:        { type: DataTypes.STRING },
}, { tableName: 'marketplace_listings', timestamps: true });