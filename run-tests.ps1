$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $project
try {
  $failed = 0
  & node (Join-Path $project "tools/validate-content.mjs")
  if ($LASTEXITCODE -ne 0) { $failed++ }
  Get-ChildItem -LiteralPath $project -File -Filter "test-*.mjs" |
    Sort-Object Name |
    ForEach-Object {
      Write-Host "--- $($_.Name)"
      & node $_.FullName
      if ($LASTEXITCODE -ne 0) { $failed++ }
    }

  Get-ChildItem -LiteralPath $project -File -Filter "*.js" | ForEach-Object {
    & node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { $failed++ }
  }

  if ($failed -gt 0) { throw "$failed kontrol başarısız." }
  Write-Host "Tüm testler ve JavaScript sözdizimi kontrolleri geçti."
} finally {
  Pop-Location
}
