$ErrorActionPreference = 'Stop'

try {
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [Console]::InputEncoding = $utf8NoBom
  [Console]::OutputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
  chcp.com 65001 > $null
  $env:PYTHONUTF8 = '1'
  $env:PYTHONIOENCODING = 'utf-8'
} catch {
  Write-Warning "Failed to switch this PowerShell session to UTF-8: $($_.Exception.Message)"
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$node = 'D:\study\Nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) {
  $nodeCmd = Get-Command node -ErrorAction Stop
  $node = $nodeCmd.Source
}

$ports = @(5273, 5274)
foreach ($port in $ports) {
  $ids = netstat -ano |
    Select-String (':' + $port + '\s') |
    ForEach-Object { ($_ -split '\s+')[-1] } |
    Sort-Object -Unique |
    Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }
  foreach ($procId in $ids) {
    Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Milliseconds 500

$serverScript = Join-Path $root 'scripts\static-server.mjs'
$distRoot = Join-Path $root 'dist'
$artRoot = Join-Path $root 'public'
$dmCommand = "`"$node`" `"$serverScript`" --host 127.0.0.1 --port 5273 --root `"$distRoot`" --art-asset-root `"$artRoot`""
$playerCommand = "`"$node`" `"$serverScript`" --host 127.0.0.1 --port 5274 --root `"$distRoot`" --art-asset-root `"$artRoot`""

$dm = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = $dmCommand
  CurrentDirectory = $root
}

$player = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine = $playerCommand
  CurrentDirectory = $root
}

Start-Sleep -Seconds 2

foreach ($port in $ports) {
  try {
    $res = Invoke-WebRequest -Uri ('http://127.0.0.1:' + $port + '/') -UseBasicParsing -TimeoutSec 5
    Write-Host "$port OK $($res.StatusCode)"
  } catch {
    Write-Host "$port FAILED $($_.Exception.Message)"
  }
}

Write-Host "DM PID: $($dm.ProcessId)"
Write-Host "Player PID: $($player.ProcessId)"
