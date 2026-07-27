const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting puppeteer...");
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // 1. Log in
  console.log("Navigating to login...");
  await page.goto('http://localhost:3000/login');
  await page.type('input[type="email"]', 'exec1@sukisoftware.com');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    await page.type('input[type="password"]', 'suki@123');
    await page.click('button[type="submit"]');
  } catch (e) {
    console.log("No password input found, proceeding...");
  }
  
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  console.log("Logged in. Current URL:", page.url());
  
  // 2. Take screenshot of RFQ page
  const rfqUrl = 'http://localhost:3000/rfq/3aea2a83-0ed2-492a-90a5-ab37203551c4';
  console.log("Navigating to RFQ page:", rfqUrl);
  await page.goto(rfqUrl, { waitUntil: 'networkidle2' });
  await page.screenshot({ path: '/home/sandhiya-suresh/.gemini/antigravity/brain/a64d36f0-864e-45c2-a38c-d92bafc2452a/rfq_v1_screenshot.png', fullPage: true });
  console.log("Saved RFQ screenshot.");
  
  // 3. Make API request using page.evaluate to share cookies
  console.log("Making fetch request to /api/visits...");
  const apiResponse = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/visits');
      const text = await res.text();
      return { status: res.status, body: text };
    } catch (e) {
      return { error: e.toString() };
    }
  });
  
  console.log("API Response from /api/visits:", apiResponse);
  
  await browser.close();
})();
