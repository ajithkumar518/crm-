const { chromium } = require('playwright');

const variants = [
  { email: 'variant1@sukisoftware.com', name: 'Variant1' },
  { email: 'variant2@sukisoftware.com', name: 'Variant2' },
  { email: 'variant3@sukisoftware.com', name: 'Variant3' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const results = [];

  for (const v of variants) {
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.fill('#email', v.email);
      await page.click('button[type="submit"]');
      await page.waitForSelector('#login-password', { timeout: 10000 });
      await page.fill('#login-password', 'Password@123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000 });

      await page.goto('http://localhost:3000/sales-pipeline/pipeline-list', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `/tmp/verify_${v.name}_pipeline_list.png` });

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      if (rowCount > 0) {
        await rows.last().click();
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(5000);
        await page.screenshot({ path: `/tmp/verify_${v.name}_opportunity_detail_top.png` });
        await page.evaluate(() => {
          const container = document.querySelector('.flex-1.overflow-y-auto, .h-full.overflow-y-auto');
          if (container) container.scrollTop = 800;
        });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `/tmp/verify_${v.name}_opportunity_detail_scroll1.png` });
      }

      await page.goto('http://localhost:3000/reports/opportunities', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `/tmp/verify_${v.name}_reports_opportunities.png` });

      results.push(`${v.name}: verified`);
    } catch (e) {
      results.push(`${v.name}: error - ${e.message} (url: ${page.url()})`);
      await page.screenshot({ path: `/tmp/verify_${v.name}_error.png` }).catch(() => {});
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(results.join('\n'));
})();
