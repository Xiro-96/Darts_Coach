/**
 * Statistische Hilfsfunktionen. Ziel: Verbesserungen nur dann als "echt"
 * bezeichnen, wenn die Datenlage das hergibt – eine gute Einheit allein reicht nicht.
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Wilson-Konfidenzintervall (95 %) für eine Trefferquote. */
export function wilson(hits: number, n: number, z = 1.96): { low: number; high: number; p: number } | null {
  if (n <= 0) return null;
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin), p };
}

/** Standardnormalverteilung – Verteilungsfunktion. */
export function normalCdf(x: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Zwei-Stichproben-Test für Anteile. Liefert z-Wert und zweiseitigen p-Wert. */
export function twoProportionTest(h1: number, n1: number, h2: number, n2: number): { z: number; p: number } | null {
  if (n1 === 0 || n2 === 0) return null;
  const p1 = h1 / n1;
  const p2 = h2 / n2;
  const pool = (h1 + h2) / (n1 + n2);
  const se = Math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, p: 1 };
  const z = (p2 - p1) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularisierte unvollständige Betafunktion I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Zweiseitiger p-Wert der t-Verteilung. */
export function tTestP(t: number, df: number): number {
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Welch-t-Test für zwei Gruppen von Messwerten (z. B. Ergebnisse früher vs. jetzt). */
export function welchTest(a: number[], b: number[]): { t: number; df: number; p: number; diff: number } | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a)!;
  const mb = mean(b)!;
  const va = stdDev(a)! ** 2;
  const vb = stdDev(b)! ** 2;
  const se2 = va / a.length + vb / b.length;
  if (se2 === 0) return { t: 0, df: a.length + b.length - 2, p: ma === mb ? 1 : 0, diff: mb - ma };
  const t = (mb - ma) / Math.sqrt(se2);
  const df = se2 ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
  return { t, df, p: tTestP(t, df), diff: mb - ma };
}

/** Zweiseitiger exakter Binomialtest gegen p = 0,5 (z. B. links vs. rechts). */
export function binomialTestHalf(k: number, n: number): number {
  if (n === 0) return 1;
  const logC = (nn: number, kk: number) => logGamma(nn + 1) - logGamma(kk + 1) - logGamma(nn - kk + 1);
  const prob = (i: number) => Math.exp(logC(n, i) - n * Math.LN2);
  const observed = prob(k);
  let p = 0;
  for (let i = 0; i <= n; i++) {
    const pi = prob(i);
    if (pi <= observed * (1 + 1e-9)) p += pi;
  }
  return Math.min(1, p);
}

/** Einordnung der Datenbasis für die Anzeige. */
export function sampleLabel(n: number, solid = 100): 'zu wenig Daten' | 'vorläufig' | 'solide' {
  if (n < 20) return 'zu wenig Daten';
  if (n < solid) return 'vorläufig';
  return 'solide';
}
