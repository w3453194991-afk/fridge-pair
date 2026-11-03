# 从 Wikimedia Commons 批量抓图（慢速 + 429 重试）
$ErrorActionPreference = 'Continue'
$root = 'E:\deepseek\fridge-pair'
$list = Get-Content "$root\tools\photo-queries.json" -Raw -Encoding UTF8 | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path "$root\img\d" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\img\f" | Out-Null

function Get-Dest($it) {
  if ($it.kind -eq 'd') { return "$root\img\d\$($it.id).jpg" }
  return "$root\img\f\$($it.id).jpg"
}

function Fetch-One($it, $dest) {
  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
         [uri]::EscapeDataString($it.q) +
         "&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=560&format=json"
  try {
    $r = Invoke-WebRequest $api -UseBasicParsing -TimeoutSec 25 -UserAgent 'FridgePairDemo/1.0 (hackathon demo)'
    $j = $r.Content | ConvertFrom-Json
    $pages = $j.query.pages.PSObject.Properties.Value
    if (-not $pages) { return 'no-result' }
    $url = $null
    foreach ($p in ($pages | Sort-Object { $_.index })) {
      if ($p.title -match '\.(jpg|jpeg|png)$' -and $p.imageinfo -and $p.imageinfo[0].thumburl) { $url = $p.imageinfo[0].thumburl; break }
    }
    if (-not $url) { return 'no-image' }
    Start-Sleep -Milliseconds 400
    Invoke-WebRequest $url -OutFile $dest -TimeoutSec 30 -UserAgent 'FridgePairDemo/1.0 (hackathon demo)'
    if ((Get-Item $dest).Length -lt 4000) { Remove-Item $dest -Force; return 'tiny' }
    return 'ok'
  } catch {
    $m = $_.Exception.Message
    if ($m -match '429') { return 'ratelimit' }
    return "err " + $m.Substring(0, [Math]::Min(60, $m.Length))
  }
}

$ok = 0; $fail = 0; $skip = 0
$log = New-Object System.Collections.ArrayList

foreach ($it in $list) {
  $dest = Get-Dest $it
  if (Test-Path $dest) { $skip++; continue }

  $res = 'none'
  for ($try = 0; $try -lt 3; $try++) {
    $res = Fetch-One $it $dest
    if ($res -eq 'ok') { break }
    if ($res -eq 'ratelimit') { Start-Sleep -Seconds 18; continue }
    break
  }
  if ($res -eq 'ok') { $ok++; [void]$log.Add("$($it.name) | ok") }
  else { $fail++; [void]$log.Add("$($it.name) | $res") }
  Start-Sleep -Milliseconds 1300
}

$log | Out-File "$root\tools\photo-log2.txt" -Encoding utf8
"完成：ok=$ok fail=$fail skip=$skip"
