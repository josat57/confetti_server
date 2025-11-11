import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scripts = [
  "seed-vendor-categories.js",
  "seed-vendors-lagos.js",
  "seed-vendors-abuja.js",
];

async function runScript(scriptName) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${scriptName}`);
  console.log("=".repeat(60));

  try {
    const scriptPath = path.join(__dirname, scriptName);
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`);

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`✅ ${scriptName} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${scriptName} failed:`, error.message);
    return false;
  }
}

async function seedAll() {
  console.log("\n🌱 Starting AI Event Planner Database Seeding...\n");

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  for (const script of scripts) {
    const success = await runScript(script);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Seeding Summary");
  console.log("=".repeat(60));
  console.log(`✅ Successful: ${successCount}/${scripts.length}`);
  console.log(`❌ Failed: ${failCount}/${scripts.length}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log("=".repeat(60));

  if (failCount === 0) {
    console.log("\n🎉 All seeding scripts completed successfully!");
    console.log("\n📝 Next Steps:");
    console.log("  1. Start your Node.js server");
    console.log("  2. Test the AI Event Planner API:");
    console.log("     POST /api/v1/ai-planner/analyze");
    console.log("  3. Check vendor data:");
    console.log("     GET /api/v1/vendors");
    process.exit(0);
  } else {
    console.log(
      "\n⚠️  Some seeding scripts failed. Please check the errors above."
    );
    process.exit(1);
  }
}

seedAll();
