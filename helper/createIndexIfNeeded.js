const User = require("../models/User");
const createIndexIfNeeded = async () => {
  try {
    const indexExists = await User.collection.indexExists('email_1');

    if (!indexExists) {
      await User.collection.createIndex({ email: 1 }, { unique: true });
      console.log('Email index created successfully');
    }
  } catch (error) {
    console.error('Error creating index:', error);
  }
};
module.exports = createIndexIfNeeded;