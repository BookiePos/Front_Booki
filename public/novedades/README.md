# Medios de las novedades

Cada versión tiene su carpeta (`1.6.0/`, …) con lo que muestra la tarjeta de
novedades (`src/components/erp/novedades-card.tsx`, contenido en
`src/lib/novedades.ts`). Todo sale del sistema real con los datos de prueba
locales (`pnpm seed:demo` del backend), nunca de datos de un cliente.

- **Videos** (`*.mp4` + su primer cuadro `*.jpg`): H.264, 1280×800, sin audio.
  Se graban con un guion de Playwright que mueve un cursor dibujado en la
  página y toma cuadros por el protocolo del navegador (`Page.startScreencast`);
  ffmpeg los arma respetando la hora de cada cuadro:

  ```
  ffmpeg -f concat -safe 0 -i lista.txt -vf "fps=30,scale=1280:-2" \
    -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow -movflags +faststart -an clip.mp4
  ```

  Cada clip dura menos de 20 s y pesa menos de 1,5 MB: la tarjeta sale al
  iniciar sesión y no debe tardar en cargar.

- **Antes y ahora** (`*-antes.webp`, `*-ahora.webp`): capturas 1440×900 de la
  misma pantalla, convertidas a WebP con calidad 82.
