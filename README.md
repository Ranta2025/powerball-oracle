# Powerball Oracle - Pattern Analyzer

Aplicación web frontend (SPA) que utiliza inteligencia artificial (modelos gratuitos de OpenRouter) para analizar historiales de sorteos de Powerball e intentar encontrar patrones matemáticos para predecir posibles resultados.

## Características

- **Diseño "Casino Noir":** Una estética oscura, minimalista, con toques dorados, rojos y estilo neumorfismo/glassmorphism.
- **Predicción con IA:** Se conecta a la API de OpenRouter y elige automáticamente un modelo gratuito disponible (lista consultada en vivo, con respaldo). El prompt incluye z-scores y un test chi-cuadrado de uniformidad para distinguir señal de ruido.
- **Animaciones 3D:** Renderizado CSS de bolas de lotería realistas y animaciones de caída/rebote al arrojar resultados.
- **Sin Dependencias Ocultas:** No usa NPM, bundlers ni frameworks. 100% Vanilla JS, HTML y CSS listo para GitHub Pages.

## Instalación y Uso

1. Clona el repositorio o descarga los archivos.
2. Abre `index.html` en tu navegador moderno preferido.
3. Ingresa tu API Key de OpenRouter (gratis en https://openrouter.ai/keys; no se guarda en ningún archivo).
4. Agrega los sorteos manualmente o utiliza el botón "Ejemplos Demo" para precargar un historial.
5. Haz clic en "Analizar y Predecir" para obtener los resultados generados por IA.

## Estructura de Archivos

- `index.html`: Estructura principal y maquetado de la interfaz de usuario.
- `style.css`: Hojas de estilo que incluyen variables de color, layout grid/flexbox y animaciones keyframe (`bounceIn`).
- `app.js`: Contiene la lógica del manejo del DOM, validación de inputs de 1 a 69 y 1 a 26, el cliente de OpenRouter (`openrouter.ai/api/v1`) con descubrimiento de modelos gratis y fallback, parseo del JSON y actualización visual de los resultados.

---

**Disclaimer Importante:**
*⚠️ Esta herramienta es solo para entretenimiento. La lotería es completamente aleatoria. Ningún análisis matemático ni inteligencia artificial puede predecir resultados futuros con certeza.*