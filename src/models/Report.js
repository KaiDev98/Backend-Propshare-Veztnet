const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Report', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title:       { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  category:    { type: DataTypes.STRING },
  priority:    { type: DataTypes.STRING, defaultValue: 'Medium' },
  status:      { type: DataTypes.STRING, defaultValue: 'NEW' },
  imageUrl:    { type: DataTypes.STRING },
  propertyId:  { type: DataTypes.UUID, allowNull: false },
  roomId:      { type: DataTypes.UUID },
  tenantId:    { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'reports', timestamps: true });