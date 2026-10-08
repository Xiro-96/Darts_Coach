import { expect, type Page } from '@playwright/test';

/** Onboarding mit wenigen Antworten durchlaufen. */
export async function onboard(page: Page, opts: { name?: string; inputMode?: 'board' | 'buttons'; startTest?: boolean } = {}) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible();
  if (opts.name) await page.getByPlaceholder('Dein Name (optional)').fill(opts.name);
  for (let i = 0; i < 4; i++) await page.getByTestId('onboarding-next').click();
  if (opts.inputMode === 'buttons') await page.getByRole('button', { name: /Über große Tasten/ }).click();
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('plan-preview')).toBeVisible();
  if (opts.startTest) {
    await page.getByTestId('onboarding-start-test').click();
    await expect(page.getByTestId('start-phase')).toBeVisible();
  } else {
    await page.getByTestId('onboarding-finish').click();
    await expect(page.getByTestId('today-card')).toBeVisible();
  }
}

/** Übung aus der Bibliothek mit gewählter Variante starten und erste Phase beginnen. */
export async function startDrill(page: Page, drillId: string, variantLabel?: string) {
  await page.goto(`/#/train/drill/${drillId}`);
  if (variantLabel) await page.getByRole('radio', { name: new RegExp(variantLabel) }).click();
  await page.getByTestId('start-drill').click();
  await page.getByTestId('start-phase').click();
}

export async function useButtons(page: Page) {
  await page.getByRole('tab', { name: 'Tasten' }).click();
}

/** Dart über das vollständige Tastenfeld eingeben: m = 1/2/3, n = Zahl, 25, 'bull' oder 'miss'. */
export async function key(page: Page, n: number | 'bull' | 'miss', m: 1 | 2 | 3 = 1) {
  const pad = page.getByTestId('key-1');
  if (!(await pad.isVisible())) await page.getByTestId('toggle-keypad').click();
  if (n === 'miss') return page.getByTestId('key-miss').click();
  if (n === 'bull') return page.getByTestId('key-bull').click();
  if (m !== 1) await page.getByTestId(`mult-${m}`).click();
  await page.getByTestId(`key-${n}`).click();
}

export async function enterTotal(page: Page, score: number) {
  for (const d of String(score)) await page.getByTestId(`num-${d}`).click();
  await page.getByTestId('num-ok').click();
}

export async function finishSingleDrill(page: Page) {
  await page.getByTestId('next-phase').click();
  await expect(page.getByTestId('summary-title')).toBeVisible();
}
