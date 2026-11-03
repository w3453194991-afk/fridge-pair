# 精确替换明显不对的菜品图：标题必须命中关键词
$root = 'E:\deepseek\fridge-pair'
$fix = @(
  @{ id='braised-pork';  q='braised pork belly chinese'; must='pork' },
  @{ id='dongpo-pork';   q='dongpo pork';                must='pork' },
  @{ id='hot-sour-potato'; q='stir fried shredded potato'; must='potato' },
  @{ id='lotus-rib';     q='lotus root pork rib soup';   must='lotus' },
  @{ id='milk-cats';     q='oatmeal porridge bowl';      must='oat|porridge|porridge' },
  @{ id='mushroom-chicken'; q='chicken mushroom stir fry'; must='chicken' },
  @{ id='mushroom-tofu'; q='tofu mushroom dish';         must='tofu' },
  @{ id='muhu-pork';     q='moo shu pork';               must='pork|moo|mu' },
  @{ id='pan-hairtail';  q='hairtail fish fried';        must='hairtail|fish' },
  @{ id='pan-salmon';    q='grilled salmon fillet';      must='salmon' },
  @{ id='pepper-potato'; q='potato pepper stir fry';     must='potato' },
  @{ id='rib-carrot';    q='pork rib soup';              must='rib|soup' },
  @{ id='shrimp-egg';    q='shrimp scrambled eggs';      must='shrimp|egg' },
  @{ id='steam-sparerib'; q='steamed pork ribs';         must='rib' },
  @{ id='taco';          q='beef burrito wrap';          must='burrito|wrap|taco' },
  @{ id='teriyaki';      q='teriyaki chicken rice';      must='teriyaki|chicken' },
  @{ id='white-chicken'; q='hainanese chicken rice';     must='chicken' },
  @{ id='yam-rib';       q='pork rib soup bowl';         must='rib|soup' },
  @{ id='hand-cabbage';  q='stir fried cabbage';         must='cabbage' },
  @{ id='chive-egg';     q='scrambled eggs chives';      must='egg' },
  @{ id='paella';        q='paella seafood rice';        must='paella' },
  @{ id='apple-yogurt';  q='yogurt parfait glass';       must='yogurt' }
)

$done = 0; $miss = 0
foreach ($f in $fix) {
  $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
         [uri]::EscapeDataString($f.q) + "&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json"
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest $api -UseBasicParsing -TimeoutSec 25 -UserAgent 'FridgePairDemo/1.0'
    $j = $r.Content | ConvertFrom-Json
    $pages = $j.query.pages.PSObject.Properties.Value
    $best = $null
    foreach ($p in $pages) {
      if ($p.title -notmatch '\.(jpg|jpeg|png)$') { continue }
      if (-not $p.imageinfo) { continue }
      $t = $p.title.ToLower()
      if ($t -match 'logo|map|menu|sign|poster|label|packaging') { continue }
      if ($t -match $f.must) { $best = $p; break }
    }
    if ($best) {
      Start-Sleep -Milliseconds 600
      Invoke-WebRequest $best.imageinfo[0].thumburl -OutFile "$root\img\d\$($f.id).jpg" -TimeoutSec 30 -UserAgent 'FridgePairDemo/1.0'
      $done++
      "OK  $($f.id) <- $($best.title)"
    } else { $miss++; "MISS $($f.id)" }
  } catch { $miss++; "ERR $($f.id): $($_.Exception.Message.Substring(0,30))" }
}
"替换完成 ok=$done miss=$miss"
