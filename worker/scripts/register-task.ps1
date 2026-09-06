<#
  Einmaliges Setup: registriert den Videotool-Worker als Windows Scheduled
  Task, der bei jeder Anmeldung startet und bei Fehlern neu startet.
  Manuell auszufuehren, NICHT Teil des automatisierten Builds.

  Voraussetzung: `npm install` und `npm run build` in worker/ bereits gelaufen
  (dieses Skript startet `node dist/index.js`, nicht `tsx src/index.ts`).
#>

$ErrorActionPreference = "Stop"

$taskName = "VideotoolWorker"
$workerDir = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction Stop).Source
$logDir = Join-Path $workerDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "worker.log"

if (-not (Test-Path (Join-Path $workerDir "dist\index.js"))) {
    Write-Host "dist/index.js fehlt -- erst 'npm run build' in $workerDir ausfuehren." -ForegroundColor Yellow
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "dist\index.js" `
    -WorkingDirectory $workerDir

# PowerShell-Umleitung existiert bei ScheduledTask-Actions nicht direkt --
# ueber ein kleines Wrapper-Cmd, das stdout/stderr in die Logdatei schreibt.
$wrapperArgs = "/c `"`"$nodePath`" dist\index.js >> `"$logFile`" 2>&1`""
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $wrapperArgs -WorkingDirectory $workerDir

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0) `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Write-Host "Task '$taskName' existiert bereits -- wird aktualisiert." -ForegroundColor Cyan
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Videotool: lokaler Worker fuer die automatische Video-Bearbeitung (holt Auftraege aus Supabase)." `
    | Out-Null

Write-Host "Task '$taskName' registriert. Startet bei der naechsten Anmeldung." -ForegroundColor Green
Write-Host "Manuell jetzt starten: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "Log-Datei: $logFile"
