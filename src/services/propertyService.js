const { Property, PropertyImage, Room, User, Investment } = require('../models');
const { Op }    = require('sequelize');
const sequelize = require('../config/db');

const findAll = async ({ search, category, status, page = 1, limit = 10 }) => {
  const where = {};

  if (status)   where.status   = status;

  // ✅ Prisma: { contains, mode: 'insensitive' } → Sequelize: { [Op.iLike] }
  if (category) where.category = { [Op.iLike]: `%${category}%` };
  if (search) {
    where[Op.or] = [
      { title:    { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (page - 1) * limit;

  // ✅ Prisma: $transaction([count, findMany]) → Sequelize: findAndCountAll
  const { count: total, rows: items } = await Property.findAndCountAll({
    where,
    offset,
    limit,
    distinct: true, // ✅ wajib agar count tidak dobel karena include
    include: [
      {
        model:      PropertyImage,
        as:         'images',
        attributes: ['url'],
        limit:      1,
      },
      {
        model:      User,
        as:         'owner',
        attributes: ['id', 'fullName'],
      },
      {
        // ✅ Prisma: _count.select.investments → Sequelize: include Investment lalu hitung manual
        model:      Investment,
        as:         'investments',
        attributes: ['id'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  // ✅ Prisma: _count.investments → Sequelize: hitung dari array yang di-include
  const itemsWithCount = items.map((p) => ({
    ...p.toJSON(),
    _count: { investments: p.investments?.length ?? 0 },
  }));

  return {
    total,
    page,
    totalPages: Math.ceil(total / limit),
    items: itemsWithCount,
  };
};

const { validate: isUUID } = require('uuid');

const findById = (id) => {
  if (!isUUID(id)) return Promise.resolve(null);

  return Property.findByPk(id, {
    include: [
      { model: PropertyImage, as: 'images' },
      { model: Room,          as: 'rooms'  },
      {
        model:      User,
        as:         'owner',
        attributes: ['id', 'fullName', 'email'],
      },
      {
        model:   Investment,
        as:      'investments',
        include: [{
          model:      User,
          as:         'investor',
          attributes: ['id', 'fullName'],
        }],
      },
    ],
  });
};

const create = (data) => {
  return Property.create(data);
};

const updateStatus = async (id, status, contractAddress) => {
  const data = { status };
  if (contractAddress) data.contractAddress = contractAddress;

  // ✅ Prisma: update({ where, data }) → Sequelize: update() lalu findByPk()
  await Property.update(data, { where: { id } });
  return Property.findByPk(id);
};

const findByOwner = async (ownerId) => {
  const properties = await Property.findAll({
    where: { ownerId },
    include: [
      {
        model:      PropertyImage,
        as:         'images',
        attributes: ['url'],
        limit:      1,
      },
      {
        model:      Investment,
        as:         'investments',
        attributes: ['id'],
      },
      {
        model:      Room,
        as:         'rooms',
        attributes: ['id'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  // ✅ Prisma: _count.{ investments, rooms } → Sequelize: hitung dari array
  return properties.map((p) => ({
    ...p.toJSON(),
    _count: {
      investments: p.investments?.length ?? 0,
      rooms:       p.rooms?.length       ?? 0,
    },
  }));
};

module.exports = { findAll, findById, create, updateStatus, findByOwner };