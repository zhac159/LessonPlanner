<#
  Dev-only: opens an exported .pptx in the real PowerPoint (COM automation) and checks it.

    powershell -ExecutionPolicy Bypass -File scripts/verify-pptx-com.ps1 .artifacts/sample.pptx
    powershell -File scripts/verify-pptx-com.ps1 <file.pptx> [-OutDir .artifacts/com]

  It opens the file read-only with no window, prints the slide count and shapes per slide, exports
  every slide to <OutDir>/slide-N.png (look at them!), then closes PowerPoint. It exits 1 when
  PowerPoint refuses to open the file, or when PowerPoint sees fewer shapes than the XML contains
  (a sign that it silently "repaired" the file by dropping content). Only a PowerPoint process
  that this script started is ever killed.
#>
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$OutDir = '.artifacts/com'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$full = (Resolve-Path $Path).Path
$out = New-Item -ItemType Directory -Force -Path $OutDir
$outFull = $out.FullName
Get-ChildItem $outFull -Filter 'slide-*.png' | Remove-Item -Force

# Shapes the file declares, per slide, straight from the XML (what PowerPoint should also see).
function Get-XmlShapeCounts([string]$file) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($file)
  try {
    $counts = @{}
    foreach ($entry in $zip.Entries) {
      if ($entry.FullName -match '^ppt/slides/slide(\d+)\.xml$') {
        $reader = New-Object System.IO.StreamReader($entry.Open())
        $xml = $reader.ReadToEnd()
        $reader.Close()
        $counts[[int]$Matches[1]] = ([regex]::Matches($xml, '<p:(sp|pic|graphicFrame)>')).Count
      }
    }
    return $counts
  } finally { $zip.Dispose() }
}

$expected = Get-XmlShapeCounts $full
$alreadyRunning = @(Get-Process POWERPNT -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$ppt = $null
$problems = @()
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  # Open(FileName, ReadOnly, Untitled, WithWindow): msoTrue = -1, msoFalse = 0
  $pres = $ppt.Presentations.Open($full, -1, 0, 0)
  $slides = $pres.Slides.Count
  Write-Output "OPENED  $full"
  Write-Output "slides  $slides (file declares $($expected.Count))"
  if ($slides -ne $expected.Count) { $problems += "slide count differs: PowerPoint $slides, XML $($expected.Count)" }

  for ($i = 1; $i -le $slides; $i++) {
    $slide = $pres.Slides.Item($i)
    $shapes = $slide.Shapes.Count
    $png = Join-Path $outFull "slide-$i.png"
    $slide.Export($png, 'PNG', 1920, 1080)
    $notes = ''
    try { $notes = $slide.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text } catch { }
    $notesText = if ($notes.Length -gt 60) { $notes.Substring(0, 60) + '...' } else { $notes }
    Write-Output ("slide {0}: {1} shapes (XML {2}), notes: '{3}'" -f $i, $shapes, $expected[$i], ($notesText -replace "[\r\n]+", ' / '))
    if ($shapes -ne $expected[$i]) { $problems += "slide ${i}: PowerPoint sees $shapes shapes, XML has $($expected[$i])" }
  }
  $pres.Close()
} catch {
  $problems += "PowerPoint could not open or read the file: $($_.Exception.Message)"
} finally {
  if ($ppt) { try { $ppt.Quit() } catch { } ; [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) }
  # Kill only a PowerPoint that we started (it may linger after Quit when automation is flaky).
  Start-Sleep -Milliseconds 500
  Get-Process POWERPNT -ErrorAction SilentlyContinue |
    Where-Object { $alreadyRunning -notcontains $_.Id } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}

if ($problems.Count -gt 0) {
  $problems | ForEach-Object { Write-Output "PROBLEM $_" }
  exit 1
}
Write-Output "OK      PowerPoint opened the file and sees every shape. PNGs in $outFull"
exit 0
