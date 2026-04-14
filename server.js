const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

require("dotenv").config();

const statusRoutes = require("./routes/statusRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { startMonitoring, runStatusCheck } = require("./services/monitorService");
const { ensureAdminUser } = require("./services/userService");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: false,
    })
  );
}

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api", statusRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client/build");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).end();
    }
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

app.use("/api", (req, res) => {
  return res.status(404).json({ message: "API route not found." });
});

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is required in environment variables.");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in environment variables.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected.");

    await ensureAdminUser();
    await runStatusCheck();
    startMonitoring();

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
