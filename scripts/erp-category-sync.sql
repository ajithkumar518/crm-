/* ============================================================================
   ERP Category Sync — shahnaz_crm.dbo.ProductCategory  ←  ERPDb_PRODUCT.RM_GRADE
   ============================================================================

   PURPOSE
   -------
   Syncs product categories from the ERP database into the CRM
   ProductCategory table once per day.
   ============================================================================ */

MERGE shahnaz_crm.dbo.ProductCategory AS target
USING (
    SELECT RM_GRADE
    FROM ERPDb_SHAHNAZ_CHE.dbo.PRODUCT
    WHERE RM_GRADE IS NOT NULL
      AND LTRIM(RTRIM(RM_GRADE)) <> ''
    GROUP BY RM_GRADE
) AS source
ON LTRIM(RTRIM(target.name)) = LTRIM(RTRIM(source.RM_GRADE))
WHEN MATCHED THEN
    UPDATE SET
        target.name = LTRIM(RTRIM(source.RM_GRADE)),
        target.updatedAt = GETDATE()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (
        id,
        name,
        description,
        isActive,
        companyId,
        createdAt,
        updatedAt,
        defaultSpecifications,
        parentCategoryId,
        defaultOverheadPercent,
        defaultMarginPercent
    )
    VALUES (
        NEWID(),
        LTRIM(RTRIM(source.RM_GRADE)),
        NULL,
        1,
        NULL,
        GETDATE(),
        GETDATE(),
        NULL,
        NULL,
        0,
        0
    );
