/* ============================================================================
   ERP Product Sync — shahnaz_crm.dbo.Product  ←  ERPDb_SHAHNAZ_CHE.dbo.PRODUCT
   ============================================================================

   PURPOSE
   -------
   Syncs product master data, current stock and category from the ERP database
   into the live CRM table (dbo.Product).

   Stock is pulled from ERPDb_SHAHNAZ_CHE.dbo.daily_trans.
   Category is looked up from shahnaz_crm.dbo.ProductCategory by RM_GRADE.
   ============================================================================ */

DECLARE @CompanyId NVARCHAR(450) = '48f22355-52af-4f69-a278-05f8b3b7db03'; -- Suki Software

MERGE shahnaz_crm.dbo.Product AS target
USING (
    SELECT PART_NO, PART_NAME, uom, PRICE, PROD_STATUS, EXCISE_CHAPTER_NO,
           CREAT_DT, LST_UPDT_TS, PROD_GRADE, size, PROD_CATEGORY, FILE_NAME,
           bal, caterId
    FROM (
        SELECT
            a.PART_NO, a.PART_NAME, a.uom, a.PRICE, a.PROD_STATUS, a.EXCISE_CHAPTER_NO,
            a.CREAT_DT, a.LST_UPDT_TS, a.PROD_GRADE, a.size, a.PROD_CATEGORY, a.FILE_NAME,
            ISNULL(b.bal, 0) AS bal,
            c.id AS caterId,
            ROW_NUMBER() OVER (
                PARTITION BY a.PART_NO
                ORDER BY CASE WHEN a.LST_UPDT_TS IS NULL THEN 1 ELSE 0 END, a.LST_UPDT_TS DESC
            ) AS rn
        FROM ERPDb_SHAHNAZ_CHE.dbo.PRODUCT a
        LEFT JOIN (
            SELECT mat_code, SUM(QTY_REC) - SUM(QTY_ISSUE) AS bal
            FROM ERPDb_SHAHNAZ_CHE.dbo.daily_trans
            GROUP BY mat_code
        ) b ON b.mat_code = a.prod_cd
        LEFT JOIN dbo.ProductCategory c ON c.name = a.RM_GRADE
        WHERE a.PART_NO IS NOT NULL
    ) x
    WHERE rn = 1
) AS source
ON target.companyId = @CompanyId AND target.productCode = source.PART_NO
WHEN MATCHED THEN
    UPDATE SET
        target.productCode      = source.PART_NO,
        target.name             = source.PART_NAME,
        target.description      = source.PART_NAME,
        target.unit             = source.uom,
        target.basePrice        = source.PRICE,
        target.isActive         = CASE WHEN UPPER(LTRIM(RTRIM(source.PROD_STATUS))) = 'ACTIVE' THEN 1 ELSE 0 END,
        target.hsnCode          = source.EXCISE_CHAPTER_NO,
        target.updatedAt        = CASE WHEN source.LST_UPDT_TS IS NULL THEN SYSUTCDATETIME() ELSE source.LST_UPDT_TS END,
        target.minOrderQuantity   = 0,
        target.materialGrade    = source.PROD_GRADE,
        target.materialSize     = source.size,
        target.partNumber       = source.PART_NO,
        target.productType      = source.PROD_CATEGORY,
        target.productImageUrl  = source.FILE_NAME,
        target.currentStock     = source.bal,
        target.stockUpdatedAt   = SYSUTCDATETIME(),
        target.categoryId       = source.caterId,
        target.companyId        = @CompanyId
WHEN NOT MATCHED BY TARGET THEN
    INSERT (
        id, productCode, name, categoryId, description, unit, basePrice, isActive,
        companyId, hsnCode, deletedAt, deletedById, createdAt, updatedAt,
        minOrderQuantity, materialGrade, materialSize, partNumber, rmMake,
        productType, productImageUrl, currentStock, stockUpdatedAt
    )
    VALUES (
        NEWID(), source.PART_NO, source.PART_NAME, source.caterId, source.PART_NAME, source.uom,
        source.PRICE,
        CASE WHEN UPPER(LTRIM(RTRIM(source.PROD_STATUS))) = 'ACTIVE' THEN 1 ELSE 0 END,
        @CompanyId, source.EXCISE_CHAPTER_NO, NULL, NULL,
        CASE WHEN source.CREAT_DT IS NULL THEN SYSUTCDATETIME() ELSE source.CREAT_DT END,
        CASE WHEN source.LST_UPDT_TS IS NULL THEN SYSUTCDATETIME() ELSE source.LST_UPDT_TS END,
        0, source.PROD_GRADE, source.size, source.PART_NO, NULL,
        source.PROD_CATEGORY, source.FILE_NAME, source.bal, SYSUTCDATETIME()
    );
