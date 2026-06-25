<#
.SYNOPSIS
  PC起動/シャットダウン時刻を勤怠管理システムへ送信するサンプルエージェント。
  （要件3.1 / 11: PC起動・終了ログ登録）

.DESCRIPTION
  Windows端末のタスクスケジューラに登録し、
  ・ログオン時 / スタートアップ時 → -EventType startup
  ・ログオフ時 / シャットダウン時   → -EventType shutdown
  として実行することで、業務開始/終了時刻を自動記録します。

.PARAMETER EventType
  startup | shutdown | logon | logoff

.PARAMETER EmployeeCode
  従業員の社員番号（例: E0005）。サーバ側でユーザーを解決します。

.PARAMETER ApiBase
  APIのベースURL（例: http://localhost:3000）

.PARAMETER ApiKey
  サーバの .env PC_AGENT_API_KEY と一致させる共有APIキー。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File send-pc-activity.ps1 -EventType startup -EmployeeCode E0005
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("startup", "shutdown", "logon", "logoff")]
  [string]$EventType,

  [Parameter(Mandatory = $true)]
  [string]$EmployeeCode,

  [string]$ApiBase = "http://localhost:3000",
  [string]$ApiKey = "dev-pc-agent-key-change-me",
  [string]$TerminalId = $env:COMPUTERNAME
)

# ローカルIPアドレスを取得（取得できなければ null）
$ip = $null
try {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1).IPAddress
} catch { }

$payload = @{
  employeeCode = $EmployeeCode
  terminalId   = $TerminalId
  eventType    = $EventType
  occurredAt   = (Get-Date).ToString("o")  # ISO 8601
  ipAddress    = $ip
} | ConvertTo-Json

Write-Host "[$EventType] $EmployeeCode @ $TerminalId -> $ApiBase/api/pc-logs"

try {
  $resp = Invoke-RestMethod -Uri "$ApiBase/api/pc-logs" `
    -Method Post `
    -ContentType "application/json" `
    -Headers @{ "x-api-key" = $ApiKey } `
    -Body $payload `
    -TimeoutSec 15
  Write-Host "成功: $($resp | ConvertTo-Json -Compress)"
  exit 0
} catch {
  Write-Warning "送信に失敗しました: $($_.Exception.Message)"
  # オフライン時のリトライ用にローカルへ追記（任意）
  $logDir = Join-Path $env:LOCALAPPDATA "KintaiAgent"
  if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
  Add-Content -Path (Join-Path $logDir "pending.log") -Value $payload
  exit 1
}

<#
================================================================
 タスクスケジューラへの登録例（管理者PowerShellで実行）
================================================================

$script = "C:\path\to\send-pc-activity.ps1"
$emp    = "E0005"

# ログオン時（業務開始）
$actionStart = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -EventType startup -EmployeeCode $emp"
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "Kintai-Startup" -Action $actionStart -Trigger $triggerLogon -RunLevel Highest

# シャットダウン/ログオフは、グループポリシーの「ログオフ スクリプト」または
# イベントID(1074)トリガーのタスクとして -EventType shutdown を実行してください。
#>
