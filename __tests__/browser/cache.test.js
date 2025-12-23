/**
 * Browser Integration Tests - Cache Verification
 * Tests Redis caching functionality via browser interactions
 */

describe('Cache Integration Tests', () => {
  let page;

  beforeAll(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  afterAll(async () => {
    await page.close();
  });

  test('should access cache demo endpoint', async () => {
    await page.goto('http://localhost:3000/cache/demo', { waitUntil: 'networkidle2', timeout: 15000 });
    
    const content = await page.content();
    expect(content).toContain('cache:foo');
    expect(content).toContain('bar');
  }, 60000);

  test('should verify cache data structure', async () => {
    const response = await page.goto('http://localhost:3000/cache/demo', { waitUntil: 'networkidle2' });
    const json = await response.json();
    
    expect(json).toHaveProperty('key');
    expect(json).toHaveProperty('value');
    expect(json).toHaveProperty('ttlSeconds');
    expect(json.key).toBe('cache:foo');
    expect(json.value).toBe('bar');
    expect(json.ttlSeconds).toBe(600);
  });

  test('should get cached value', async () => {
    const response = await page.goto('http://localhost:3000/cache/get/foo', { waitUntil: 'networkidle2' });
    const json = await response.json();
    
    expect(json).toHaveProperty('key');
    expect(json).toHaveProperty('value');
    expect(json.value).toBe('bar');
  });
});
