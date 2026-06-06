const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Notification', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:    { type: DataTypes.UUID, allowNull: false },
  type:      { type: DataTypes.STRING, defaultValue: 'SYSTEM' },
  title:     { type: DataTypes.STRING, allowNull: false },
  message:   { type: DataTypes.STRING, allowNull: false },
  isRead:    { type: DataTypes.BOOLEAN, defaultValue: false },
  readAt:    { type: DataTypes.DATE },
}, { tableName: 'notifications', timestamps: true });