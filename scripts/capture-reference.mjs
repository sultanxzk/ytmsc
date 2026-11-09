import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.join(__dirname, '..', 'reference');
const LOCAL_URL = process.env.LOCAL_URL || 'http://127.0.0.1:5175';
const OFFICIAL_URL = process.env.OFFICIAL_URL || 'https://music.youtube.com';
const VIEWPORT = { width: 1920, height: 1080 };

fs.mkdirSync(REF_DIR, { recursive: true });

async function capture(browser, { url, name, scrollY = 0, nav = 'link' }) {
  const page = await browser.newPage({ viewport: VIEWPORT, locale: 'pt-BR', colorScheme: 'dark', timezoneId: 'America/Sao_Paulo' });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(6000);
  if (scrollY) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(1200);

  const screenshot = path.join(REF_DIR, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  // estilos computados dos componentes-chave
  const styles = await page.evaluate(() => {
    const get = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
        color: cs.color, background: cs.backgroundColor, borderRadius: cs.borderRadius,
        margin: cs.margin, padding: cs.padding,
      };
    };
    return {
      body: get('body'),
      nav: get('ytmusic-navigation, ytd-masthead, header, nav'),
      search: get('input, #search, [role="combobox"]'),
      h2: get('h2'),
      card: get('ytmusic-two-row-item-renderer, [data-testid="card"], img'),
      playerBar: get('ytmusic-player-bar, #player-bar, footer'),
    };
  });

  const state = {
    url,
    viewport: VIEWPORT,
    scrollY,
    auth: 'logged-out',
    locale: 'pt-BR',
    colorScheme: 'dark',
    capturedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(REF_DIR, `${name}.json`), JSON.stringify({ state, styles }, null, 2));
  fs.writeFileSync(path.join(REF_DIR, `${name}-state.txt`), `${state.url}\n${VIEWPORT.width}x${VIEWPORT.height}\nscroll=${scrollY}\nauth=${state.auth}\n`);

  await page.close();
  return screenshot;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log('Capturando referência oficial...');
  await capture(browser, { url: OFFICIAL_URL, name: 'official-home' });
  await capture(browser, { url: OFFICIAL_URL, name: 'official-home-scrolled', scrollY: 900 });
  console.log('Reference pronta em', REF_DIR);
  await browser.close();

  console.log('Capturando app local...');
  const b2 = await chromium.launch({ headless: true });
  await capture(b2, { url: LOCAL_URL, name: 'local-home' });
  await capture(b2, { url: LOCAL_URL, name: 'local-home-scrolled', scrollY: 900 });
  console.log('Local pronto em', REF_DIR);
  await b2.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
