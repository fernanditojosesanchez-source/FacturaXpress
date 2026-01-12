# Script para generar iconos PWA con ImageMagick
# Instalar: winget install ImageMagick.ImageMagick

# Colores
$bg = "#0ea5e9"  # Sky-500
$fg = "white"

# Crear 192x192
magick -size 192x192 xc:"$bg" `
  -gravity center `
  -pointsize 96 -font Arial-Bold `
  -fill "$fg" -annotate +0+0 "FX" `
  client/public/pwa-192x192.png

# Crear 512x512
magick -size 512x512 xc:"$bg" `
  -gravity center `
  -pointsize 256 -font Arial-Bold `
  -fill "$fg" -annotate +0+0 "FX" `
  client/public/pwa-512x512.png

# Crear 180x180 (Apple)
magick -size 180x180 xc:"$bg" `
  -gravity center `
  -pointsize 90 -font Arial-Bold `
  -fill "$fg" -annotate +0+0 "FX" `
  client/public/apple-touch-icon.png

Write-Host "✅ Iconos PWA generados en client/public/" -ForegroundColor Green
