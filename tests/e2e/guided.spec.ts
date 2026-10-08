import { expect, test } from '@playwright/test';
import { enterTotal, key, onboard, useButtons } from './helpers.ts';

test('Geführte Einheiten: Eingangstest, danach Plan-Training mit Pause und Phasen', async ({ page }) => {
  await onboard(page, { startTest: true });
  await expect(page.getByRole('heading', { name: 'Test 1 · Gruppierung' })).toBeVisible();

  // Test 1: Gruppierung – ohne Positionen fragt die App nach einer Selbsteinschätzung
  await page.getByTestId('start-phase').click();
  await useButtons(page);
  for (let r = 0; r < 5; r++) {
    for (let i = 0; i < 3; i++) await key(page, 'bull');
    await page.getByTestId('rating').getByRole('button', { name: /^Eng/ }).click();
  }
  await expect(page.getByTestId('phase-done')).toBeVisible();
  await page.getByTestId('next-phase').click();

  // Test 2–4: Zielübungen
  for (const darts of [27, 18, 18]) {
    await page.getByTestId('start-phase').click();
    await useButtons(page);
    for (let i = 0; i < darts; i++) await key(page, i % 3 === 0 ? 20 : 'miss');
    await expect(page.getByTestId('phase-done')).toBeVisible();
    await page.getByTestId('next-phase').click();
  }

  // Test 5: Scoring mit Aufnahme-Summen
  await page.getByTestId('start-phase').click();
  await page.getByRole('tab', { name: 'Summe' }).click();
  for (let v = 0; v < 7; v++) await enterTotal(page, 45);
  await expect(page.getByTestId('phase-result')).toHaveText('315');
  await page.getByTestId('next-phase').click();
  await expect(page.getByTestId('summary-title')).toBeVisible();
  await expect(page.getByText('Leistungstest', { exact: false }).first()).toBeVisible();

  // Danach schlägt der Plan ein normales Anfängertraining vor
  await page.getByRole('button', { name: 'Zum Dashboard' }).click();
  const today = page.getByTestId('today-card');
  await expect(today).toContainText('Warm-up');
  await expect(today).toContainText('Technik');
  await expect(page.getByTestId('coach-reason')).not.toBeEmpty();

  await page.getByTestId('start-plan').click();
  await expect(page.getByRole('heading', { name: 'Warm-up' })).toBeVisible();
  await page.getByRole('button', { name: 'Phase überspringen' }).click();
  await page.getByTestId('next-phase').click();

  // Technik-Phase: genau ein Schwerpunkt, Bewertung nach jeder Runde
  await expect(page.getByRole('heading', { name: /^Technik · / })).toBeVisible();
  await page.getByTestId('start-phase').click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Dein Training ist gesichert')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await useButtons(page);
  for (let i = 0; i < 3; i++) await key(page, 20);
  await page.getByTestId('rating').getByRole('button', { name: /Ja, sauber/ }).click();
  await page.getByRole('button', { name: 'Phase beenden' }).click();
  await expect(page.getByTestId('phase-done')).toContainText('Vorzeitig beendet');

  // Restliche Phasen überspringen und abschließen
  while (await page.getByTestId('next-phase').isVisible()) {
    const last = (await page.getByTestId('next-phase').textContent())?.includes('abschließen');
    await page.getByTestId('next-phase').click();
    if (last) break;
    await page.getByRole('button', { name: 'Phase überspringen' }).click();
  }
  await expect(page.getByTestId('summary-title')).toBeVisible();
  await expect(page.getByText('Training gespeichert')).toBeVisible(); // nicht vollständig → ehrlich gekennzeichnet

  await page.goto('/#/profile/history');
  await expect(page.getByText('2 Einheiten')).toBeVisible();
});
