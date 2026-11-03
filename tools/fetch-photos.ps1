# 从 Wikimedia Commons 批量抓图（PowerShell 版，Node/curl 在本机连不上）
$ErrorActionPreference = 'Continue'
$root = 'E:\deepseek\fridge-pair'
$list = Get-Content "$root\tools\photo-queries.json" -Raw -Encoding UTF8 | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path "$root\img\d" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\img\f" | Out-Null

$ok = 0; $fail = 0; $skip = 0
$log = New-Object System.Collections.ArrayList

foreach ($it in $list) {
  $dest = if ($it.kind -eq 'd') { "$root\img\d\$($it.id).jpg" } else { "$root\img\f\$($it.id).jpg" }
  if (Test-Path $dest) { $skip++; continue }

  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
         [uri]::EscapeDataString($it.q) +
         "&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url&iiurlwidth=560&format=json"
  try {
    $r = Invoke-WebRequest $api -UseBasicParsing -TimeoutSec 20 -UserAgent 'FridgePairDemo/1.0'
    $j = $r.Content | ConvertFrom-Json
    $pages = $j.query.pages.PSObject.Properties.Value
    if (-not $pages) { $fail++; [void]$log.Add("$($it.name) | no-result"); Start-Sleep -Milliseconds 150; continue }
    $url = $null
    foreach ($p in ($pages | Sort-Object { $_.index })) {
      if ($p.title -match '\.(jpg|jpeg|png)$' -and $p.imageinfo) { $url = $p.imageinfo[0].thumburl; break }
    }
    if (-not $url) { $fail++; [void]$log.Add("$($it.name) | no-image"); Start-Sleep -Milliseconds 150; continue }
    Invoke-WebRequest $url -OutFile $dest -TimeoutSec 25 -UserAgent 'FridgePairDemo/1.0'
    $len = (Get-Item $dest).Length
    if ($len -lt 4000) { Remove-Item $dest -Force; $fail++; [void]$log.Add("$($it.name) | tiny") }
    else { $ok++; [void]$log.Add("$($it.name) | ok $len") }
  } catch {
    $fail++; [void]$log.Add("$($it.name) | err $($_.Exception.Message.Substring(0,[Math]::Min(50,$_.Exception.Message.Length)))")
  }
  Start-Sleep -Milliseconds 130
}

$log | Out-File "$root\tools\photo-log.txt" -Encoding utf8
"完成：ok=$ok fail=$fail skip=$skip"
