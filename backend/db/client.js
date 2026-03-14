const { Pool } = require('pg');

let pool;

function getConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'loadtrain',
    user: process.env.DB_USER || 'loadtrain_user',
    password: process.env.DB_PASSWORD || 'loadtrain_pass',
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool(getConfig());
  }
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function checkDbHealth() {
  const startedAt = Date.now();
  try {
    const res = await query(
      'SELECT current_database() AS db_name, current_user AS db_user, NOW() AS db_time'
    );
    return {
      ok: true,
      latency_ms: Date.now() - startedAt,
      db_name: res.rows[0]?.db_name,
      db_user: res.rows[0]?.db_user,
      db_time: res.rows[0]?.db_time,
    };
  } catch (error) {
    return {
      ok: false,
      latency_ms: Date.now() - startedAt,
      error: error.message,
    };
  }
}

module.exports = {
  getPool,
  query,
  checkDbHealth,
};
