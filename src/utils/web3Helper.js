const { ethers } = require('ethers');

// Pastikan SEPOLIA_RPC_URL sudah ada di .env Anda
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

/**
 * Memverifikasi validitas transaksi di Blockchain
 * @param {string} txHash - Hash transaksi dari client
 * @returns {Promise<boolean>} - True jika transaksi sukses dan terkonfirmasi
 */
const verifyOnChain = async (txHash) => {
  try {
    if (!txHash) return false;

    // 1. Ambil receipt (tanda terima) transaksi
    const receipt = await provider.getTransactionReceipt(txHash);

    // 2. Cek apakah transaksi ada dan statusnya 1 (Success)
    // Di ethers v6, status 1 artinya Success, 0 artinya Reverted/Failed
    if (receipt && receipt.status === 1) {
      console.log(`[Web3] Transaksi terverifikasi di Block: ${receipt.blockNumber}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[Web3 Error] Gagal verifikasi txHash: ${txHash}`, error.message);
    return false;
  }
};

module.exports = { verifyOnChain, provider };