// Usage: node tests/browser-trainer-upload.mjs [baseUrl]
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base = process.argv[2] || 'http://127.0.0.1:3210';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const created = [];
page.on('pageerror', e => errors.push(e.message));
async function fillTrainer(mode) {
  await page.goto(base + '/#/admin/trainers/new');
  await page.waitForSelector('#trainer-form');
  await page.fill('#firstName', 'Browser');
  await page.fill('#lastName', 'Guide');
  const nickname = `Upload${mode}${Date.now()}`;
  await page.fill('#nickname', nickname);
  await page.fill('#username', nickname.toLowerCase());
  await page.fill('#temporaryPassword', 'Welcome!2026');
  await page.fill('#confirmPassword', 'Welcome!2026');
  await page.check('[name="permission-view"]');
  await page.check('[name="permission-reset"]');
  return nickname;
}
async function save() {
  const response = page.waitForResponse(r => r.url().endsWith('/api/admin/trainers') && r.request().method() === 'POST');
  await page.click('#trainer-form button[type="submit"]');
  const r = await response;
  assert.equal(r.status(), 201, JSON.stringify(await r.json()));
  const trainer = (await r.json()).trainer;
  created.push(trainer);
  await page.waitForSelector('.trainer-add');
  return trainer;
}
try {
  await page.goto(base + '/#/login');
  await page.fill('#username', 'safety.admin');
  await page.fill('#password', 'ZeroIncident!2026');
  await page.click('#login-form button[type="submit"]');
  await page.waitForSelector('.sidebar');
  await fillTrainer('None');
  assert.match(await page.locator('#photo-drop').innerText(), /optional/i);
  const noPhoto = await save();
  assert.equal(noPhoto.imageUrl, '/images/trainer-default.svg');
  assert.equal(await page.locator(`img[src="${noPhoto.imageUrl}"]`).first().evaluate(el => el.complete && el.naturalWidth > 0), true);
  console.log('PASS: no-image creation with both permissions; default avatar renders');
  const png = await sharp({create: {width: 40, height: 40, channels: 3, background: '#244958'}}).png().toBuffer();
  await fillTrainer('Image');
  await page.setInputFiles('#trainer-image', {name: 'valid.png', mimeType: 'image/png', buffer: png});
  assert.equal(await page.locator('#clear-trainer-image').isVisible(), true);
  const withPhoto = await save();
  assert.match(withPhoto.imageUrl, /^\/media\/trainers\/.*\.webp$/);
  console.log('PASS: valid PNG upload with both permissions');
  await fillTrainer('Cleared');
  await page.setInputFiles('#trainer-image', {name: 'valid.png', mimeType: 'image/png', buffer: png});
  await page.click('#clear-trainer-image');
  assert.equal(await page.locator('#trainer-image').evaluate(el => el.files.length), 0);
  assert.equal((await save()).imageUrl, '/images/trainer-default.svg');
  console.log('PASS: clear selection then save without a picture');
  assert.deepEqual(errors, []);
  console.log('PASS: no page errors');
} finally {
  // Remove only trainers created by this test, using the authenticated browser session.
  await page.evaluate(async trainers => {
    const s = await (await fetch('/api/session')).json();
    for (const t of trainers) await fetch('/api/admin/trainers/' + t.id, {
      method: 'DELETE', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': s.csrfToken},
      body: JSON.stringify({confirmation: t.nickname}),
    });
  }, created).catch(() => {});
  await browser.close();
}
