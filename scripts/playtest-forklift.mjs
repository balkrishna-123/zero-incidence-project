// Headless playtest: deliver pallet 1, then try pallets 2 and 3.
// Usage: node scripts/playtest-forklift.mjs [baseUrl]
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://127.0.0.1:8899';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(base + '/games/forklift.html');
await page.waitForFunction(() => window.shiftGame, null, { timeout: 30000 });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => {
  const g = window.shiftGame;
  return {
    status: g.status, active: g.active, carrying: g.carrying,
    delivered: g.world.pallets.map((p) => p.delivered),
    palletPos: g.world.pallets.map((p) => [Math.round(p.group.position.x * 10) / 10, Math.round(p.group.position.z * 10) / 10]),
    palletParent: g.world.pallets.map((p) => p.group.parent?.name || p.group.parent?.type || '?'),
    lift: Math.round(g.liftHeight * 100) / 100, seq: !!g.deliverySequence,
    manifest: document.getElementById('delivered-count').textContent,
    activeRow: [...document.querySelectorAll('[data-delivery]')].findIndex((el) => el.classList.contains('active')),
  };
});

// Teleport the vehicle so the load centre sits exactly on a target point.
const teleportTo = (x, z) => page.evaluate(([tx, tz]) => {
  const g = window.shiftGame;
  g.vehicle.position.set(tx, 0, tz + 1.92); // yaw 0 => load centre is 1.92 in -Z
  g.yaw = 0; g.vehicle.rotation.y = 0; g.speed = 0;
}, [x, z]);

console.log('initial:', JSON.stringify(await state()));
await page.evaluate(() => window.shiftGame.start());

for (let i = 0; i < 3; i++) {
  const target = await page.evaluate((idx) => {
    const g = window.shiftGame;
    const t = g.carrying !== null ? g.world.bays[g.active] : g.world.pallets[g.active].group.position;
    return { x: t.x, z: t.z, carrying: g.carrying, active: g.active };
  }, i);
  await teleportTo(target.x, target.z);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => { const g = window.shiftGame; return g.interaction(); });
  await page.evaluate(() => window.shiftGame.act());
  await page.waitForTimeout(400);
  let s = await state();
  if (s.carrying !== null && s.carrying !== undefined) {
    // carrying -> deliver at bay
    const bay = await page.evaluate(() => { const b = window.shiftGame.world.bays[window.shiftGame.active]; return { x: b.x, z: b.z }; });
    await teleportTo(bay.x, bay.z);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.shiftGame.act());
    await page.waitForTimeout(2500); // delivery sequence + settle
  }
  s = await state();
  console.log(`after step ${i + 1} (target was pallet/bay ${target.active + 1}, interaction=${JSON.stringify(info)}):`, JSON.stringify(s));
}

// Manifest communication: statuses + locked-row explanation.
const manifest = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-delivery]')];
  return rows.map((r) => ({
    i: r.dataset.delivery,
    locked: r.classList.contains('locked'),
    delivered: r.classList.contains('delivered'),
    status: r.querySelector('.item-status')?.textContent || '',
  }));
});
console.log('manifest after full shift:', JSON.stringify(manifest));
await page.evaluate(() => window.shiftGame.reset());
await page.waitForTimeout(400);
await page.click('[data-delivery="2"]');
await page.waitForTimeout(200);
const lockedToast = await page.evaluate(() => document.getElementById('toast-message').textContent);
console.log('locked-row toast:', lockedToast);
const lockedState = await page.evaluate(() => [...document.querySelectorAll('[data-delivery]')].map((r) => r.querySelector('.item-status')?.textContent));
console.log('fresh manifest statuses:', JSON.stringify(lockedState));

console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
