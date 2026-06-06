const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('User', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email:          { type: DataTypes.STRING, unique: true, allowNull: false },
  password:       { type: DataTypes.STRING, allowNull: false },
  fullName:       { type: DataTypes.STRING, allowNull: false },
  role:           { type: DataTypes.ENUM('ADMIN','OWNER','INVESTOR','TENANT'), defaultValue: 'INVESTOR' },
  walletAddress:  { type: DataTypes.STRING, unique: true },
  phone:          { type: DataTypes.STRING },
  avatar:         { type: DataTypes.STRING },
  dateOfBirth:    { type: DataTypes.DATE },
  emergencyName:  { type: DataTypes.STRING },
  emergencyPhone: { type: DataTypes.STRING },
  emergencyRel:   { type: DataTypes.STRING },
  isSuspended:    { type: DataTypes.BOOLEAN, defaultValue: false },
  reputationScore:{ type: DataTypes.INTEGER, defaultValue: 100 },
  kycStatus:      { type: DataTypes.STRING, defaultValue: 'PENDING' },
  kycDocumentUrl: { type: DataTypes.STRING },
}, { tableName: 'users', timestamps: true });