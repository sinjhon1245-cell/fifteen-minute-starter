Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "assets\icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

$black = [System.Drawing.Color]::FromArgb(255, 10, 10, 10)
$white = [System.Drawing.Color]::FromArgb(255, 245, 245, 245)
$accent = [System.Drawing.Color]::FromArgb(255, 255, 67, 25)

function New-Icon {
    param(
        [int]$Size,
        [string]$Path,
        [bool]$Maskable
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $bgBrush = New-Object System.Drawing.SolidBrush $black
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)

    # safe zone padding for maskable icons (approx 20% margin so content survives masking)
    $pad = if ($Maskable) { [int]($Size * 0.22) } else { [int]($Size * 0.12) }

    $numberFontSize = [int]($Size * 0.40)
    $fontFamily = New-Object System.Drawing.FontFamily "Arial"
    $font = New-Object System.Drawing.Font $fontFamily, $numberFontSize, ([System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush $white

    $text = "15"
    $textSize = $g.MeasureString($text, $font)
    $textX = ($Size - $textSize.Width) / 2
    $textY = ($Size * 0.5) - $textSize.Height * 0.75

    $g.DrawString($text, $font, $textBrush, $textX, $textY)

    # accent underline representing "start"
    $lineY = $Size * 0.72
    $lineHeight = [Math]::Max(4, [int]($Size * 0.045))
    $lineWidth = $Size - ($pad * 2)
    $lineX = $pad
    $accentBrush = New-Object System.Drawing.SolidBrush $accent
    $g.FillRectangle($accentBrush, $lineX, $lineY, $lineWidth, $lineHeight)

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

New-Icon -Size 192 -Path (Join-Path $iconsDir "icon-192.png") -Maskable $false
New-Icon -Size 512 -Path (Join-Path $iconsDir "icon-512.png") -Maskable $false
New-Icon -Size 192 -Path (Join-Path $iconsDir "icon-maskable-192.png") -Maskable $true
New-Icon -Size 512 -Path (Join-Path $iconsDir "icon-maskable-512.png") -Maskable $true
New-Icon -Size 180 -Path (Join-Path $iconsDir "apple-touch-icon.png") -Maskable $false
New-Icon -Size 32 -Path (Join-Path $iconsDir "favicon-32.png") -Maskable $false

Write-Output "Icons generated in $iconsDir"
