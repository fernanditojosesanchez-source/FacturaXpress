# Generar iconos PWA placeholder usando .NET System.Drawing
# No requiere instalación adicional

Add-Type -AssemblyName System.Drawing

function New-PWAIcon {
    param(
        [int]$Size,
        [string]$OutputPath
    )
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Fondo azul sky-500 (#0ea5e9)
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0ea5e9")
    $graphics.Clear($bgColor)
    
    # Texto "FX" blanco
    $fgColor = [System.Drawing.Color]::White
    $fontSize = [math]::Floor($Size * 0.5)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush($fgColor)
    
    # Centrar texto
    $text = "FX"
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($Size - $textSize.Width) / 2
    $y = ($Size - $textSize.Height) / 2
    
    $graphics.DrawString($text, $font, $brush, $x, $y)
    
    # Guardar
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $graphics.Dispose()
    $bitmap.Dispose()
    $font.Dispose()
    $brush.Dispose()
    
    Write-Host "✅ Creado: $OutputPath" -ForegroundColor Green
}

# Crear directorio si no existe
$publicDir = "client/public"
if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
}

# Generar iconos
Write-Host "🎨 Generando iconos PWA..." -ForegroundColor Cyan

New-PWAIcon -Size 192 -OutputPath "$publicDir/pwa-192x192.png"
New-PWAIcon -Size 512 -OutputPath "$publicDir/pwa-512x512.png"
New-PWAIcon -Size 180 -OutputPath "$publicDir/apple-touch-icon.png"

Write-Host "`n✨ ¡Listo! Iconos PWA generados en $publicDir" -ForegroundColor Green
Write-Host "📱 Ahora puedes instalar la app en tu dispositivo" -ForegroundColor Yellow
