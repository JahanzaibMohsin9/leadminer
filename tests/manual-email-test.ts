import { chromium } from 'playwright';
import { EmailExtractor } from '../src/main/scraping/email-extractor';
import * as http from 'http';

const htmlContent = `
<html>
<body>
  <h1>Welcome to Business</h1>
  <p>Some text here.</p>
  <a href="/contact">Contact Page</a>
</body>
</html>
`;

const contactContent = `
<html>
<body>
  <h1>Contact Us</h1>
  <p>Reach us at support@test-business.com for help.</p>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  } else if (req.url === '/contact') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contactContent);
  } else {
    res.writeHead(404);
    res.end();
  }
});

(async () => {
  const PORT = 3456;
  
  await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
  });
  
  console.log(`Test server running at http://localhost:${PORT}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const extractor = new EmailExtractor(page);

  try {
    console.log('Testing extraction (should follow contact link)...');
    const email = await extractor.extract(`http://localhost:${PORT}`);
    console.log('Extracted email:', email);

    if (email === 'support@test-business.com') {
        console.log('SUCCESS: Email extracted correctly from contact page');
    } else {
        console.error('FAILURE: Unexpected email extracted');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
    server.close();
  }
})();
