const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Review', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  rentalId:      { type: DataTypes.UUID, allowNull: false },
  tenantId:      { type: DataTypes.UUID, allowNull: false },
  propertyId:    { type: DataTypes.UUID, allowNull: false },
  maintenance:   { type: DataTypes.INTEGER },
  communication: { type: DataTypes.INTEGER },
  cleanliness:   { type: DataTypes.INTEGER },
  avgRating:     { type: DataTypes.FLOAT },
  comment:       { type: DataTypes.TEXT },
  photoUrl:      { type: DataTypes.STRING },
  ownerReply:    { type: DataTypes.TEXT },
  repliedAt:     { type: DataTypes.DATE },
}, { tableName: 'reviews', timestamps: true });