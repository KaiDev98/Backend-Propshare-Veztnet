const { Room, Rental, Property, PropertyImage, Payment, Investment, Dividend, Notification, User } = require('../models');
const { Op }    = require('sequelize');
const sequelize = require('../config/db');

// ─── GET /api/rooms/:propertyId ───────────────────────────────────────────────
const getRoomsByProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const rooms = await Room.findAll({
      where: { propertyId },
      order: [['roomNumber', 'ASC']],
      include: [{
        model: Rental,
        as:    'rentals',
        where:    { status: 'ACTIVE' },
        required: false, // ✅ LEFT JOIN agar kamar tanpa rental tetap muncul
        include: [{
          model:      User,
          as:         'tenant',
          attributes: ['id', 'fullName', 'email'],
        }],
      }],
    });

    return res.status(200).json({ status: 'success', data: rooms });
  } catch (error) {
    console.error('[getRoomsByProperty]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── POST /api/rooms ──────────────────────────────────────────────────────────
const createRoom = async (req, res) => {
  try {
    const { propertyId, roomNumber, pricePerMonth, isAvailable, facilities } = req.body;

    if (!propertyId || !roomNumber) {
      return res.status(400).json({
        status:  'error',
        message: 'propertyId dan roomNumber wajib diisi',
      });
    }

    // ✅ Prisma: room.create({ data }) → Sequelize: Room.create({})
    const room = await Room.create({
      propertyId,
      roomNumber,
      pricePerMonth: parseFloat(pricePerMonth) || 0,
      isAvailable:   isAvailable ?? true,
      status:        'AVAILABLE',
      facilities:    facilities ?? [],
    });

    return res.status(201).json({ status: 'success', message: 'Kamar berhasil dibuat', data: room });
  } catch (error) {
    console.error('[createRoom]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── POST /api/rentals ────────────────────────────────────────────────────────
const createRental = async (req, res) => {
  try {
    const { roomId, startDate, propertyId, endDate, notes } = req.body;

    if (!startDate) {
      return res.status(400).json({ status: 'error', message: 'startDate wajib diisi' });
    }

    // ✅ Prisma: findFirst → Sequelize: findOne
    const existingRental = await Rental.findOne({
      where: {
        tenantId: req.user.id,
        status:   { [Op.in]: ['ACTIVE', 'PENDING'] }, // ✅ Prisma: { in: [...] } → Sequelize: { [Op.in]: [...] }
      },
      include: [
        {
          model:    Room,
          as:       'room',
          required: false,
          include:  [{
            model:      Property,
            as:         'property',
            attributes: ['title'],
          }],
        },
        {
          model:      Property,
          as:         'property',
          required:   false,
          attributes: ['title'],
        },
      ],
    });

    if (existingRental) {
      const namaProperti =
        existingRental.room?.property?.title ??
        existingRental.property?.title ??
        'properti lain';

      const keterangan =
        existingRental.status === 'ACTIVE'
          ? `sedang aktif di "${namaProperti}"`
          : `masih menunggu persetujuan owner di "${namaProperti}"`;

      return res.status(400).json({
        status:  'error',
        code:    'RENTAL_ALREADY_EXISTS',
        message: `Anda tidak dapat mengajukan sewa baru. Kontrak sewa Anda ${keterangan}. Hubungi owner via WhatsApp jika ingin mengakhiri kontrak.`,
        data: {
          existingRentalId:     existingRental.id,
          existingRentalStatus: existingRental.status,
          existingPropertyName: namaProperti,
        },
      });
    }

    let resolvedPropertyId = propertyId ?? null;

    if (roomId) {
      // ✅ Prisma: findUnique → Sequelize: findByPk
      const room = await Room.findByPk(roomId);
      if (!room) {
        return res.status(404).json({ status: 'error', message: 'Kamar tidak ditemukan' });
      }
      if (room.status === 'OCCUPIED') {
        return res.status(400).json({ status: 'error', message: 'Kamar sudah tidak tersedia' });
      }
      if (!resolvedPropertyId) resolvedPropertyId = room.propertyId;
    }

    // ✅ Prisma: $transaction(async tx => ...) → Sequelize: sequelize.transaction(async t => ...)
    const rental = await sequelize.transaction(async (t) => {
      const newRental = await Rental.create({
        tenantId:   req.user.id,
        roomId:     roomId             || null,
        propertyId: resolvedPropertyId || null,
        startDate:  new Date(startDate),
        endDate:    endDate ? new Date(endDate) : null,
        notes:      notes   || null,
        status:     'PENDING',
      }, { transaction: t });

      if (roomId) {
        await Room.update(
          { status: 'OCCUPIED', isAvailable: false },
          { where: { id: roomId }, transaction: t }
        );
      }

      // Fetch ulang dengan include room karena Sequelize create tidak support include
      return await Rental.findByPk(newRental.id, {
        include: [{ model: Room, as: 'room' }],
        transaction: t,
      });
    });

    return res.status(201).json({
      status:  'success',
      message: 'Pengajuan sewa berhasil dikirim dan kamar telah dipesan sementara',
      data:    rental,
    });
  } catch (error) {
    console.error('[createRental]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── GET /api/rentals/my-rentals ──────────────────────────────────────────────
const getMyRentals = async (req, res) => {
  try {
    let rentals;

    if (req.user.role === 'OWNER') {
      // ✅ Prisma: findMany + select → Sequelize: findAll + attributes
      const ownerProps = await Property.findAll({
        where:      { ownerId: req.user.id },
        attributes: ['id'],
      });
      const propIds = ownerProps.map(p => p.id);

      if (propIds.length === 0) {
        return res.status(200).json({ status: 'success', data: [] });
      }

      // ✅ Prisma: OR dengan nested relation → Sequelize: include + where pada relasi
      rentals = await Rental.findAll({
        where: {
          [Op.or]: [
            { propertyId: { [Op.in]: propIds } },
            { '$room.propertyId$': { [Op.in]: propIds } }, // ✅ dot notation untuk nested where
          ],
        },
        include: [
          {
            model:      User,
            as:         'tenant',
            attributes: ['id', 'fullName', 'email', 'phone'],
          },
          {
            model:    Room,
            as:       'room',
            required: false,
            include:  [{
              model:      Property,
              as:         'property',
              attributes: ['id', 'title', 'location'],
              include:    [{ model: PropertyImage, as: 'images', limit: 1 }],
            }],
          },
          {
            model:      Property,
            as:         'property',
            required:   false,
            attributes: ['id', 'title', 'location'],
            include:    [{ model: PropertyImage, as: 'images', limit: 1 }],
          },
          { model: Payment, as: 'payments' },
        ],
        order: [['createdAt', 'DESC']],
      });

    } else {
      rentals = await Rental.findAll({
        where: { tenantId: req.user.id },
        include: [
          {
            model:    Room,
            as:       'room',
            required: false,
            include:  [{
              model:   Property,
              as:      'property',
              include: [
                { model: PropertyImage, as: 'images', limit: 1 },
                { model: User, as: 'owner', attributes: ['id', 'fullName', 'walletAddress', 'phone'] },
              ],
            }],
          },
          {
            model:    Property,
            as:       'property',
            required: false,
            include:  [
              { model: PropertyImage, as: 'images', limit: 1 },
              { model: User, as: 'owner', attributes: ['id', 'fullName', 'walletAddress', 'phone'] },
            ],
          },
          { model: Payment, as: 'payments' },
        ],
        order: [['createdAt', 'DESC']],
      });
    }

    return res.status(200).json({ status: 'success', data: rentals });
  } catch (error) {
    console.error('[getMyRentals]', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── PATCH /api/rentals/:id/status ────────────────────────────────────────────
const updateRentalStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = ['ACTIVE', 'REJECTED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
    }

    const rental = await Rental.findByPk(id);
    if (!rental) {
      return res.status(404).json({ status: 'error', message: 'Rental tidak ditemukan' });
    }

    const newRoomStatus  = status === 'ACTIVE' ? 'OCCUPIED' : 'AVAILABLE';
    const newIsAvailable = status !== 'ACTIVE';

    const updatedRental = await sequelize.transaction(async (t) => {
      if (rental.roomId) {
        await Room.update(
          { status: newRoomStatus, isAvailable: newIsAvailable },
          { where: { id: rental.roomId }, transaction: t }
        );
      }

      await Rental.update({ status }, { where: { id }, transaction: t });

      // ✅ Sequelize: fetch ulang karena update tidak return object lengkap
      return await Rental.findByPk(id, {
        include: [
          { model: User, as: 'tenant', attributes: ['id', 'fullName', 'email'] },
          { model: Room, as: 'room' },
        ],
        transaction: t,
      });
    });

    return res.status(200).json({
      status:  'success',
      message: status === 'ACTIVE' ? 'Pengajuan sewa disetujui' : 'Pengajuan sewa ditolak',
      data:    updatedRental,
    });
  } catch (error) {
    console.error('[updateRentalStatus]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── PATCH /api/rentals/:id/cancel ───────────────────────────────────────────
const cancelRental = async (req, res) => {
  try {
    const { id } = req.params;

    const rental = await Rental.findByPk(id);
    if (!rental) {
      return res.status(404).json({ status: 'error', message: 'Rental tidak ditemukan' });
    }
    if (rental.tenantId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }
    if (rental.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Hanya rental PENDING yang bisa dibatalkan' });
    }

    const updated = await sequelize.transaction(async (t) => {
      if (rental.roomId) {
        await Room.update(
          { status: 'AVAILABLE', isAvailable: true },
          { where: { id: rental.roomId }, transaction: t }
        );
      }

      await Rental.update({ status: 'CANCELLED' }, { where: { id }, transaction: t });
      return await Rental.findByPk(id, { transaction: t });
    });

    return res.status(200).json({
      status:  'success',
      message: 'Pengajuan berhasil dibatalkan',
      data:    updated,
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── POST /api/payments ───────────────────────────────────────────────────────
const uploadPayment = async (req, res) => {
  try {
    const { rentalId, amount, month, year, paymentProof, txHash, paymentType } = req.body;

    if (!rentalId || !amount) {
      return res.status(400).json({ status: 'error', message: 'rentalId dan amount wajib diisi' });
    }

    const rental = await Rental.findByPk(rentalId);
    if (!rental) {
      return res.status(404).json({ status: 'error', message: 'Rental tidak ditemukan' });
    }
    if (rental.tenantId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }

    const payment = await Payment.create({
      rentalId,
      amount:       parseFloat(amount),
      paymentProof: paymentProof || null,
      txHash:       txHash       || null,
      paymentType:  paymentType  || null,
      month:        month ? parseInt(month) : null,
      year:         year  ? parseInt(year)  : null,
      status:       'PENDING',
    });

    return res.status(201).json({
      status:  'success',
      message: 'Pembayaran berhasil dikirim',
      data:    payment,
    });
  } catch (error) {
    console.error('[uploadPayment]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── PATCH /api/payments/:id/verify ──────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [{
        model: Rental,
        as:    'rental',
        include: [
          {
            model:    Room,
            as:       'room',
            required: false,
            include:  [{
              model:   Property,
              as:      'property',
              include: [{ model: Investment, as: 'investments' }],
            }],
          },
          {
            model:    Property,
            as:       'property',
            required: false,
            include:  [{ model: Investment, as: 'investments' }],
          },
        ],
      }],
    });

    if (!payment) {
      return res.status(404).json({ status: 'error', message: 'Pembayaran tidak ditemukan' });
    }
    if (payment.status !== 'PENDING') {
      return res.status(400).json({ status: 'error', message: 'Pembayaran sudah diproses sebelumnya' });
    }

    const property =
      payment.rental.room?.property ?? payment.rental.property ?? null;

    if (!property) {
      return res.status(400).json({ status: 'error', message: 'Properti tidak ditemukan untuk pembayaran ini' });
    }
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }

    if (payment.isDistributed) {
      await Payment.update({ status: 'VERIFIED' }, { where: { id } });
      const updated = await Payment.findByPk(id);
      return res.status(200).json({
        status:  'success',
        message: 'Pembayaran diverifikasi (dividen sudah pernah didistribusikan)',
        data:    updated,
      });
    }

    const investments = property.investments ?? [];

    const result = await sequelize.transaction(async (t) => {
      await Payment.update(
        { status: 'VERIFIED', isDistributed: investments.length > 0 },
        { where: { id }, transaction: t }
      );
      const updatedPayment = await Payment.findByPk(id, { transaction: t });

      if (investments.length === 0) {
        return { updatedPayment, dividendCount: 0 };
      }

      const totalTokens  = investments.reduce((s, inv) => s + inv.tokenAmount, 0);
      const dividendPool = payment.amount * 0.8;
      const autoTxHash   = `auto-${Date.now()}`;

      // ✅ Prisma: createMany → Sequelize: bulkCreate
      const dividendRecords = investments.map((inv) => ({
        investorId: inv.investorId,
        propertyId: property.id,
        amount:     (inv.tokenAmount / totalTokens) * dividendPool,
        txHash:     autoTxHash,
        status:     'PENDING',
      }));
      await Dividend.bulkCreate(dividendRecords, { transaction: t });

      const notifications = investments.map((inv) => ({
        userId:  inv.investorId,
        type:    'DIVIDEND',
        title:   'Dividend Baru Tersedia! 💰',
        message: `Sewa dari ${property.title} telah diverifikasi. Klaim dividend kamu sekarang.`,
      }));
      await Notification.bulkCreate(notifications, { transaction: t });

      return { updatedPayment, dividendCount: dividendRecords.length };
    });

    return res.status(200).json({
      status:  'success',
      message: `Pembayaran diverifikasi & dividend didistribusikan ke ${result.dividendCount} investor`,
      data: {
        payment:             result.updatedPayment,
        dividendDistributed: result.dividendCount,
      },
    });
  } catch (error) {
    console.error('[verifyPayment]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/rentals — hanya ADMIN ──────────────────────────────────────────
const getAllRentals = async (req, res) => {
  try {
    const rentals = await Rental.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model:      User,
          as:         'tenant',
          attributes: ['id', 'fullName', 'email', 'avatar'],
        },
        {
          model:    Room,
          as:       'room',
          required: false,
          include:  [{
            model:      Property,
            as:         'property',
            attributes: ['id', 'title', 'location'],
          }],
        },
        {
          model:      Property,
          as:         'property',
          required:   false,
          attributes: ['id', 'title', 'location'],
        },
        { model: Payment, as: 'payments' },
      ],
    });

    return res.status(200).json({ status: 'success', data: rentals });
  } catch (error) {
    console.error('[getAllRentals]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = {
  getRoomsByProperty,
  createRoom,
  createRental,
  getMyRentals,
  updateRentalStatus,
  cancelRental,
  uploadPayment,
  verifyPayment,
  getAllRentals,
};