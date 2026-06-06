const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const PINATA_BASE_URL = 'https://api.pinata.cloud';

const getHeaders = () => ({
  pinata_api_key:        process.env.PINATA_API_KEY,
  pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
});

/**
 * Upload file ke IPFS via Pinata
 * @param {string} filePath - path lokal file
 * @param {string} fileName - nama file di IPFS
 * @returns {string} CID / IPFS hash
 */
const uploadFile = async (filePath, fileName) => {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath), { filename: fileName });
  formData.append('pinataMetadata', JSON.stringify({ name: fileName }));

  const response = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
    formData,
    { headers: { ...formData.getHeaders(), ...getHeaders() } }
  );

  return response.data.IpfsHash;
};

/**
 * Upload JSON metadata ke IPFS via Pinata
 * @param {object} jsonData
 * @param {string} name
 * @returns {string} CID / IPFS hash
 */
const uploadJSON = async (jsonData, name = 'metadata') => {
  const response = await axios.post(
    `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
    { pinataMetadata: { name }, pinataContent: jsonData },
    { headers: { 'Content-Type': 'application/json', ...getHeaders() } }
  );

  return response.data.IpfsHash;
};

/**
 * Buat URL akses publik dari CID
 * @param {string} cid
 * @returns {string}
 */
const getIPFSUrl = (cid) => {
  return `${process.env.PINATA_GATEWAY_URL}/${cid}`;
};

module.exports = { uploadFile, uploadJSON, getIPFSUrl };
