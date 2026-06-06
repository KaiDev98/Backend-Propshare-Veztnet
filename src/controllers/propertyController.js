const propertyService = require('../services/propertyService');
const { Property, PropertyImage, Investment, Notification, User } = require('../models');
const { Op }     = require('sequelize');
const sequelize  = require('../config/db');
const { ethers } = require('ethers');

// ─── Blockchain helpers ───────────────────────────────────────────────────────
const FUNDING_ABI = [
  "function registerProperty(string propertyId, address owner, uint256 fundingTarget, uint256 totalTokens) external",
  "function markAsFunded(string propertyId) external",
  "function withdrawFunds(string propertyId) external",
  "function properties(string) external view returns (string,address,uint256,uint256,uint256,uint256,bool,bool,uint256)",
];

const getAdminSigner = () => {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  return new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
};

const getFundingContract = () => {
  const signer = getAdminSigner();
  return new ethers.Contract(process.env.FUNDING_CONTRACT_ADDRESS, FUNDING_ABI, signer);
};

const registerPropertyOnChain = async (property) => {
  try {
    if (!process.env.FUNDING_CONTRACT_ADDRESS || !process.env.DEPLOYER_PRIVATE_KEY) {
      console.warn('[Chain] ENV tidak lengkap, skip register on-chain');
      return null;
    }
    if (!property.owner?.walletAddress) {
      console.warn('[Chain] Owner belum punya wallet, skip register on-chain');
      return null;
    }

    const contract     = getFundingContract();
    const fundingInWei = ethers.parseEther(
      (property.fundingTarget / 1_000_000).toFixed(6)
    );

    const tx = await contract.registerProperty(
      property.id,
      property.owner.walletAddress,
      fundingInWei,
      property.totalTokens
    );

    await tx.wait(1);
    console.log(`[Chain] Property ${property.id} registered. TX: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error('[registerPropertyOnChain]', err.message);
    return null;
  }
};

const markFundedOnChain = async (propertyId) => {
  try {
    if (!process.env.FUNDING_CONTRACT_ADDRESS || !process.env.DEPLOYER_PRIVATE_KEY) {
      console.warn('[Chain] ENV tidak lengkap, skip markAsFunded');
      return null;
    }
    const contract = getFundingContract();

    const onChain = await contract.properties(propertyId);
    if (onChain[6]) {
      console.log(`[Chain] Property ${propertyId} sudah funded on-chain, skip`);
      return null;
    }

    const tx = await contract.markAsFunded(propertyId);
    await tx.wait(1);
    console.log(`[Chain] markAsFunded ${propertyId} ✅ TX: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error('[markFundedOnChain]', err.message);
    return null;
  }
};

// ─── GET /api/properties ──────────────────────────────────────────────────────
// Dipakai Admin — bisa filter semua status
const getAllProperties = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 50 } = req.query;

    const where = {};

    if (status && status !== 'ALL') where.status = status;
    if (category) where.category = { [Op.iLike]: `%${category}%` };
    if (search) {
      where[Op.or] = [
        { title:       { [Op.iLike]: `%${search}%` } },
        { location:    { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count: total, rows: properties } = await Property.findAndCountAll({
      where,
      include: [
        { model: PropertyImage, as: 'images',      attributes: ['url'], limit: 1 },
        { model: Investment,    as: 'investments', attributes: ['id', 'tokenAmount', 'totalPaid'] },
        { model: User,          as: 'owner',       attributes: ['id', 'fullName'] },
      ],
      order:    [['createdAt', 'DESC']],
      offset,
      limit:    parseInt(limit),
      distinct: true,
    });

    return res.status(200).json({
      status: 'success',
      data:   properties,
      meta: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getAllProperties]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/properties/marketplace/investor ─────────────────────────────────
// Hanya properti ACTIVE (sedang fundraising) yang tampil ke investor
const getInvestorMarketplace = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;

    const where = { status: 'ACTIVE' };

    if (category) where.category = { [Op.iLike]: `%${category}%` };
    if (search) {
      where[Op.or] = [
        { title:       { [Op.iLike]: `%${search}%` } },
        { location:    { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count: total, rows: properties } = await Property.findAndCountAll({
      where,
      include: [
        { model: PropertyImage, as: 'images',      attributes: ['url'], limit: 1 },
        { model: Investment,    as: 'investments', attributes: ['id', 'tokenAmount', 'totalPaid'] },
        { model: User,          as: 'owner',       attributes: ['id', 'fullName'] },
      ],
      order:    [['createdAt', 'DESC']],
      offset,
      limit:    parseInt(limit),
      distinct: true,
    });

    // Hitung persentase funding & sisa token untuk tiap properti
    const data = properties.map((p) => {
      const json       = p.toJSON();
      const soldTokens = json.investments?.reduce((sum, inv) => sum + (inv.tokenAmount ?? 0), 0) ?? 0;
      const fundingPct = json.fundingTarget > 0
        ? Math.min((json.currentFunding / json.fundingTarget) * 100, 100)
        : 0;
      return {
        ...json,
        soldTokens,
        availableTokens:   (json.totalTokens ?? 0) - soldTokens,
        fundingPercentage: parseFloat(fundingPct.toFixed(2)),
      };
    });

    return res.status(200).json({
      status: 'success',
      data,
      meta: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getInvestorMarketplace]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/properties/marketplace/tenant ───────────────────────────────────
// Hanya properti READY_TO_RENT dan FULLY_OCCUPIED yang tampil ke tenant
const getTenantMarketplace = async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;

    const where = {
    status: { [Op.in]: ['FUNDED', 'READY_TO_RENT', 'FULLY_OCCUPIED'] },
  };

    if (category) where.category = { [Op.iLike]: `%${category}%` };
    if (search) {
      where[Op.or] = [
        { title:    { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count: total, rows: properties } = await Property.findAndCountAll({
      where,
      include: [
        { model: PropertyImage, as: 'images', attributes: ['url'], limit: 1 },
        { model: User,          as: 'owner',  attributes: ['id', 'fullName'] },
      ],
      order:    [['createdAt', 'DESC']],
      offset,
      limit:    parseInt(limit),
      distinct: true,
    });

    const data = properties.map((p) => ({
      ...p.toJSON(),
      isAvailable: p.status === 'READY_TO_RENT', // false = FULLY_OCCUPIED → frontend tampilkan label "Penuh"
    }));

    return res.status(200).json({
      status: 'success',
      data,
      meta: { 
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[getTenantMarketplace]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/properties/:id ──────────────────────────────────────────────────
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    const property = await propertyService.findById(id);

    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }

    return res.status(200).json({ status: 'success', data: property });
  } catch (error) {
    console.error('[getPropertyById]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/properties ─────────────────────────────────────────────────────
const createProperty = async (req, res) => {
  try {
    const {
      title, description, location, category,
      fundingTarget, tokenPrice, totalTokens, ipfsLegalDoc,
    } = req.body;

    if (!title || !description || !location || !category || !fundingTarget || !tokenPrice || !totalTokens) {
      return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
    }

    const property = await propertyService.create({
      ownerId:       req.user.id,
      title,
      description,
      location,
      category,
      fundingTarget: parseFloat(fundingTarget),
      tokenPrice:    parseFloat(tokenPrice),
      totalTokens:   parseInt(totalTokens),
      ipfsLegalDoc,
    });

    return res.status(201).json({
      status:  'success',
      message: 'Proposal properti berhasil diajukan, menunggu verifikasi admin',
      data:    property,
    });
  } catch (error) {
    console.error('[createProperty]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── PATCH /api/properties/:id/status ────────────────────────────────────────
// Dipakai Admin untuk mengubah status secara manual
const updatePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, contractAddress } = req.body;

    // ✅ Ditambah READY_TO_RENT dan FULLY_OCCUPIED
    const allowed = ['ACTIVE', 'REJECTED', 'FUNDED', 'READY_TO_RENT', 'FULLY_OCCUPIED', 'INACTIVE'];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        status:  'error',
        message: `Status tidak valid. Pilih: ${allowed.join(', ')}`,
      });
    }

    const property = await propertyService.findById(id);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }

    const updated = await propertyService.updateStatus(id, status, contractAddress);

    // Jika Admin set ke ACTIVE → register on-chain
    if (status === 'ACTIVE') {
      const txHash = await registerPropertyOnChain(updated);
      if (txHash) {
        await Property.update(
          { contractAddress: process.env.FUNDING_CONTRACT_ADDRESS },
          { where: { id } }
        );
        console.log(`[Chain] Property ${id} registered on-chain. TX: ${txHash}`);
      }
    }

    // Jika Admin manual set ke READY_TO_RENT → mark funded on-chain juga
    if (status === 'READY_TO_RENT') {
      markFundedOnChain(id).catch(err =>
        console.error('[updatePropertyStatus] markFundedOnChain gagal:', err.message)
      );
    }

    return res.status(200).json({
      status:  'success',
      message: `Status properti diubah menjadi ${status}`,
      data:    updated,
    });
  } catch (error) {
    console.error('[updatePropertyStatus]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── PATCH /api/properties/:id/claim ─────────────────────────────────────────
const claimFunds = async (req, res) => {
  try {
    const { id } = req.params;
    const { txHash, walletAddress, amount } = req.body;

    if (!txHash || !walletAddress) {
      return res.status(400).json({ status: 'error', message: 'txHash dan walletAddress wajib diisi' });
    }

    const property = await propertyService.findById(id);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }
    if (property.isClaimed) {
      return res.status(409).json({ status: 'error', message: 'Dana sudah pernah diklaim' });
    }

    // ✅ Properti harus sudah READY_TO_RENT atau FUNDED agar bisa diklaim
    const claimableStatuses = ['READY_TO_RENT', 'FUNDED', 'FULLY_OCCUPIED'];
    if (!claimableStatuses.includes(property.status)) {
      return res.status(400).json({
        status:  'error',
        message: 'Properti belum memenuhi syarat penarikan dana',
      });
    }

    try {
      const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
      const receipt  = await provider.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) {
        return res.status(400).json({
          status:  'error',
          message: 'Transaksi blockchain tidak valid atau belum confirmed',
        });
      }
    } catch (chainErr) {
      console.warn('[claimFunds] Tidak bisa verifikasi TX on-chain:', chainErr.message);
    }

    await Property.update(
      { isClaimed: true, claimedAt: new Date(), claimedTxHash: txHash },
      { where: { id } }
    );
    const updated = await Property.findByPk(id);

    await Notification.create({
      userId:  req.user.id,
      type:    'PAYMENT',
      title:   'Dana Berhasil Diklaim! 🎉',
      message: `Dana properti ${property.title} sebesar Rp ${(amount ?? 0).toLocaleString('id-ID')} telah berhasil ditarik ke wallet kamu.`,
    });

    return res.status(200).json({
      status:  'success',
      message: 'Klaim dana berhasil dicatat',
      data:    updated,
    });
  } catch (error) {
    console.error('[claimFunds]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/properties/my-listings ─────────────────────────────────────────
const getMyListings = async (req, res) => {
  try {
    const properties = await propertyService.findByOwner(req.user.id);
    return res.status(200).json({ status: 'success', data: properties });
  } catch (error) {
    console.error('[getMyListings]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/properties/:id/images ─────────────────────────────────────────
const uploadPropertyImages = async (req, res) => {
  try {
    const { id }   = req.params;
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        status:  'error',
        message: 'Field "urls" wajib diisi berupa array URL gambar',
      });
    }

    const property = await propertyService.findById(id);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }

    await PropertyImage.bulkCreate(
      urls.map((url) => ({ propertyId: id, url }))
    );

    const savedImages = await PropertyImage.findAll({ where: { propertyId: id } });

    return res.status(201).json({
      status:  'success',
      message: `${urls.length} gambar berhasil diupload`,
      data:    savedImages,
    });
  } catch (error) {
    console.error('[uploadPropertyImages]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── DELETE /api/properties/:id/images/:imageId ───────────────────────────────
const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const property = await propertyService.findById(id);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }
    if (property.ownerId !== req.user.id) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak' });
    }

    await PropertyImage.destroy({ where: { id: imageId } });

    return res.status(200).json({ status: 'success', message: 'Gambar berhasil dihapus' });
  } catch (error) {
    console.error('[deletePropertyImage]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── POST /api/properties/:id/invest ─────────────────────────────────────────
const investProperty = async (req, res) => {
  try {
    const { id }                            = req.params;
    const { amount, tokens, walletAddress } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ status: 'error', message: 'Jumlah investasi tidak valid' });
    }
    if (!tokens || parseFloat(tokens) <= 0) {
      return res.status(400).json({ status: 'error', message: 'Jumlah token tidak valid' });
    }
    if (!walletAddress) {
      return res.status(400).json({ status: 'error', message: 'Wallet address wajib diisi' });
    }

    const property = await Property.findByPk(id);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }
    if (property.status !== 'ACTIVE') {
      return res.status(400).json({
        status:  'error',
        message: `Properti tidak dapat diinvestasikan (status: ${property.status})`,
      });
    }

    const tokenAmount = Math.floor(parseFloat(tokens));
    const totalPaid   = parseFloat(amount);

    if (tokenAmount < 1) {
      return res.status(400).json({
        status:  'error',
        message: `Minimal pembelian adalah 1 token (Rp ${property.tokenPrice.toLocaleString('id-ID')})`,
      });
    }

    const soldTokens      = (await Investment.sum('tokenAmount', { where: { propertyId: id } })) ?? 0;
    const availableTokens = property.totalTokens - soldTokens;

    if (tokenAmount > availableTokens) {
      return res.status(400).json({
        status:  'error',
        message: `Token tidak mencukupi. Tersisa: ${availableTokens} token`,
      });
    }

    const txHash = ethers.keccak256(
      ethers.toUtf8Bytes(`invest:${req.user.id}:${id}:${Date.now()}`)
    );

    const investment = await sequelize.transaction(async (t) => {
      const inv = await Investment.create({
        investorId:  req.user.id,
        propertyId:  id,
        tokenAmount,
        totalPaid,
        txHash,
      }, { transaction: t });

      await Property.update(
        { currentFunding: sequelize.literal(`"currentFunding" + ${totalPaid}`) },
        { where: { id }, transaction: t }
      );

      return inv;
    });

    // ✅ Cek fully funded → langsung READY_TO_RENT (bukan FUNDED)
    // agar properti otomatis muncul di Tenant Marketplace
    const updatedProp = await Property.findByPk(id);
    if (
      updatedProp.fundingTarget > 0 &&
      updatedProp.currentFunding >= updatedProp.fundingTarget &&
      updatedProp.status === 'ACTIVE'
    ) {
      await Property.update({ status: 'READY_TO_RENT' }, { where: { id } });
      console.log(`[invest] Property ${id} → READY_TO_RENT ✅`);

      // Mark on-chain (non-blocking, tidak gagalkan response jika error)
      markFundedOnChain(id).catch(err =>
        console.error('[invest] markFundedOnChain gagal:', err.message)
      );

      // Notifikasi ke owner bahwa propertinya fully funded
      await Notification.create({
        userId:  updatedProp.ownerId,
        type:    'SYSTEM',
        title:   'Properti Anda Fully Funded! 🎉',
        message: `Properti "${updatedProp.title}" telah 100% didanai dan kini tampil di Tenant Marketplace.`,
      });
    }

    // Notifikasi ke investor
    await Notification.create({
      userId:  req.user.id,
      type:    'PAYMENT',
      title:   'Investasi Berhasil! 🎉',
      message: `Kamu berhasil membeli ${tokenAmount} token properti "${property.title}" senilai Rp ${totalPaid.toLocaleString('id-ID')}.`,
    });

    console.log(`[invest] User ${req.user.id} | Property ${id} | ${tokenAmount} token | Rp ${totalPaid} | TX: ${txHash}`);

    return res.status(201).json({
      status:  'success',
      message: `Investasi berhasil! Kamu mendapatkan ${tokenAmount} token.`,
      data: {
        ...investment.toJSON(),
        txHash,
        propertyTitle: property.title,
      },
    });
  } catch (error) {
    console.error('[investProperty]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = {
  getAllProperties,
  getInvestorMarketplace, // ✅ baru
  getTenantMarketplace,   // ✅ baru
  getPropertyById,
  createProperty,
  updatePropertyStatus,
  claimFunds,
  getMyListings,
  uploadPropertyImages,
  deletePropertyImage,
  investProperty,
};