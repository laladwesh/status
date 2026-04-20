const User = require("../models/User");

const isTruthy = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const ensureAdminUser = async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const syncOnBoot = isTruthy(process.env.ADMIN_SYNC_ON_BOOT);

  if (!username || !password) {
    console.warn(
      "ADMIN_USERNAME / ADMIN_PASSWORD are not set. Skipping automatic admin user bootstrap."
    );
    return;
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    if (syncOnBoot) {
      existingUser.password = password;
      await existingUser.save();
      console.log(`Admin user '${username}' password synced from environment variables.`);
    }

    return;
  }

  const adminUser = new User({ username, password });
  await adminUser.save();
  console.log(`Admin user '${username}' created from environment variables.`);
};

module.exports = {
  ensureAdminUser,
};
