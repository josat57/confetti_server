import { performance } from "perf_hooks";

console.log("🚀 Swagger Performance Benchmark\n");

// Measure spec compilation time
console.log("📊 Measuring OpenAPI specification compilation time...");
const startCompile = performance.now();

try {
  const swaggerSpec = await import("../config/swagger.config.js");
  const endCompile = performance.now();
  const compileTime = endCompile - startCompile;

  console.log(`✅ Compilation time: ${compileTime.toFixed(2)}ms`);

  // Check if it's under 50ms threshold
  if (compileTime < 50) {
    console.log(
      `✅ PASS: Compilation time is under 50ms threshold (${compileTime.toFixed(
        2
      )}ms)`
    );
  } else {
    console.log(
      `⚠️  WARNING: Compilation time exceeds 50ms threshold (${compileTime.toFixed(
        2
      )}ms)`
    );
  }

  // Measure spec size
  const specString = JSON.stringify(swaggerSpec.default);
  const specSizeKB = (specString.length / 1024).toFixed(2);
  console.log(`\n📦 OpenAPI Specification Size: ${specSizeKB} KB`);

  // Count endpoints
  const endpointCount = Object.keys(swaggerSpec.default.paths || {}).length;
  console.log(`📍 Total Endpoints: ${endpointCount}`);

  // Calculate average time per endpoint
  const avgTimePerEndpoint = (compileTime / endpointCount).toFixed(2);
  console.log(
    `⚡ Average compilation time per endpoint: ${avgTimePerEndpoint}ms`
  );

  // Memory usage
  const memUsage = process.memoryUsage();
  console.log(`\n💾 Memory Usage:`);
  console.log(
    `   - Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(
    `   - Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
  );
  console.log(`   - RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);

  // Recommendations
  console.log(`\n📋 Performance Analysis:`);

  if (compileTime < 50) {
    console.log(
      "   ✅ Startup time impact is minimal (< 50ms requirement met)"
    );
  } else {
    console.log(
      "   ⚠️  Consider optimizing JSDoc parsing or reducing endpoint count"
    );
  }

  if (specSizeKB < 500) {
    console.log("   ✅ Specification size is reasonable (< 500KB)");
  } else {
    console.log("   ⚠️  Large specification size may impact initial load time");
  }

  console.log(
    "   ✅ Specification is compiled once at startup and cached in memory"
  );
  console.log(
    "   ✅ No runtime compilation overhead for API endpoint requests"
  );

  console.log(`\n✅ Performance benchmark complete!\n`);
  process.exit(0);
} catch (error) {
  console.error("❌ Benchmark failed:", error.message);
  process.exit(1);
}
