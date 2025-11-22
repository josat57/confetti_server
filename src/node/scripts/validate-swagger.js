import swaggerSpec from "../config/swagger.config.js";

console.log("🔍 Validating Swagger specification...\n");

try {
  // Check if spec is generated
  if (!swaggerSpec) {
    throw new Error("Swagger specification is undefined");
  }

  // Check required fields
  const requiredFields = ["openapi", "info", "paths", "components"];
  const missingFields = requiredFields.filter((field) => !swaggerSpec[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  // Check OpenAPI version
  if (!swaggerSpec.openapi.startsWith("3.0")) {
    console.warn(
      `⚠️  Warning: OpenAPI version is ${swaggerSpec.openapi}, expected 3.0.x`
    );
  }

  // Check info section
  if (!swaggerSpec.info.title || !swaggerSpec.info.version) {
    throw new Error("Info section must have title and version");
  }

  // Check paths
  const pathCount = Object.keys(swaggerSpec.paths || {}).length;
  console.log(`✅ Found ${pathCount} documented endpoints`);

  // Check components
  const schemaCount = Object.keys(swaggerSpec.components?.schemas || {}).length;
  console.log(`✅ Found ${schemaCount} schema definitions`);

  // Check security schemes
  const securitySchemes = Object.keys(
    swaggerSpec.components?.securitySchemes || {}
  );
  console.log(`✅ Found security schemes: ${securitySchemes.join(", ")}`);

  // Check tags
  const tagCount = (swaggerSpec.tags || []).length;
  console.log(`✅ Found ${tagCount} endpoint tags`);

  // List all tags
  if (swaggerSpec.tags && swaggerSpec.tags.length > 0) {
    console.log("\n📋 Endpoint Tags:");
    swaggerSpec.tags.forEach((tag) => {
      console.log(`   - ${tag.name}: ${tag.description}`);
    });
  }

  // Check for broken $ref links
  console.log("\n🔗 Checking schema references...");
  const schemas = swaggerSpec.components?.schemas || {};
  let brokenRefs = [];

  const checkRefs = (obj, path = "") => {
    if (typeof obj !== "object" || obj === null) return;

    if (obj.$ref) {
      const refPath = obj.$ref.replace("#/components/schemas/", "");
      if (!schemas[refPath]) {
        brokenRefs.push({ path, ref: obj.$ref });
      }
    }

    for (const key in obj) {
      checkRefs(obj[key], path ? `${path}.${key}` : key);
    }
  };

  checkRefs(swaggerSpec);

  if (brokenRefs.length > 0) {
    console.log("❌ Found broken schema references:");
    brokenRefs.forEach((ref) => {
      console.log(`   - ${ref.ref} at ${ref.path}`);
    });
  } else {
    console.log("✅ All schema references are valid");
  }

  console.log("\n✅ Swagger specification is valid!");
  console.log(
    "\n📚 Documentation will be available at: http://localhost:5000/api-docs"
  );
  console.log(
    "📄 OpenAPI JSON spec available at: http://localhost:5000/api-docs.json\n"
  );

  process.exit(0);
} catch (error) {
  console.error("❌ Validation failed:", error.message);
  process.exit(1);
}
