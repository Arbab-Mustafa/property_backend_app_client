// Migration script to add interest column to contact_submissions table
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not found in environment variables");
    process.exit(1);
  }

  try {
    console.log("🔧 Connecting to database...");
    const sql = neon(DATABASE_URL);

    console.log("📊 Reading migration file...");
    const migrationPath = path.join(__dirname, "migrate-contact-interest.sql");
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("🚀 Running migration...");
    const result = await sql`${migrationSQL}`;

    console.log("✅ Migration completed successfully!");
    console.log("📋 Result:", result);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
