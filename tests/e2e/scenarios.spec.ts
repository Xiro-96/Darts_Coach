import { expect, test } from '@playwright/test';
import { enterTotal, finishSingleDrill, key, onboard, startDrill, useButtons } from './helpers.ts';

test.describe('Abnahmeszenarien', () => {
  test('1 · Erster Start: wenige Fragen → passendes Anfängertraining', async ({ page }) => {
    await onboard(page, { name: 'Henny' });
    await expect(page.getByRole('heading', { name: 'Henny' })).toBeVisible();
    const today = page.getByTestId('today-card');
    await expect(today).toContainText('Woche 1 · Grundlagen');
    await expect(today).toContainText('Eingangstest');
    // Startet mit dem Eingangstest (Gruppierung zuerst), nicht mit Checkouts oder Triples
    await page.getByTestId('start-plan').click();
    await expect(page.getByRole('heading', { name: 'Test 1 · Gruppierung' })).toBeVisible();
    await expect(page.getByText('Phase 1 von 5')).toBeVisible();

    // Plan-Ansicht zeigt das 4-Stufen-Programm
    await page.getByRole('button', { name: 'Training beenden' }).click();
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await page.goto('/#/train?tab=plan');
    await expect(page.getByTestId('plan-stages').locator('li')).toHaveCount(4);
  });

  test('2 · Around the Clock: Eingabe, Fortschritt, Undo und Korrektur', async ({ page }) => {
    await onboard(page);
    await startDrill(page, 'atc', '^Ganze Zahl');
    const headline = page.getByTestId('target-headline');
    await expect(headline).toHaveText('1');
    await useButtons(page);
    await key(page, 1); // Treffer
    await expect(headline).toHaveText('2');
    await key(page, 'miss'); // Fehlwurf
    await expect(headline).toHaveText('2');
    await key(page, 7); // falsche Zahl
    await expect(headline).toHaveText('2');
    await expect(page.getByTestId('stat-Darts')).toHaveText('3');
    await expect(page.getByTestId('stat-Trefferquote')).toHaveText('33 %');

    // Korrektur: letzte Eingabe war falsch (eigentlich die 2 getroffen)
    await page.getByRole('button', { name: 'Letzte Eingabe rückgängig' }).click();
    await expect(page.getByTestId('stat-Darts')).toHaveText('2');
    await key(page, 2);
    await expect(headline).toHaveText('3');
    await expect(page.getByTestId('stat-Trefferquote')).toHaveText('67 %');

    // Eingabe über die Scheibe: Mitte des Single-Felds der 3 (unten)
    await page.getByRole('tab', { name: 'Scheibe' }).click();
    const board = page.getByTestId('dartboard');
    const box = (await board.boundingBox())!;
    const mm = box.width / 456;
    await board.click({ position: { x: box.width / 2, y: box.height / 2 + 60 * mm } });
    await expect(headline).toHaveText('4');
    await expect(page.getByTestId('stat-Darts')).toHaveText('4');
  });

  test('3 · Training absolvieren → korrekte Auswertung', async ({ page }) => {
    await onboard(page);
    await startDrill(page, 'd20', 'Einsteiger');
    await useButtons(page);
    // 15 Darts: 5 Treffer D20, 5× S20, 5× Miss
    for (let i = 0; i < 5; i++) await key(page, 20, 2);
    for (let i = 0; i < 5; i++) await key(page, 20, 1);
    for (let i = 0; i < 5; i++) await key(page, 'miss');
    await expect(page.getByTestId('phase-result')).toHaveText('33 %');
    await finishSingleDrill(page);
    await expect(page.getByText('Training abgeschlossen')).toBeVisible();
    const tiles = page.locator('.num');
    await expect(page.getByText('Geworfene Darts').first()).toBeVisible();
    await expect(tiles.filter({ hasText: /^15$/ }).first()).toBeVisible();
    await expect(page.getByText('5 von 15', { exact: true })).toBeVisible();
    await expect(page.getByText('Zieltreffer: 5 von 15 (33 %)')).toBeVisible();
  });

  test('4 · Daten bleiben erhalten – auch eine unterbrochene Einheit', async ({ page, context }) => {
    await onboard(page);
    await startDrill(page, 'd20', 'Einsteiger');
    await useButtons(page);
    for (let i = 0; i < 15; i++) await key(page, 20, 2);
    await finishSingleDrill(page);

    // Neue Einheit beginnen und "versehentlich" schließen
    await startDrill(page, 'atc', '^Ganze Zahl');
    await useButtons(page);
    await key(page, 1);
    await key(page, 2);

    const page2 = await context.newPage();
    await page.close();
    await page2.goto('/');
    await expect(page2.getByText('Training fortsetzen')).toBeVisible();
    await page2.goto('/#/profile/history');
    await expect(page2.getByText('1 Einheiten')).toBeVisible();
    await page2.goto('/#/session');
    await expect(page2.getByTestId('target-headline')).toHaveText('3');
    await expect(page2.getByTestId('stat-Darts')).toHaveText('2');
  });

  test('5 + 6 · Diagramme zeigen die Entwicklung, Coach empfiehlt die Folgeübung', async ({ page }) => {
    await onboard(page);
    const play = async (hits: number) => {
      await startDrill(page, 'big-singles', 'Einsteiger');
      await useButtons(page);
      for (let i = 0; i < 24; i++) {
        const target = i < 12 ? 20 : 19;
        if (i % 12 < hits / 2) await key(page, target);
        else await key(page, 'miss');
      }
      await finishSingleDrill(page);
    };
    await play(10); // 42 %
    await expect(page.getByTestId('coach-next')).toContainText('Erster Durchgang');
    await play(14); // 58 %
    await play(16); // 67 %
    // Coach: Schnitt über mehrere Durchgänge über der Schwelle → nächste Stufe, mit Begründung
    await expect(page.getByTestId('coach-next')).toContainText('Schwelle');
    await expect(page.getByText('Nächste Übung: Big Singles · Ganze Zahl')).toBeVisible();

    // Verlauf der Übung als Diagramm
    await page.goto('/#/train/drill/big-singles');
    await page.getByRole('radio', { name: /Einsteiger/ }).click();
    await expect(page.locator('.recharts-line-curve')).toBeVisible();
    await expect(page.getByText('3 Durchgänge')).toBeVisible();

    // Statistik: echte Werte
    await page.goto('/#/stats');
    await expect(page.getByTestId('kpis')).toContainText('72');
    await expect(page.getByTestId('kpis')).toContainText('56 %'); // 40 von 72
  });

  test('7 · 501: Punkte, Bust, Double-Out, Undo und Abschluss', async ({ page }) => {
    await onboard(page);
    await page.goto('/#/train/drill/x01');
    await page.getByRole('radio', { name: /501 Double-Out/ }).click();
    await page.getByTestId('start-drill').click();
    await page.getByTestId('start-phase').click();
    const rest = page.getByTestId('target-headline');
    await expect(rest).toHaveText('501');

    await page.getByRole('tab', { name: 'Summe' }).click();
    await enterTotal(page, 180);
    await expect(rest).toHaveText('321');
    await enterTotal(page, 180);
    await enterTotal(page, 100);
    await expect(rest).toHaveText('41');
    // Unmögliche Punktzahl wird abgelehnt
    await enterTotal(page, 179);
    await expect(page.getByText('179 ist mit drei Darts nicht möglich')).toBeVisible();
    await expect(rest).toHaveText('41');
    // Überworfen → Bust, Stand bleibt
    await enterTotal(page, 45);
    // Bei Rest ≤ 50 fragt die App nach Darts aufs Doppel (für die Doppelquote)
    await page.getByRole('dialog').getByRole('button', { name: '0', exact: true }).click();
    await page.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(page.getByText('Du: Bust!')).toBeVisible();
    await expect(rest).toHaveText('41');

    // Dart für Dart: Rest 1 → Bust
    await useButtons(page);
    await key(page, 20);
    await expect(rest).toHaveText('21');
    await key(page, 20);
    await expect(page.getByText('Du: Bust!')).toBeVisible();
    await expect(rest).toHaveText('41');
    // Undo stellt den Stand vor dem Bust-Dart wieder her
    await page.getByRole('button', { name: 'Letzte Eingabe rückgängig' }).click();
    await expect(rest).toHaveText('21');
    // Finish ohne Doppel ist ein Bust
    await key(page, 1);
    await expect(rest).toHaveText('20');
    await key(page, 20);
    await expect(page.getByText('Du: Bust!')).toBeVisible();
    await expect(rest).toHaveText('41');
    // Checkout mit Doppel
    await key(page, 1);
    await key(page, 20, 2);
    // Leg beendet → Auswertung der Phase
    await expect(page.getByTestId('phase-done')).toContainText('3-Dart-Average');
    await expect(page.getByTestId('phase-done')).toContainText('Checkouts: 1');
    await finishSingleDrill(page);
    await expect(page.getByText('Höchstes Finish: 41')).toBeVisible(); // S1 + D20 aus 41 Rest
  });
});
