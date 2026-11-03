# 关键词打分版抓图：搜索结果按标题命中关键词打分，取最匹配的一张
$ErrorActionPreference = 'Continue'
$root = 'E:\deepseek\fridge-pair'
$list = Get-Content "$root\tools\photo-queries.json" -Raw -Encoding UTF8 | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path "$root\img\d" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\img\f" | Out-Null

$BAD = 'logo|map|diagram|chart|coin|stamp|packaging|label|sign|poster|book|cover|monument|museum|portrait|drawing|painting|cartoon|icon|svg'

function Fetch-One($it, $dest) {
  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
         [uri]::EscapeDataString($it.q) +
         "&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json"
  try {
    $r = Invoke-WebRequest $api -UseBasicParsing -TimeoutSec 25 -UserAgent 'FridgePairDemo/1.0 (hackathon)'
    $j = $r.Content | ConvertFrom-Json
    $pages = $j.query.pages.PSObject.Properties.Value
    if (-not $pages) { return @{ ok = $false; why = 'no-result' } }

    $tokens = ($it.q -split '\s+') | Where-Object { $_.Length -gt 2 }
    $best = $null; $bestScore = 0

    foreach ($p in $pages) {
      if ($p.title -notmatch '\.(jpg|jpeg|png)$') { continue }
      if (-not $p.imageinfo -or -not $p.imageinfo[0].thumburl) { continue }
      $t = $p.title.ToLower()
      if ($t -match $BAD) { continue }
      $score = 0
      foreach ($tok in $tokens) {
        if ($t.Contains($tok.ToLower())) { $score += 2 }
      }
      if ($t -match 'food|dish|cooked|cuisine') { $score += 1 }
      $score -= [int]$p.index * 0.1
      if ($score -gt $bestScore) { $bestScore = $score; $best = $p }
    }
    if (-not $best) { return @{ ok = $false; why = 'no-good-candidate' } }

    Start-Sleep -Milliseconds 350
    Invoke-WebRequest $best.imageinfo[0].thumburl -OutFile $dest -TimeoutSec 30 -UserAgent 'FridgePairDemo/1.0 (hackathon)'
    if ((Get-Item $dest).Length -lt 4000) { Remove-Item $dest -Force; return @{ ok = $false; why = 'tiny' } }
    return @{ ok = $true; why = "$bestScore|$($best.title)" }
  } catch {
    $m = $_.Exception.Message
    if ($m -match '429') { return @{ ok = $false; why = 'ratelimit' } }
    return @{ ok = $false; why = 'err' }
  }
}

$ok = 0; $fail = 0
$log = New-Object System.Collections.ArrayList

foreach ($it in $list) {
  $dest = if ($it.kind -eq 'd') { "$root\img\d\$($it.id).jpg" } else { "$root\img\f\$($it.id).jpg" }

  $res = @{ ok = $false; why = 'skip' }
  for ($try = 0; $try -lt 3; $try++) {
    $res = Fetch-One $it $dest
    if ($res.ok) { break }
    if ($res.why -eq 'ratelimit') { Start-Sleep -Seconds 20; continue }
    break
  }
  if ($res.ok) { $ok++; [void]$log.Add("$($it.kind)|$($it.name)|ok|$($res.why)") }
  else { $fail++; [void]$log.Add("$($it.kind)|$($it.name)|$($res.why)|") }
  Start-Sleep -Milliseconds 1200
}

$log | Out-File "$root\tools\photo-log3.txt" -Encoding utf8
"完成 ok=$ok fail=$fail"
