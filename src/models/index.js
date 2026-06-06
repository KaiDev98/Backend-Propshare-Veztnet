// models/index.js
const sequelize = require('../config/db'); 

// ─── Import Models ────────────────────────────────────────────────────
const User               = require('./User')(sequelize);
const Property           = require('./Property')(sequelize);
const PropertyImage      = require('./PropertyImage')(sequelize);
const Room               = require('./Room')(sequelize);
const Rental             = require('./Rental')(sequelize);
const Payment            = require('./Payment')(sequelize);
const Investment         = require('./Investment')(sequelize);
const Dividend           = require('./Dividend')(sequelize);
const Report             = require('./Report')(sequelize);
const Review             = require('./Review')(sequelize);
const Notification       = require('./Notification')(sequelize);
const MarketplaceListing = require('./MarketplaceListing')(sequelize);

// ─── Associations ─────────────────────────────────────────────────────

// User ↔ Property
User.hasMany(Property, { foreignKey: 'ownerId', as: 'properties' });
Property.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Property ↔ PropertyImage
Property.hasMany(PropertyImage, { foreignKey: 'propertyId', as: 'images', onDelete: 'CASCADE' });
PropertyImage.belongsTo(Property, { foreignKey: 'propertyId' });

// Property ↔ Room
Property.hasMany(Room, { foreignKey: 'propertyId', as: 'rooms', onDelete: 'CASCADE' });
Room.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// User ↔ Rental
User.hasMany(Rental, { foreignKey: 'tenantId', as: 'rentals' });
Rental.belongsTo(User, { foreignKey: 'tenantId', as: 'tenant' });

// Room ↔ Rental
Room.hasMany(Rental, { foreignKey: 'roomId', as: 'rentals' });
Rental.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Property ↔ Rental
Property.hasMany(Rental, { foreignKey: 'propertyId', as: 'rentals' });
Rental.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Rental ↔ Payment
Rental.hasMany(Payment, { foreignKey: 'rentalId', as: 'payments' });
Payment.belongsTo(Rental, { foreignKey: 'rentalId', as: 'rental' });

// User ↔ Investment
User.hasMany(Investment, { foreignKey: 'investorId', as: 'investments' });
Investment.belongsTo(User, { foreignKey: 'investorId', as: 'investor' });

// Property ↔ Investment
Property.hasMany(Investment, { foreignKey: 'propertyId', as: 'investments' });
Investment.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// User ↔ Dividend
User.hasMany(Dividend, { foreignKey: 'investorId', as: 'dividends' });
Dividend.belongsTo(User, { foreignKey: 'investorId', as: 'investor' });

// Property ↔ Dividend
Property.hasMany(Dividend, { foreignKey: 'propertyId', as: 'dividends' });
Dividend.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Report
User.hasMany(Report, { foreignKey: 'tenantId', as: 'tenantReports' });
Report.belongsTo(User, { foreignKey: 'tenantId', as: 'tenant' });
Property.hasMany(Report, { foreignKey: 'propertyId', as: 'reports' });
Report.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Room.hasMany(Report, { foreignKey: 'roomId', as: 'reports' });
Report.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Review
Rental.hasMany(Review, { foreignKey: 'rentalId', as: 'reviews' });
Review.belongsTo(Rental, { foreignKey: 'rentalId', as: 'rental' });
User.hasMany(Review, { foreignKey: 'tenantId', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'tenantId', as: 'tenant' });
Property.hasMany(Review, { foreignKey: 'propertyId', as: 'reviews' });
Review.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Notification
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// MarketplaceListing
User.hasMany(MarketplaceListing, { foreignKey: 'sellerId', as: 'sellerListings' });
MarketplaceListing.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Property.hasMany(MarketplaceListing, { foreignKey: 'propertyId', as: 'listings' });
MarketplaceListing.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

module.exports = {
  sequelize,
  User, Property, PropertyImage, Room,
  Rental, Payment, Investment, Dividend,
  Report, Review, Notification, MarketplaceListing,
};