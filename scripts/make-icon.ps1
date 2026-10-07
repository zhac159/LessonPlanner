# Regenerates resources/icon.png (512x512): a gradient tile with a slide and a sparkle.
# Used for the window/taskbar icon and (via electron-builder) the Windows .exe icon.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File scripts/make-icon.ps1
Add-Type -AssemblyName System.Drawing

$size = 512
$outDir = Join-Path $PSScriptRoot '..\resources'
New-Item -ItemType Directory -Force $outDir | Out-Null
$outFile = Join-Path (Resolve-Path $outDir) 'icon.png'

function New-RoundRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$violet = [System.Drawing.ColorTranslator]::FromHtml('#6d5dfc')
$cyan = [System.Drawing.ColorTranslator]::FromHtml('#22c7f2')

# Background tile
$bg = New-RoundRect 16 16 480 480 112
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0, 0)), ([System.Drawing.Point]::new(512, 512)), $violet, $cyan
$g.FillPath($bgBrush, $bg)

# Slide card
$card = New-RoundRect 112 156 288 204 30
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 255, 255, 255))), $card)

# Slide content: title bar, two text lines, three bars
$g.FillPath((New-Object System.Drawing.SolidBrush $violet), (New-RoundRect 144 188 128 24 12))
$line = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#c9cdea'))
$g.FillPath($line, (New-RoundRect 144 232 160 15 7.5))
$g.FillPath($line, (New-RoundRect 144 258 118 15 7.5))
$barBrush = New-Object System.Drawing.SolidBrush $cyan
$g.FillPath($barBrush, (New-RoundRect 316 296 20 40 6))
$g.FillPath($barBrush, (New-RoundRect 344 274 20 62 6))
$g.FillPath((New-Object System.Drawing.SolidBrush $violet), (New-RoundRect 288 312 20 24 6))

# Sparkle (four-point star) over the top-right corner
$cx = 404; $cy = 138; $outer = 64; $inner = 17
$pts = @()
for ($i = 0; $i -lt 8; $i++) {
  $angle = ([math]::PI / 4) * $i - ([math]::PI / 2)
  $r = if ($i % 2 -eq 0) { $outer } else { $inner }
  $pts += [System.Drawing.PointF]::new([single]($cx + $r * [math]::Cos($angle)), [single]($cy + $r * [math]::Sin($angle)))
}
$g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#ffe08a'))), $pts)

$g.Dispose()
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "Wrote $outFile"
