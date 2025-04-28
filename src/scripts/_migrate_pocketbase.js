/**
 * SQL to PocketBase Migration Tool
 *
 * This script reads a sql dump file and imports the data into a PocketBase database after some minimal transformations.
 * It is an ES6 module and should be as generic as possible to support different data schemas.
 *
 * REQUIREMENTS:
 * 1. Use SQLite to parse SQL dump - this ensures proper handling of quotes, escapes, and newlines
 *    DO NOT try to parse SQL manually as it's error-prone and unnecessary
 *
 * 2. Schema Rules:
 *    - NO hard-coded schema definitions - this is a general tool
 *    - Only define necessary transformations (e.g., id->key, dateCreated->created)
 *    - Only define validation rules (e.g., field name restrictions)
 *    - Schema should be inferred from the data where possible
 *    - references to primary keys like 'post_id' or 'postid' should be transformed to 'post' for PocketBase and should reference the newly remapped 'key' field
 *
 * 3. Data Validation:
 *    - Validate field names against PocketBase restrictions
 *    - Validate data types and required fields
 *    - Transform data to match PocketBase requirements
 *
 * 4. Error Handling:
 *    - Clear error messages for validation failures
 *    - Graceful handling of PocketBase connection issues
 *    - Proper cleanup of resources (SQLite connection, etc.)
 *
 * 5. Script Execution:
 *    - MUST be run via npm script: 'npm run migrate_2_pocketbase'
 *    - DO NOT run directly with node
 *
 * 6. npm script requirement:
 *    - This script requires the 'pocketbase' package to be installed in the project
 *
 * Code Style Requirements:
 * 1. Use function declarations not arrow functions for top-level functions
 * 2. Use camelCase for function and variable names
 * 3. Use UPPER_SNAKE_CASE for constants
 * 5. Proper error handling with try/catch
 * 6. No console.log - use logger
 * 7. Make only minimal and necessary changes - never remove code unrelated to current task
 * 8. Write compact, terse code - use chaining and maximize horizontal space over vertical verbosity
 * 9. Never use blank (empty) lines inside functions. Divide code with comments only
 * 10. Make code vertically compact. Use 1 space for indentation and do not use unnecessary brackets or lines
 */

import fs from 'fs'
import PocketBase from 'pocketbase'
import sqlite3 from 'sqlite3'
import util from 'util'
import dotenv from 'dotenv'

dotenv.config()

const LOGGER = {
  info: (...args) => console.log('•', ...args),
  success: (...args) => console.log('✓', ...args),
  error: (message, details) => {
    console.error('❌', message)
    if (details) console.error('   Details:', JSON.stringify(details, null, 2))
  },
  warn: (message) => console.warn('⚠', message)
}

const fieldTransformations = {
  categories: {
    key: { source: 'id', type: 'text', required: true, unique: true },
    category: { type: 'text' },
    image: { type: 'text' },
    description: { type: 'text' },
  },
  posts: {
    key: { source: 'id', type: 'text', required: true, unique: true },
    base: { source: 'baseid', type: 'text' },
    path: { source: 'url', type: 'text' },
    post_type: { source: 'post_type', type: 'text' },
    language: { source: 'language', type: 'text' },
    draft: { source: 'draft', type: 'bool', default: false },
    datepublished: { source: 'datepublished', type: 'date', default: null },
    modified: { source: 'datemodified', type: 'date', default: null, system: true },
    image: { source: 'image', type: 'text' },
    body: { source: 'body', type: 'json' },
    meta: {
      type: 'json',
      fields: {
        title: { source: 'title' },
        description: { source: 'description' },
        desc_125: { source: 'desc_125' },
        abstract: { source: 'abstract' },
        author: { source: 'author' },
        editor: { source: 'editor' },
        slug: { source: 'url' },
        topics: { source: 'topics', default: [] },
        keywords: { source: 'keywords', default: [] },
      },
    },
    audio: {
      type: 'json',
      fields: {
        audio_url: { source: 'audio' },
        audio_duration: { source: 'audio_duration' },
        audio_image: { source: 'audio_image' },
        narrator: { source: 'narrator', default: 'auto' },
        regenerate: { default: false },
      },
    },
  },
  comments: {
    key: { source: 'id', type: 'text', required: true, unique: true },
    post: { source: 'postid', type: 'text' },
    parent: { source: 'parentid', type: 'text' },
    name: { type: 'text' },
    content: { type: 'text' },
    moderated: { type: 'bool', default: false },
    date: { type: 'date', default: null },
    starred: { type: 'bool', default: false },
  },
  cron: {
    key: { source: 'task', type: 'text', required: true, unique: true },
    time: { type: 'text' },
  },
  // ("id" text PRIMARY KEY, "name" text, "title" text, "image_src" text, "image_alt" text, "external" integer, "email" text NOT NULL, "isFictitious" integer, "jobTitle" text, "type" text, "url" text, "worksFor_type" text, "worksFor_name" text, "description" text, "sameAs_linkedin" text, "sameAs_twitter" text, "sameAs_facebook" text, "description_125" text, "description_250" text, "biography" text);
  team: {
    key: { source: 'id', type: 'text', required: true, unique: true },
    name: { type: 'text' },
    title: { type: 'text' },
    image_src: { type: 'text' },
    image_alt: { type: 'text' },
    external: { type: 'text' },
    email: { type: 'text' },
    isfictitious: { type: 'text' },
    jobtitle: { type: 'text' },
    type: { type: 'text' },
    url: { type: 'text' },
    worksfor_type: { type: 'text' },
    worksfor_name: { type: 'text' },
    description: { type: 'text' },
    sameas_linkedin: { type: 'text' },
    sameas_twitter: { type: 'text' },
    sameas_facebook: { type: 'text' },
    description_125: { type: 'text' },
    description_250: { type: 'text' },
    biography: { type: 'text' },
  },
  topics: {
    key: { source: 'id', type: 'text', required: true, unique: true },
    name: { type: 'text' },
    title: { type: 'text' },
    description: { type: 'text' },
    image: { type: 'text' },
    faqs: { type: 'text' },
  },
  // ("id" text PRIMARY KEY, "name" text, "email" text, "hashed_password" text, "role" text)
  users: {
    // key: { source: 'id', type: 'text', required: true, unique: true },
    name: { type: 'text' },
    email: { type: 'text' },
    hashed_password: { type: 'text' },
    role: { type: 'text' },
  },
};




async function loadSqlData(sqlFilePath) {
  const db = new sqlite3.Database(':memory:');
  const exec = util.promisify(db.exec.bind(db));
  const query = util.promisify(db.all.bind(db));

  try {
    const sqlContent = await fs.promises.readFile(sqlFilePath, 'utf8');
    await exec(sqlContent);

    const tables = await query("SELECT name FROM sqlite_master WHERE type='table'");
    const data = {};

    for (const { name } of tables) {
      const schema = await extractTableSchema(db, name);
      const records = await query(`SELECT * FROM ${name}`);
      data[name] = { schema, records };
    }

    return data;
  } finally {
    db.close();
  }
}

async function createCollections(pb, transformedData, clearFlag) {
  const log = LOGGER;
  try {
    if (clearFlag) {
      log.info('Clearing imported collections...');
      for (const collName of Object.keys(transformedData)) {
        try {
          log.info(`Attempting to delete collection: ${collName}`);
          await pb.collections.delete(collName);
          log.success(`Deleted collection: ${collName}`);
        } catch (deleteError) {
          if (deleteError.status !== 404) {
            log.error(`Failed to delete collection: ${collName}`, {
              error: deleteError.response?.data || deleteError.message,
            });
            throw new Error(`Failed to delete collection: ${collName}`);
          }
          log.warn(`Collection ${collName} does not exist. Skipping.`);
        }
      }
    }

    for (const [collName, { schema, records }] of Object.entries(transformedData)) {
      log.info(`Creating collection: ${collName}`);
      try {
        const fields = transformSchema(schema, collName);
        validateSchema(fields);
        log.info(`Transformed schema for ${collName}: ${JSON.stringify(fields, null, 2)}`);

        await pb.collections.create({
          name: collName,
          type: 'base',
          fields,
        });

        log.success(`Created collection: ${collName}`);

        // Transform records using transformRecord
        const transformedRecords = records.map(record =>
          transformRecord(record, collName.toLowerCase())
        );

        log.info(
          `Final transformed records for ${collName}: ${JSON.stringify(transformedRecords.slice(0, 3), null, 2)}`
        );

        await insertRecords(pb, collName, transformedRecords);
        await verifyRecords(pb, collName, transformedRecords);
      } catch (error) {
        log.error(`Failed to create collection ${collName}`, {
          error: error.response?.data || error.message,
        });
        throw new Error(`Collection creation failed for ${collName}`);
      }
    }
  } catch (error) {
    log.error('Collection creation failed.', { error: error.message });
    throw error;
  }
}


async function insertRecords(pb, tableName, records) {
  const failedRecords = [];
  for (const record of records) {
    try {
      await pb.collection(tableName).create(record);
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      LOGGER.error(`Failed to insert record (key: ${record.key})`, { error: errorDetails });
      failedRecords.push(record.key);
    }
  }
  if (failedRecords.length) {
    LOGGER.warn(`Failed to insert ${failedRecords.length} records into ${tableName}.`);
  } else {
    LOGGER.success(`All records inserted into ${tableName}`);
  }
}


async function verifyRecords(pb, tableName, originalRecords) {
  const log = LOGGER;
  try {
    log.info(`Verifying ${originalRecords.length} records for ${tableName}...`);
    const insertedRecords = await pb.collection(tableName).getFullList(1000); // Adjust limit as needed
    const mismatches = [];

    for (let i = 0; i < originalRecords.length; i++) {
      const original = originalRecords[i];
      const inserted = insertedRecords.find(rec => rec.key === original.key);

      if (!inserted) {
        mismatches.push({ key: original.key, reason: 'Record not found in PocketBase.' });
        continue;
      }

      // Compare fields
      for (const [field, value] of Object.entries(original)) {
        if (inserted[field] !== value) {
          mismatches.push({ key: original.key, field, original: value, inserted: inserted[field] });
        }
      }
    }

    if (mismatches.length > 0) {
      log.warn(`${mismatches.length} mismatches found in ${tableName}:`, mismatches);
    } else {
      log.success(`All records in ${tableName} verified successfully.`);
    }
  } catch (error) {
    log.error(`Failed to verify records for ${tableName}:`, { error: error.message });
    throw error;
  }
}

function transformSchema(schema, tableName) {
  const transformations = fieldTransformations[tableName];
  if (!transformations) throw new Error(`No field transformations defined for table: ${tableName}`);

  return Object.entries(transformations).map(([name, config]) => ({
    name,
    type: config.type,
    required: !!config.required,
    unique: !!config.unique,
    options: config.options || undefined,
  }));
}

function transformRecord(record, tableName) {
  const transformations = fieldTransformations[tableName];
  if (!transformations) throw new Error(`No field transformations defined for table: ${tableName}`);

  const transformedRecord = {};

  for (const [field, config] of Object.entries(transformations)) {
    const source = config.source || field;

    if (config.type === 'json' && config.fields) {
      // Grouped fields: initialize the group if it doesn't exist
      transformedRecord[field] = {};
      for (const [subField, subConfig] of Object.entries(config.fields)) {
        const subSource = subConfig.source || subField;
        transformedRecord[field][subField] =
          record[subSource] !== undefined ? record[subSource] : subConfig.default || null;
      }
    } else {
      // Handle non-grouped fields
      transformedRecord[field] =
        record[source] !== undefined ? record[source] : config.default || null;
    }

    // Log the transformation for debugging
    LOGGER.info('Field Transformation:', {
      tableName,
      field,
      source,
      value: transformedRecord[field],
    });
  }

  return transformedRecord;
}

async function transformAndValidateData(rawData) {
  const log = LOGGER;
  const transformedData = {};

  for (const [tableName, table] of Object.entries(rawData)) {
    const tableTransformations = fieldTransformations[tableName.toLowerCase()];

    if (!tableTransformations) {
      log.warn(`No field transformations defined for table: ${tableName}. Skipping.`);
      continue;
    }

    log.info(`Transforming table: ${tableName}`); // Add this log for debugging

    // Transform schema
    const transformedSchema = Object.entries(tableTransformations).map(([field, config]) => ({
      name: field,
      type: config.type || 'text',
      required: config.required || false,
      unique: config.unique || false,
      options: config.default !== undefined ? { default: config.default } : undefined,
      system: config.system || false,
    }));

    // Transform records
    const transformedRecords = table.records.map(record =>
      Object.entries(tableTransformations).reduce((acc, [field, config]) => {
        const source = config.source || field;
        acc[field] = record[source] !== undefined ? record[source] : config.default || null;
        return acc;
      }, {})
    );

    transformedData[tableName.toLowerCase()] = { schema: transformedSchema, records: transformedRecords };
  }

  return transformedData;
}

function validateSchema(schema) {
  schema.forEach(field => {
    if (!['text', 'bool', 'date', 'url', 'editor', 'json'].includes(field.type)) {
      LOGGER.warn(`Unmapped or unexpected type detected for field "${field.name}": "${field.type}".`);
    }
  });
}

async function extractTableSchema(db, tableName) {
  const query = util.promisify(db.all.bind(db));

  // Get basic schema using PRAGMA
  const schema = await query(`PRAGMA table_info(${tableName})`);

  // Get the CREATE TABLE statement for constraints
  const createTableSQL = await query(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  const createSQL = createTableSQL?.[0]?.sql;

  // Map columns and include constraints
  return schema.map(column => ({
    ...column,
    type: column.type.toUpperCase(),
    notnull: column.notnull === 1,
    pk: column.pk === 1,
    constraints: extractConstraintsForColumn(createSQL, column.name), // Extract column constraints
  }));
}

function extractConstraintsForColumn(createSQL, columnName) {
  if (!createSQL || !columnName) return null;

  // Regular expression to capture column definition and constraints
  const columnRegex = new RegExp(
    `${columnName}\\s+[^,]*?(CHECK\\s*\\(.*?\\))?`, // Match the column definition with optional CHECK
    'i'
  );
  const match = columnRegex.exec(createSQL);

  // Return the matched CHECK constraint or null
  return match?.[1] || null;
}

function validateRecord(record, schema) {
  for (const { name, required, type } of schema) {
    const value = record[name];
    if (required && (value === undefined || value === null)) {
      throw new Error(`Validation failed: Required field "${name}" is missing.`);
    }
    if (type === 'date' && value && isNaN(Date.parse(value))) {
      throw new Error(`Validation failed: Field "${name}" is not a valid date.`);
    }
  }
}


function validateAllRecords(records, schema) {
  records.forEach((record) => validateRecord(record, schema));
}


/**
 * Main migration function
 */
async function main() {
  const log = LOGGER;
  try {
    const [sqlFile, pbUrl, ...flags] = process.argv.slice(2);
    if (!sqlFile || !pbUrl) {
      log.error('Usage: npm run migrate_2_pocketbase <sql_file> <pocketbase_url> [--clear]');
      process.exit(1);
    }

    const clearFlag = flags.includes('--clear');
    const pb = new PocketBase(pbUrl);
    await pb.admins.authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL,
      process.env.POCKETBASE_ADMIN_PASSWORD
    );

    log.info('=== Loading SQL Data ===');
    const sqlData = await loadSqlData(sqlFile);

    log.info('=== Transforming Data ===');
    const transformedData = await transformAndValidateData(sqlData);

    log.info('=== Creating Collections and Inserting Records ===');
    await createCollections(pb, transformedData, clearFlag);

    log.success('Migration complete!');
  } catch (e) {
    log.error('Migration failed:', { error: e.message });
    process.exit(1); // Exit on any failure
  }
}

main()
