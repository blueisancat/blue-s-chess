/** Glicko-2 (Glickman 2013). Ratings on the familiar 1500 scale. */
export interface G2 { rating: number; rd: number; vol: number }
const Q = 173.7178, TAU = 0.5, EPS = 1e-6;
const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** score: 1 win, 0.5 draw, 0 loss (from `p`'s view). One game = one rating period. */
export function update(p: G2, opp: G2, score: number): G2 {
  const mu = (p.rating - 1500) / Q, phi = p.rd / Q;
  const muJ = (opp.rating - 1500) / Q, phiJ = opp.rd / Q;
  const e = E(mu, muJ, phiJ);
  const v = 1 / (g(phiJ) ** 2 * e * (1 - e));
  const delta = v * g(phiJ) * (score - e);
  const a = Math.log(p.vol ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta ** 2 - phi ** 2 - v - ex)) / (2 * (phi ** 2 + v + ex) ** 2) - (x - a) / TAU ** 2;
  };
  let A = a, B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else { let k = 1; while (f(a - k * TAU) < 0) k++; B = a - k * TAU; }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi ** 2 + vol ** 2);
  const phiN = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muN = mu + phiN ** 2 * g(phiJ) * (score - e);
  return { rating: Q * muN + 1500, rd: Math.min(Q * phiN, 350), vol };
}
