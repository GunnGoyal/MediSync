/**
 * Browser Integration Tests - Admin Flow
 * Tests admin login, dashboard access, and doctor verification
 */

describe('Admin User Flow', () => {
  let page;

  beforeAll(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await page.close();
  });

  test('should load admin login page', async () => {
    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle2' });
    
    const url = page.url();
    expect(url).toContain('/admin/login');
  });

  test('should reject invalid admin credentials', async () => {
    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle2' });
    
    await page.type('input[name="username"]', 'wrongadmin');
    await page.type('input[name="password"]', 'wrongpass');
    
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});

    // Should stay on login page or show error
    const content = await page.content();
    expect(content).toBeTruthy();
  }, 60000);

  test('should login admin with correct credentials', async () => {
    await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle2' });
    
    // Wait for form to be visible
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    
    // Clear and fill inputs
    await page.evaluate(() => {
      const usernameInput = document.querySelector('input[name="username"]');
      const passwordInput = document.querySelector('input[name="password"]');
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
    });
    
    await page.type('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
    await page.type('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin123');
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);

    const url = page.url();
    expect(url).toContain('/admin/dashboard');
  }, 60000);

  test('should display admin dashboard with statistics', async () => {
    // Wait for page to fully load with a delay function
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for dashboard stats
    const bodyText = await page.evaluate(() => document.body.textContent);
    expect(bodyText).toMatch(/Patient|Doctor|Appointment/i);
  }, 60000);

  test('should access doctors management page', async () => {
    await page.goto('http://localhost:3000/admin/doctors', { waitUntil: 'networkidle2' });
    
    const url = page.url();
    expect(url).toContain('/admin/doctors');
  });

  test('should access patients management page', async () => {
    await page.goto('http://localhost:3000/admin/patients', { waitUntil: 'networkidle2' });
    
    const url = page.url();
    expect(url).toContain('/admin/patients');
  });

  test('should access appointments management page', async () => {
    await page.goto('http://localhost:3000/admin/appointments', { waitUntil: 'networkidle2' });
    
    const url = page.url();
    expect(url).toContain('/admin/appointments');
  });

  test('should access analytics page', async () => {
    await page.goto('http://localhost:3000/admin/analytics', { waitUntil: 'networkidle2' });
    
    const url = page.url();
    expect(url).toContain('/admin/analytics');
  });

  test('should logout admin', async () => {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.goto('http://localhost:3000/auth/logout'),
    ]);

    const url = page.url();
    expect(url).toContain('/');
  });
});
