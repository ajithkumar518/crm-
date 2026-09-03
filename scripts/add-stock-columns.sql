/* ============================================================================
   Add currentStock + stockUpdatedAt columns to Product and product1 tables
   ============================================================================

   Run this once against shahnaz_crm database using sukierpadmin (or dbo-level
   account). Safe to re-run — uses IF NOT EXISTS guards.

   Tables:
     dbo.Product   — the live table the CRM app reads (Prisma "Product" model)
     dbo.product1  — legacy ERP staging table (kept in sync for reference)
   ============================================================================ */

USE shahnaz_crm;

-- ── dbo.Product ──────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Product') AND name = 'currentStock'
)
BEGIN
    ALTER TABLE dbo.Product ADD currentStock FLOAT NULL CONSTRAINT DF_Product_currentStock DEFAULT (0);
    PRINT 'Added currentStock to dbo.Product';
END
ELSE
    PRINT 'currentStock already exists on dbo.Product — skipping';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Product') AND name = 'stockUpdatedAt'
)
BEGIN
    ALTER TABLE dbo.Product ADD stockUpdatedAt DATETIME2 NULL;
    PRINT 'Added stockUpdatedAt to dbo.Product';
END
ELSE
    PRINT 'stockUpdatedAt already exists on dbo.Product — skipping';

-- ── dbo.product1 ─────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.product1') AND name = 'currentStock'
)
BEGIN
    ALTER TABLE dbo.product1 ADD currentStock FLOAT NULL CONSTRAINT DF_product1_currentStock DEFAULT (0);
    PRINT 'Added currentStock to dbo.product1';
END
ELSE
    PRINT 'currentStock already exists on dbo.product1 — skipping';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.product1') AND name = 'stockUpdatedAt'
)
BEGIN
    ALTER TABLE dbo.product1 ADD stockUpdatedAt DATETIME2 NULL;
    PRINT 'Added stockUpdatedAt to dbo.product1';
END
ELSE
    PRINT 'stockUpdatedAt already exists on dbo.product1 — skipping';
