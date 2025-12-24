#!/usr/bin/env bun
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const migrationsDir = join(import.meta.dir, 'src/db/migrations');

async function runMigrations() {
  console.log('Running database migrations...\n');

  try {
    // Get all SQL migration files
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure correct order

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    console.log(`Found ${files.length} migration file(s)`);

    for (const file of files) {
      console.log(`\n--- Running migration: ${file} ---`);

      const migrationPath = join(migrationsDir, file);
      const migrationSQL = readFileSync(migrationPath, 'utf-8');

      // Split by statement breakpoint
      const statements = migrationSQL
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`Found ${statements.length} statement(s) in ${file}`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];

        try {
          await sql.unsafe(statement);
          console.log(`  ✓ Statement ${i + 1}: Success`);
        } catch (error: any) {
          // Ignore errors for already existing objects
          if (error.message?.includes('already exists') ||
              error.message?.includes('duplicate')) {
            console.log(`  ⚠ Statement ${i + 1}: Already exists (skipped)`);
          } else if (error.message?.includes('does not exist')) {
            console.log(`  ⚠ Statement ${i + 1}: Object does not exist (skipped)`);
          } else {
            // Log the full error for debugging
            console.error(`  ✗ Statement ${i + 1} FAILED:`);
            console.error(`  Error:`, error.message);
            console.error(`  SQL:`, statement.substring(0, 200));
            throw error;
          }
        }
      }

      console.log(`✓ ${file} completed`);
    }

    console.log('\n✓ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
