const { Property, Investment, PropertyImage } = require('../models');
const { Op }      = require('sequelize');
const sequelize   = require('../config/db');
const { ethers }  = require('ethers');
const { notifyInvestmentSuccess } = require('../utils/notificationHelper');

// ─── Blockchain: Mark property as funded ─────────────────────────────────────
const FUNDING_ABI = [
  "function markAsFunded(string propertyId) external",
  "function properties(string) external view returns (string,address,uint256,uint256,uint256,uint256,bool,bool,uint256)",
];

const markPropertyFundedOnChain = async (propertyId) => {
  try {
    if (
      !process.env.FUNDING_CONTRACT_ADDRESS ||
      !process.env.DEPLOYER_PRIVATE_KEY     ||
      !process.env.SEPOLIA_RPC_URL
    ) {
      console.warn('[Chain] ENV tidak lengkap, skip markAsFunded');
      return null;
    }

    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(
      process.env.FUNDING_CONTRACT_ADDRESS,
      FUNDING_ABI,
      signer
    );

    const existing = await contract.properties(propertyId);
    if (existing[6]) {
      console.log(`[Chain] Property ${propertyId} sudah funded di contract, skip`);
      return null;
    }

    console.log(`[Chain] Marking ${propertyId} as funded...`);
    const tx = await contract.markAsFunded(propertyId);
    await tx.wait(1);
    console.log(`[Chain] ✅ Property ${propertyId} marked as funded! TX: ${tx.hash}`);
    return tx.hash;
  } catch (err) {
    console.error('[markPropertyFundedOnChain]', err.message);
    return null;
  }
};

// ─── POST /api/investments ────────────────────────────────────────────────────
const createInvestment = async (req, res) => {
  try {
    const { propertyId, tokenAmount, totalPaid, txHash } = req.body;

    if (!propertyId || !tokenAmount || !totalPaid || !txHash) {
      return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
    }

    const property = await Property.findByPk(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'error', message: 'Properti tidak ditemukan' });
    }
    if (property.status !== 'ACTIVE') {
      return res.status(400).json({ status: 'error', message: 'Properti ini tidak dalam masa funding' });
    }

    const duplicate = await Investment.findOne({ where: { txHash } });
    if (duplicate) {
      return res.status(409).json({ status: 'error', message: 'Transaksi ini sudah pernah dicatat' });
    }

    const newFunding = property.currentFunding + parseFloat(totalPaid);
    const isFunded   = newFunding >= property.fundingTarget;

    const investment = await sequelize.transaction(async (t) => {
      const inv = await Investment.create({
        investorId:  req.user.id,
        propertyId,
        tokenAmount: parseInt(tokenAmount),
        totalPaid:   parseFloat(totalPaid),
        txHash,
      }, { transaction: t });

      await Property.update(
        {
          currentFunding: sequelize.literal(`"currentFunding" + ${parseFloat(totalPaid)}`),
          ...(isFunded ? { status: 'FUNDED' } : {}),
        },
        { where: { id: propertyId }, transaction: t }
      );

      return inv;
    });

    await notifyInvestmentSuccess(
      req.user.id,
      property.title,
      parseInt(tokenAmount),
      parseFloat(totalPaid)
    );

    if (isFunded) {
      console.log(`[Chain] Property ${propertyId} mencapai 100% funding!`);
      markPropertyFundedOnChain(propertyId)
        .then(txHash => { if (txHash) console.log(`[Chain] Funded TX: ${txHash}`); })
        .catch(err  => console.error('[Chain] markFunded error:', err.message));
    }

    return res.status(201).json({
      status:  'success',
      message: 'Investasi berhasil dicatat',
      data: {
        investmentId: investment.id,
        confirmedAt:  investment.createdAt,
        isFunded,
      },
    });
  } catch (error) {
    console.error('[createInvestment]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/investments/my-portfolio ───────────────────────────────────────
const getMyPortfolio = async (req, res) => {
  try {
    const investments = await Investment.findAll({
      where:   { investorId: req.user.id },
      include: [{
        model:      Property,
        as:         'property',           // ✅ fix: tambah as
        attributes: ['id', 'title', 'location', 'tokenPrice', 'totalTokens',
                     'currentFunding', 'fundingTarget', 'status'],
        include: [{
          model:      PropertyImage,
          as:         'images',           // ✅ fix: tambah as
          attributes: ['url'],
          limit:      1,
        }],
      }],
      order: [['createdAt', 'DESC']],
    });

    const totalInvested = investments.reduce((sum, inv) => sum + inv.totalPaid, 0);
    const totalTokens   = investments.reduce((sum, inv) => sum + inv.tokenAmount, 0);

    return res.status(200).json({
      status: 'success',
      data: {
        summary:     { totalInvested, totalTokens, totalProperties: investments.length },
        investments,
      },
    });
  } catch (error) {
    console.error('[getMyPortfolio]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── GET /api/investments/stats ───────────────────────────────────────────────
const getInvestmentStats = async (req, res) => {
  try {
    const investments = await Investment.findAll({
      where:   { investorId: req.user.id },
      include: [{
        model:      Property,
        as:         'property',           // ✅ fix: tambah as
        attributes: ['title', 'category'],
      }],
      order: [['createdAt', 'ASC']],
    });

    const monthlyData = investments.reduce((acc, inv) => {
      const month = inv.createdAt.toISOString().slice(0, 7);
      if (!acc[month]) acc[month] = { month, invested: 0, tokens: 0 };
      acc[month].invested += inv.totalPaid;
      acc[month].tokens   += inv.tokenAmount;
      return acc;
    }, {});

    const categoryData = investments.reduce((acc, inv) => {
      const cat = inv.property?.category ?? 'Unknown'; // ✅ fix: alias lowercase + optional chain
      if (!acc[cat]) acc[cat] = { category: cat, totalPaid: 0 };
      acc[cat].totalPaid += inv.totalPaid;
      return acc;
    }, {});

    return res.status(200).json({
      status: 'success',
      data: {
        monthly:    Object.values(monthlyData),
        byCategory: Object.values(categoryData),
      },
    });
  } catch (error) {
    console.error('[getInvestmentStats]', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = { createInvestment, getMyPortfolio, getInvestmentStats };