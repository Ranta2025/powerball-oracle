/*
 * Motor estadístico local de Powerball Oracle.
 * No usa IA, APIs ni librerías: todo el cálculo ocurre en el navegador.
 *
 * Método:
 *  1. Varios "expertos" estadísticos (azar puro, frecuencia, momentum, atraso, fríos)
 *     proponen cada uno una distribución de probabilidad sobre los números.
 *  2. Se evalúan con validación walk-forward (cada sorteo se "predice" solo con
 *     los sorteos anteriores) y se combinan por Promedio Bayesiano de Modelos (BMA):
 *     peso ∝ verosimilitud acumulada fuera de muestra.
 *  3. Test χ² de uniformidad para medir si hay evidencia real de sesgo.
 *  4. Monte Carlo: se generan miles de combinaciones desde la distribución final,
 *     se filtran por la distribución teórica de suma/paridad/rangos y se penalizan
 *     las combinaciones "populares" (fechas, patrones) para reducir el riesgo de
 *     compartir el premio mayor.
 *  5. Backtest honesto: aciertos promedio del modelo vs. lo esperado por azar.
 */
(function (global) {
    'use strict';

    const WHITE_MAX = 69;
    const PB_MAX = 26;
    const PICK = 5;
    const JACKPOT_ODDS = 292201338;

    // Suma de 5 números sin reemplazo de 1..69: media y desviación exactas
    const SUM_MEAN = PICK * (WHITE_MAX + 1) / 2;
    const SUM_SD = Math.sqrt(PICK * ((WHITE_MAX * WHITE_MAX - 1) / 12) * (WHITE_MAX - PICK) / (WHITE_MAX - 1));

    // --- Utilidades numéricas ---

    // PRNG determinista (mulberry32): mismos datos => misma predicción
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function hashDraws(draws) {
        let h = 2166136261;
        draws.forEach(d => {
            d.blancas.concat(d.powerball).forEach(n => {
                h ^= n; h = Math.imul(h, 16777619);
            });
        });
        return h >>> 0;
    }

    function lnGamma(z) {
        const g = 7;
        const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
            771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
        z -= 1;
        let x = c[0];
        for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
        const t = z + g + 0.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }

    // Gamma incompleta regularizada superior Q(a, x)
    function gammaQ(a, x) {
        if (x <= 0) return 1;
        if (x < a + 1) {
            let sum = 1 / a, del = sum, ap = a;
            for (let n = 0; n < 500; n++) {
                ap++; del *= x / ap; sum += del;
                if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
            }
            return 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
        }
        let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
        for (let i = 1; i < 500; i++) {
            const an = -i * (i - a);
            b += 2;
            d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
            c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
            d = 1 / d;
            const del = d * c; h *= del;
            if (Math.abs(del - 1) < 1e-14) break;
        }
        return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
    }

    function chiSquareTest(counts, total, max) {
        const expected = total / max;
        let chi2 = 0;
        for (let n = 1; n <= max; n++) chi2 += Math.pow(counts[n] - expected, 2) / expected;
        const df = max - 1;
        return { chi2, df, pValue: gammaQ(df / 2, chi2 / 2) };
    }

    function normalize(arr, max) {
        let s = 0;
        for (let n = 1; n <= max; n++) s += arr[n];
        const out = new Array(max + 1).fill(0);
        for (let n = 1; n <= max; n++) out[n] = arr[n] / s;
        return out;
    }

    // --- Expertos: cada uno devuelve una distribución p[1..max] a partir del historial ---
    // history: arreglo cronológico (más viejo primero) de listas de números

    function countsOf(history, max) {
        const c = new Array(max + 1).fill(0);
        history.forEach(nums => nums.forEach(n => c[n]++));
        return c;
    }

    const EXPERTS = [
        {
            id: 'uniforme',
            nombre: 'Azar puro (uniforme)',
            dist: (h, max) => normalize(new Array(max + 1).fill(1), max)
        },
        {
            id: 'frecuencia',
            nombre: 'Frecuencia histórica (Dirichlet)',
            dist: (h, max) => {
                const c = countsOf(h, max);
                const alpha = 3;
                for (let n = 1; n <= max; n++) c[n] += alpha;
                return normalize(c, max);
            }
        },
        {
            id: 'momentum',
            nombre: 'Momentum reciente (EWMA)',
            dist: (h, max) => {
                const halfLife = 20;
                const lambda = Math.pow(0.5, 1 / halfLife);
                const w = new Array(max + 1).fill(0);
                let weight = 1, total = 0;
                for (let i = h.length - 1; i >= 0; i--) {
                    h[i].forEach(n => { w[n] += weight; });
                    total += weight * h[i].length;
                    weight *= lambda;
                }
                const prior = Math.max(total / max, 1e-9);
                for (let n = 1; n <= max; n++) w[n] += prior;
                return normalize(w, max);
            }
        },
        {
            id: 'atrasados',
            nombre: 'Números atrasados (gaps)',
            dist: (h, max) => {
                const perDraw = h.length ? h[0].length : 1;
                const expectedGap = max / perDraw;
                const w = new Array(max + 1).fill(0);
                for (let n = 1; n <= max; n++) {
                    let gap = h.length;
                    for (let i = h.length - 1; i >= 0; i--) {
                        if (h[i].includes(n)) { gap = h.length - 1 - i; break; }
                    }
                    w[n] = 1 + 0.5 * Math.min(gap / expectedGap, 4);
                }
                return normalize(w, max);
            }
        },
        {
            id: 'frios',
            nombre: 'Reversión a la media (fríos)',
            dist: (h, max) => {
                const c = countsOf(h, max);
                const top = Math.max(...c.slice(1));
                const w = new Array(max + 1).fill(0);
                for (let n = 1; n <= max; n++) w[n] = top - c[n] + 3;
                return normalize(w, max);
            }
        }
    ];

    /*
     * Walk-forward + Promedio Bayesiano de Modelos.
     * series: arreglo cronológico de listas de números (ej. [[3,15,..],[..]] o [[pb],[pb]])
     */
    function bayesianEnsemble(series, max, windowSize, testSteps) {
        const K = EXPERTS.length;
        const logL = new Array(K).fill(0);
        const start = Math.max(10, series.length - testSteps);
        let hitsModel = 0, hitsSteps = 0;
        const perDraw = series[0].length;

        for (let t = start; t < series.length; t++) {
            const hist = series.slice(Math.max(0, t - windowSize), t);
            const dists = EXPERTS.map(e => e.dist(hist, max));

            // Predicción fuera de muestra con los pesos aprendidos hasta t
            const weights = softmax(logL);
            const mix = mixDists(dists, weights, max);
            const top = topN(mix, perDraw, max);
            hitsModel += series[t].filter(n => top.includes(n)).length;
            hitsSteps++;

            // Actualizar verosimilitud de cada experto con el sorteo real
            for (let k = 0; k < K; k++) {
                series[t].forEach(n => { logL[k] += Math.log(dists[k][n]); });
            }
        }

        const weights = softmax(logL);
        const hist = series.slice(Math.max(0, series.length - windowSize));
        const dists = EXPERTS.map(e => e.dist(hist, max));
        const finalDist = mixDists(dists, weights, max);

        return {
            weights: EXPERTS.map((e, k) => ({ id: e.id, nombre: e.nombre, peso: weights[k] })),
            finalDist,
            backtest: {
                pasos: hitsSteps,
                aciertosModelo: hitsSteps ? hitsModel / hitsSteps : 0,
                aciertosAzar: perDraw * perDraw / max
            }
        };
    }

    function softmax(logs) {
        const m = Math.max(...logs);
        const ex = logs.map(l => Math.exp(l - m));
        const s = ex.reduce((a, b) => a + b, 0);
        return ex.map(e => e / s);
    }

    function mixDists(dists, weights, max) {
        const out = new Array(max + 1).fill(0);
        for (let k = 0; k < dists.length; k++) {
            for (let n = 1; n <= max; n++) out[n] += weights[k] * dists[k][n];
        }
        return out;
    }

    function topN(dist, count, max) {
        const idx = [];
        for (let n = 1; n <= max; n++) idx.push(n);
        idx.sort((a, b) => dist[b] - dist[a] || a - b);
        return idx.slice(0, count);
    }

    // --- Filtros estructurales y de popularidad ---

    function structureOk(combo) {
        const sum = combo.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - SUM_MEAN) > 1.3 * SUM_SD) return false;      // ~80% central
        const odd = combo.filter(n => n % 2).length;
        if (odd === 0 || odd === 5) return false;
        const low = combo.filter(n => n <= 35).length;
        if (low === 0 || low === 5) return false;
        const decades = new Set(combo.map(n => Math.floor(n / 10)));
        if (decades.size < 3) return false;
        let run = 1;
        for (let i = 1; i < 5; i++) {
            run = combo[i] === combo[i - 1] + 1 ? run + 1 : 1;
            if (run >= 3) return false;
        }
        return true;
    }

    // Penaliza lo que mucha gente juega (cumpleaños, patrones), no cambia la
    // probabilidad de ganar pero sí reduce la chance de compartir el premio.
    function popularityPenalty(combo, pastKeys) {
        let p = 0;
        const birthday = combo.filter(n => n <= 31).length;
        if (birthday >= 4) p += (birthday - 3) * 1.5;
        const diffs = [];
        for (let i = 1; i < 5; i++) diffs.push(combo[i] - combo[i - 1]);
        if (diffs.every(d => d === diffs[0])) p += 5;
        const lastDigits = new Set(combo.map(n => n % 10));
        if (lastDigits.size <= 2) p += 2;
        if (combo.filter(n => n % 5 === 0).length >= 4) p += 2;
        if (pastKeys.has(combo.join('-'))) p += 10;
        return p;
    }

    function generateTickets(whiteDist, pbDist, draws, rng, count) {
        const SIMS = 40000;
        const pastKeys = new Set(draws.map(d => [...d.blancas].sort((a, b) => a - b).join('-')));
        const logP = whiteDist.map(p => p > 0 ? Math.log(p) : -50);
        const cdf = [];
        let acc = 0;
        for (let n = 1; n <= WHITE_MAX; n++) { acc += whiteDist[n]; cdf.push(acc); }

        const seen = new Map();
        for (let s = 0; s < SIMS; s++) {
            const set = new Set();
            while (set.size < PICK) {
                const r = rng() * acc;
                let lo = 0, hi = cdf.length - 1;
                while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
                set.add(lo + 1);
            }
            const combo = [...set].sort((a, b) => a - b);
            const key = combo.join('-');
            if (seen.has(key) || !structureOk(combo)) continue;
            const model = combo.reduce((a, n) => a + logP[n], 0);
            const score = model - 0.35 * popularityPenalty(combo, pastKeys);
            seen.set(key, { combo, score });
        }

        const ranked = [...seen.values()].sort((a, b) => b.score - a.score);
        const pbRank = topN(pbDist, PB_MAX, PB_MAX);
        const tickets = [];
        const used = new Array(WHITE_MAX + 1).fill(0);
        for (const cand of ranked) {
            // Diversidad: máximo 2 números en común con otra jugada y cada número en máximo 2 jugadas
            const overlapOk = tickets.every(t => t.blancas.filter(n => cand.combo.includes(n)).length <= 2);
            if (overlapOk && cand.combo.every(n => used[n] < 2)) {
                cand.combo.forEach(n => used[n]++);
                tickets.push({ blancas: cand.combo, powerball: pbRank[tickets.length % 3] });
            }
            if (tickets.length >= count) break;
        }
        return tickets;
    }

    // --- Estadísticas descriptivas ---

    function describe(draws, whiteCounts) {
        const N = draws.length;
        let sum = 0, evens = 0;
        const ranges = [0, 0, 0];
        draws.forEach(d => d.blancas.forEach(n => {
            sum += n;
            if (n % 2 === 0) evens++;
            ranges[n <= 23 ? 0 : n <= 46 ? 1 : 2]++;
        }));
        const balls = N * PICK;

        // Gap actual de cada número (sorteos desde su última aparición)
        const gaps = new Array(WHITE_MAX + 1).fill(N);
        for (let n = 1; n <= WHITE_MAX; n++) {
            const idx = draws.findIndex(d => d.blancas.includes(n)); // draws: más reciente primero
            if (idx >= 0) gaps[n] = idx;
        }

        // Pares que más salen juntos
        const pairs = new Map();
        draws.forEach(d => {
            const s = [...d.blancas].sort((a, b) => a - b);
            for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
                const k = s[i] + '-' + s[j];
                pairs.set(k, (pairs.get(k) || 0) + 1);
            }
        });
        const topPairs = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        const expectedPair = N * 10 / (WHITE_MAX * (WHITE_MAX - 1) / 2);

        const recent = draws.slice(0, 10);
        const recentSum = recent.reduce((a, d) => a + d.blancas.reduce((x, y) => x + y, 0), 0) / recent.length;

        return {
            sumaPromedio: Math.round(sum / N),
            paresPct: Math.round(evens / balls * 100),
            rangos: ranges.map(r => Math.round(r / balls * 100)),
            gaps,
            topPairs,
            expectedPair,
            sumaReciente: Math.round(recentSum),
            zScores: whiteCounts.map(c => (c - balls / WHITE_MAX) / Math.sqrt(balls / WHITE_MAX * (1 - PICK / WHITE_MAX)))
        };
    }

    // --- API pública ---

    /*
     * draws: arreglo con el sorteo más reciente primero: { blancas: [5], powerball: n }
     * windowSize: cuántos sorteos usa cada modelo como historial
     */
    function analyze(draws, windowSize) {
        const chrono = [...draws].reverse();
        const whiteSeries = chrono.map(d => d.blancas);
        const pbSeries = chrono.map(d => [d.powerball]);
        const testSteps = Math.min(200, Math.max(0, draws.length - 10));

        const white = bayesianEnsemble(whiteSeries, WHITE_MAX, windowSize, testSteps);
        const pb = bayesianEnsemble(pbSeries, PB_MAX, windowSize, testSteps);

        const window = draws.slice(0, windowSize);
        const whiteCounts = countsOf(window.map(d => d.blancas), WHITE_MAX);
        const pbCounts = countsOf(window.map(d => [d.powerball]), PB_MAX);
        const chiWhite = chiSquareTest(whiteCounts, window.length * PICK, WHITE_MAX);
        const chiPb = chiSquareTest(pbCounts, window.length, PB_MAX);

        const rng = mulberry32(hashDraws(draws) ^ windowSize);
        const tickets = generateTickets(white.finalDist, pb.finalDist, draws, rng, 5);

        return {
            totalSorteos: draws.length,
            ventana: window.length,
            tickets,
            white, pb,
            whiteCounts, pbCounts,
            chiWhite, chiPb,
            desc: describe(window, whiteCounts),
            constantes: { SUM_MEAN, SUM_SD, JACKPOT_ODDS, WHITE_MAX, PB_MAX }
        };
    }

    global.OracleEngine = { analyze, EXPERTS, _internals: { gammaQ, chiSquareTest, structureOk, mulberry32 } };
})(typeof window !== 'undefined' ? window : globalThis);
