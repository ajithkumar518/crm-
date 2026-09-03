import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

const password = process.env.ERP_ADMIN_PASSWORD;
if (!password) {
  console.error('ERROR: Set ERP_ADMIN_PASSWORD environment variable to the sukierpadmin SQL login password.');
  process.exit(1);
}

const __filename = fileURLToPath(new URL(import.meta.url));
const __dirname = path.dirname(__filename);
const sqlPath = path.join(__dirname, 'scripts', 'erp-product-sync.sql');
const sqlText = fs.readFileSync(sqlPath, 'utf-8');

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
  requestTimeout: 300000, // 5 minutes
  connectionTimeout: 30000,
};

async function main() {
  let pool;
  try {
    console.log('Connecting to 192.168.1.160 as sukierpadmin...');
    pool = await sql.connect(config);
    console.log('Connected. Running scripts/erp-product-sync.sql ...');

    // MERGE is a single statement; execute it directly.
    await pool.request().batch(sqlText);

    console.log('ERP product sync executed successfully.');

    // Quick verification
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN LEN(productCode) > 0 THEN 1 ELSE 0 END) AS withCode,
             SUM(CASE WHEN companyId = '48f22355-52af-4f69-a278-05f8b3b7db03' THEN 1 ELSE 0 END) AS sukiRows
      FROM shahnaz_crm.dbo.Product
      WHERE deletedAt IS NULL
    `);
    console.log('Verification:', result.recordset[0]);

    const audit = await pool.request().query(`
      SELECT TOP 5 productCode, name, updatedAt
      FROM shahnaz_crm.dbo.Product
      WHERE deletedAt IS NULL
      ORDER BY updatedAt DESC
    `);
    console.log('Last 5 updated products:');
    console.table(audit.recordset);

  } catch (err) {
    console.error('ERP sync failed:', err);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
