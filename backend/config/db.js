const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

const connectDB = async () => {
  try {
    // Test the connection
    const [rows, fields] = await promisePool.query('SELECT 1');
    console.log('MySQL Connected...');
  } catch (err) {
    console.error('Error connecting to MySQL:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = { connectDB, promisePool };
