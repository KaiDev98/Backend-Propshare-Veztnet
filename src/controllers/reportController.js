const { Report, User, Room, Property } = require('../models');
const { Op } = require('sequelize');

// ─── GET /api/reports?propertyId=xxx ─────────────────────────────────────────
const getReports = async (req, res) => {
  try {
    const { propertyId } = req.query;

    let where = {};

    if (req.user.role === 'TENANT') {
      where = { tenantId: req.user.id };
    } else if (propertyId) {
      where = { propertyId };
    } else {
      // ✅ Prisma: where: { property: { ownerId } } (nested relation filter)
      // Sequelize: pakai '$' dot notation untuk filter nested
      where = { '$property.ownerId$': req.user.id };
    }

    const reports = await Report.findAll({
      where,
      include: [
        {
          model:      User,
          as:         'tenant',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model:      Room,
          as:         'room',
          required:   false,
          attributes: ['id', 'roomNumber'],
        },
        {
          // ✅ Wajib di-include agar '$property.ownerId$' bisa dipakai di where
          model:    Property,
          as:       'property',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const stats = {
      total:    reports.length,
      active:   reports.filter((r) => r.status !== 'RESOLVED').length,
      resolved: reports.filter((r) => r.status === 'RESOLVED').length,
      high:     reports.filter((r) => r.priority === 'High').length,
    };

    return res.status(200).json({ status: 'success', data: reports, stats });
  } catch (error) {
    console.error('[getReports]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── PATCH /api/reports/:id/status ───────────────────────────────────────────
const updateReportStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const allowed = ['NEW', 'IN_PROGRESS', 'RESOLVED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Status tidak valid' });
    }

    // ✅ Prisma: update({ where, data, include }) → Sequelize: update() lalu findByPk()
    const [affected] = await Report.update({ status }, { where: { id } });

    if (affected === 0) {
      return res.status(404).json({ status: 'error', message: 'Laporan tidak ditemukan' });
    }

    const report = await Report.findByPk(id, {
      include: [
        { model: User, as: 'tenant', attributes: ['fullName'] },
        { model: Room, as: 'room',   attributes: ['roomNumber'], required: false },
      ],
    });

    return res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    console.error('[updateReportStatus]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ─── POST /api/reports ────────────────────────────────────────────────────────
const createReport = async (req, res) => {
  try {
    const { title, description, category, priority, imageUrl, propertyId, roomId } = req.body;

    // ✅ Prisma: report.create({ data }) → Sequelize: Report.create({})
    const report = await Report.create({
      title,
      description,
      category,
      priority:  priority  ?? 'Medium',
      imageUrl:  imageUrl  ?? null,
      propertyId,
      roomId:    roomId    ?? null,
      tenantId:  req.user.id,
    });

    return res.status(201).json({ status: 'success', data: report });
  } catch (error) {
    console.error('[createReport]', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = { getReports, updateReportStatus, createReport };