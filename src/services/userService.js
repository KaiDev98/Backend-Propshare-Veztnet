const { User } = require('../models');

const findByEmail = (email) => {
  return User.findOne({ where: { email } });
};

const findByWallet = (walletAddress) => {
  return User.findOne({ where: { walletAddress } });
};

const findById = (id) => {
  return User.findByPk(id, {
    attributes: ['id', 'email', 'fullName', 'role', 'walletAddress', 'phone', 'avatar'],
  });
};

const createUser = (data) => {
  return User.create(data);
};

const updateUser = async (id, data) => {
  await User.update(data, { where: { id } });
  return User.findByPk(id);
};

module.exports = { findByEmail, findByWallet, findById, createUser, updateUser };