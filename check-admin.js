import mongoose from "mongoose";
import Admin from "./src/node/models/Admin.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const checkAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27018/confetti"
    );
    console.log("Connected to MongoDB");

    const email = "power.admin@confetti.com";

    // Find admin
    const admin = await Admin.findOne({ email });

    if (!admin) {
      console.log(`❌ Admin with email ${email} NOT FOUND`);
      console.log("\nAvailable admins:");
      const allAdmins = await Admin.find({}, "email firstName lastName role");
      console.log(allAdmins);
    } else {
      console.log("✓ Admin found:");
      console.log({
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        permissions: admin.permissions,
        isActive: admin.isActive,
        passwordHash: admin.password.substring(0, 20) + "...",
        createdAt: admin.createdAt,
      });

      // Test password comparison
      const testPassword = "Ginger@123A";
      console.log("\n--- Password Test ---");
      console.log("Testing password:", testPassword);

      const isValid = await admin.comparePassword(testPassword);
      console.log("Password valid:", isValid);

      // Manual bcrypt comparison
      const manualCheck = await bcrypt.compare(testPassword, admin.password);
      console.log("Manual bcrypt check:", manualCheck);

      // Test with wrong password
      const wrongCheck = await admin.comparePassword("WrongPassword123");
      console.log("Wrong password check:", wrongCheck);
    }

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

checkAdmin();
