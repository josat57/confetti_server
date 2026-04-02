/**
 * Test script for business profile update endpoint
 *
 * Usage: node test-business-profile-update.js YOUR_JWT_TOKEN
 */

const token = process.argv[2];

if (!token) {
  console.error("Please provide JWT token as argument");
  console.error("Usage: node test-business-profile-update.js YOUR_JWT_TOKEN");
  process.exit(1);
}

const testUpdate = async () => {
  try {
    console.log("Testing business profile update...\n");

    // Test data
    const updateData = {
      description: "Updated description from test script",
      yearEstablished: 2020,
    };

    console.log(
      "Sending PUT request to http://localhost:9600/api/v1/business-profile"
    );
    console.log("Update data:", JSON.stringify(updateData, null, 2));
    console.log("");

    const response = await fetch(
      "http://localhost:9600/api/v1/business-profile",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      }
    );

    console.log("Response status:", response.status, response.statusText);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );
    console.log("");

    const responseText = await response.text();
    console.log("Response body (raw):", responseText);
    console.log("");

    try {
      const responseJson = JSON.parse(responseText);
      console.log(
        "Response body (parsed):",
        JSON.stringify(responseJson, null, 2)
      );

      if (response.ok) {
        console.log("\n✅ SUCCESS: Profile updated successfully!");
      } else {
        console.log("\n❌ ERROR: Request failed");
        console.log("Error message:", responseJson.message || "Unknown error");
      }
    } catch (e) {
      console.log("Failed to parse response as JSON");
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
  }
};

testUpdate();
