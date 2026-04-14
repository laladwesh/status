const User = require("../models/User");

const ensureAdminUser = async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      "ADMIN_USERNAME / ADMIN_PASSWORD are not set. Skipping automatic admin user bootstrap."
    );
    return;
  }

  const existingUser = await User.findOne({ username }).lean();
  if (existingUser) {
    return;
  }

  const adminUser = new User({ username, password });
  await adminUser.save();
  console.log(`Admin user '${username}' created from environment variables.`);
};

module.exports = {
  ensureAdminUser,
};
