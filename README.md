# Powerball Oracle - Analizador Estadístico

Aplicación web (HTML + CSS + JavaScript puro) que analiza el historial de sorteos de Powerball con un **motor estadístico propio**. No usa IA, APIs de pago, API keys ni librerías: todo el cálculo ocurre en el navegador.

## Cómo funciona el motor (`stats-engine.js`)

1. **Cinco modelos estadísticos** calculan la probabilidad de cada número:
   - Azar puro (distribución uniforme)
   - Frecuencia histórica (suavizado Dirichlet / bayesiano)
   - Momentum reciente (media móvil exponencial)
   - Números atrasados (análisis de gaps)
   - Reversión a la media (números fríos)
2. **Validación walk-forward:** cada sorteo pasado se "predice" usando solo los sorteos anteriores a él.
3. **Promedio Bayesiano de Modelos:** cada modelo pesa según qué tan bien predijo datos que nunca vio.
4. **Test χ² de uniformidad:** mide si algún número sale más de lo normal con significancia estadística.
5. **Monte Carlo:** se generan 40.000 combinaciones y se descartan las de estructura improbable (suma, paridad, rangos, consecutivos).
6. **Anti-popularidad:** se penalizan combinaciones que juega mucha gente (fechas ≤31, patrones, jugadas ya ganadoras). No cambia la probabilidad de ganar, pero si ganas reduce la chance de compartir el premio.
7. **Backtest honesto:** muestra los aciertos promedio del modelo vs. los esperados por azar.

La predicción es determinista: con los mismos datos y la misma ventana siempre da la misma jugada.

## Uso

1. Abre `index.html` en un navegador moderno (o publícalo en GitHub Pages).
2. Pulsa "Cargar resultados oficiales" (data.ny.gov, sorteos desde el 7/oct/2015, formato 5/69 + 1/26) o agrega sorteos a mano.
3. Elige la ventana de análisis y pulsa "Analizar y predecir".

## Archivos

- `index.html`: estructura de la interfaz.
- `style.css`: diseño (oscuro, moderno, adaptable a celular).
- `stats-engine.js`: motor estadístico.
- `app.js`: carga de datos, tabla y presentación de resultados.

---

**Disclaimer:** *⚠️ Solo para entretenimiento. La lotería es completamente aleatoria: cada sorteo es independiente y ningún análisis matemático puede predecir el resultado. Probabilidad del premio mayor: 1 en 292.201.338.*
