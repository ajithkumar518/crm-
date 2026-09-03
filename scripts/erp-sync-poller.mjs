import sql from 'mssql';

const password = process.env.ERP_ADMIN_PASSWORD;
if (!password) {
  console.error('Set ERP_ADMIN_PASSWORD to sukierpadmin password');
  process.exit(1);
}

const config = {
  server: '192.168.1.160',
  port: 1433,
  database: 'shahnaz_crm',
  user: 'sukierpadmin',
  password,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  requestTimeout: 300000,
  connectionTimeout: 30000,
};

const PRODUCT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const CATEGORY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

let pool = null;
let lastCategorySync = 0;

async function ensurePool() {
  if (pool && pool.connected) return pool;
  try {
    if (pool) await pool.close().catch(() => {});
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log(`[${new Date().toISOString()}] (Re)connected to 192.168.1.160`);
    return pool;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Connection failed:`, err.message);
    pool = null;
    throw err;
  }
}

async function runProcedure(name) {
  try {
    const p = await ensurePool();
    const start = Date.now();
    await p.request().query(`EXEC dbo.${name};`);
    console.log(`[${new Date().toISOString()}] ${name} completed in ${Date.now() - start}ms`);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ${name} failed:`, err.message);
    pool = null; // force reconnect next cycle
    return false;
  }
}

async function tick() {
  const now = Date.now();
  if (now - lastCategorySync >= CATEGORY_INTERVAL_MS) {
    console.log(`[${new Date().toISOString()}] Running daily category sync...`);
    await runProcedure('sp_SyncErpProductCategories');
    lastCategorySync = Date.now();
    // Run product sync right after category sync so new categories are applied
    await runProcedure('sp_SyncErpProducts');
  } else {
    await runProcedure('sp_SyncErpProducts');
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting ERP sync poller`);
  console.log(`  Products sync every ${PRODUCT_INTERVAL_MS / 1000}s (${PRODUCT_INTERVAL_MS / 60000} min)`);
  console.log(`  Categories sync every ${CATEGORY_INTERVAL_MS / 1000}s (${CATEGORY_INTERVAL_MS / 3600000} hr)`);

  // Initial sync
  await ensurePool();
  await runProcedure('sp_SyncErpProductCategories');
  lastCategorySync = Date.now();
  await runProcedure('sp_SyncErpProducts');

  // Schedule recurring syncs
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Tick error:`, err.message);
    }
  }, PRODUCT_INTERVAL_MS);

  process.on('SIGINT', async () => {
    console.log('\nShutting down poller...');
    if (pool) await pool.close().catch(() => {});
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received, shutting down...');
    if (pool) await pool.close().catch(() => {});
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Poller failed to start:', err);
  process.exit(1);
});
