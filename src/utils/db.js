import { createClient } from '@vercel/postgres';
import brand from '@data/branding.json';
// import for hashPassword
import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 2;

/**
 * Connects to the PostgreSQL database using environment variables and returns the client.
 * @returns {Promise<import('@vercel/postgres').Client>} The connected database client.
 */
export async function connectDB() {
  const client = createClient(process.env.POSTGRES_URL);
  await client.connect();
  return client;
}
// check if user table exists and create one if necessary
export async function enforceUsersTable(db) {
  const tableExistsQuery = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    );
  `;
  const tableExistsResult = await db.query(tableExistsQuery);
  const tableExists = tableExistsResult.rows[0].exists;

  if (!tableExists) {
    const createTableQuery = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL
      );
    `;
    await db.query(createTableQuery);
  }
  await enforceSuperUser(db);
}
export async function enforceSuperUser(db) {
  // console.log('enforceSuperUser')
  // if user not found in db, create one - process.env.SITE_ADMIN_EMAIL
  // const user = process.env.SITE_ADMIN_NAME
  const email = process.env.SITE_ADMIN_EMAIL
  const hashedPassword = await bcrypt.hash(process.env.SITE_ADMIN_PASS, SALT_ROUNDS);
  const role = 'admin'
  const userExistsQuery = 'SELECT * FROM users WHERE email = $1 LIMIT 1;';
  const userExistsResult = await db.query(userExistsQuery, [email]);
  // console.log('row count', userExistsResult.rowCount)
  if (userExistsResult.rowCount === 0) {
    const insertUserQuery = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4);
    `;
    await db.query(insertUserQuery, [brand.author, email, hashedPassword, role]);
  }
  // console.log('enforceSuperUser done', email, hashedPassword)
}

/**
 * Handles the login process for a user. This function checks the provided credentials,
 * and on successful authentication, returns a user object with the user's information.
 * In case of a failed authentication, it returns a user object with default values and an error message.
 */
export async function getUser(email, password) {
  let user = {email, role:'guest', name:'', authenticated:false, id:null, error:'' };

  // Connect to the database
  const db = await connectDB();
  if (!db) return {...user, authenticated: false, error: 'Database connection failed'};

  // create table it nonexistent and enforce super user
  await enforceUsersTable(db);

  const userQuery = 'SELECT * FROM users WHERE email = $1 LIMIT 1;';
  const userResult = await db.query(userQuery, [email]);
  db.end(); // close the connection, don't wait

  // no matching user found
  if (userResult.rowCount === 0) {
      console.log('User not found');
      return {...user, error: 'User not found'};
  } else { // found a matching user
      console.log('User found');
      const {id, name, role, password_hash} = userResult.rows[0];
      const passwordMatches = await bcrypt.compare(password, password_hash);
      // bad password
      if (!passwordMatches) return {...user, error: 'Password failed'};
      // good password but non-admin/editor role, perhaps suspended user
      if (!['admin', 'editor'].includes(role)) return {...user, error: "invalid role"}
      // good password and good role
      return {...user, id, name, role, authenticated: true}
  }
}

// function to add new user to the database, admin only
export async function addUser(name, email, password, role) {
  const db = await connectDB();
  if (!db) {
    console.log('Database connection failed')
    return { error: 'Database connection failed', redirect: setupPath };
  } else console.log('Database connected successfully')

  await enforceUsersTable(db);
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  // fail out if user name or email already exists:
  const userExistsQuery = 'SELECT * FROM users WHERE email = $1 LIMIT 1;';
  const userExistsResult = await db.query(userExistsQuery, [email]);
  if (userExistsResult.rowCount > 0) {
    db.end(); // close the connection, don't wait
    return { error: 'User already exists' };
  }
  // looks gook, let's insert
  const insertUserQuery = `
    INSERT INTO users (name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;
  const insertUserResult = await db.query(insertUserQuery, [name, email, hashedPassword, role]);
  db.end(); // close the connection, don't wait

  if (insertUserResult.rowCount === 0) return { error: 'User not added'};
  return { id: insertUserResult.rows[0].id };
}


