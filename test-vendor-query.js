import mongoose from "mongoose";
import Vendor from "./src/node/models/vendor.model.js";

// Connect to MongoDB
await mongoose.connect("mongodb://localhost:27018/confetti_db");

console.log("Testing vendor query...");

// Test the exact query used by the repository
const query = {
  $or: [
    { "address.city": new RegExp("Lagos", "i") },
    { "address.state": new RegExp("Lagos", "i") },
  ],
  status: "approved",
  isVerified: true,
  $and: [
    {
      $or: [
        { eventTypes: "wedding" },
        { eventTypes: { $exists: false } },
        { eventTypes: { $size: 0 } },
      ],
    },
  ],
};

const vendors = await Vendor.find(query)
  .select({
    name: 1,
    category: 1,
    description: 1,
    averagePrice: 1,
    rating: 1,
    eventTypes: 1,
    address: 1,
  })
  .limit(200)
  .lean();

console.log(`Found ${vendors.length} vendors`);
console.log("First 3 vendors:");
vendors.slice(0, 3).forEach((vendor) => {
  console.log(
    `- ${vendor.name} (${vendor.category}) - ${vendor.eventTypes?.join(", ")}`
  );
});

await mongoose.disconnect();
