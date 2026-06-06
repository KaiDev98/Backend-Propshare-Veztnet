const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Property', {
  id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  ownerId:        { type: DataTypes.UUID, allowNull: false },
  title:          { type: DataTypes.STRING, allowNull: false },
  description:    { type: DataTypes.TEXT },
  location:       { type: DataTypes.STRING },
  roi:            { type: DataTypes.FLOAT },
  latitude:       { type: DataTypes.FLOAT },
  longitude:      { type: DataTypes.FLOAT },
  category:       { type: DataTypes.STRING },
  fundingTarget:  { type: DataTypes.FLOAT },
  currentFunding: { type: DataTypes.FLOAT, defaultValue: 0 },
  tokenPrice:     { type: DataTypes.FLOAT },
  totalTokens:    { type: DataTypes.INTEGER },
  contractAddress:{ type: DataTypes.STRING },
  ipfsLegalDoc:   { type: DataTypes.STRING },
  isClaimed:      { type: DataTypes.BOOLEAN, defaultValue: false },
  claimedAt:      { type: DataTypes.DATE },
  claimedTxHash:  { type: DataTypes.STRING },
  status: {
    type: DataTypes.ENUM(
      'PENDING',        // Menunggu verifikasi admin
      'ACTIVE',         // Fundraising — tampil di Investor Marketplace
      'READY_TO_RENT',  // ✅ BARU: Funded, siap disewa — tampil di Tenant Marketplace
      'FULLY_OCCUPIED', // ✅ BARU: Semua kamar terisi
      'FUNDED',         // Legacy (tetap ada untuk backward compat)
      'REJECTED',
      'INACTIVE'
    ),
    defaultValue: 'PENDING',
  },
}, { tableName: 'properties', timestamps: true });