# PowerShell script to create Windows Task Scheduler for Email Poller
# Run this script as Administrator

$TaskName = "Suki CRM Email Poller"
$ScriptPath = "C:\Users\ajithkumar\Desktop\CRM NEW Requirement\poll-emails.bat"
$Description = "Automatically polls email inboxes (Gmail & Outlook) and creates leads in CRM"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task '$TaskName' already exists. Updating..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the scheduled task
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description $Description -RunLevel Highest -Force

Write-Host "✅ Task Scheduler created successfully!" -ForegroundColor Green
Write-Host "Task Name: $TaskName" -ForegroundColor Cyan
Write-Host "Run Interval: Every 5 minutes" -ForegroundColor Cyan
Write-Host "Script: $ScriptPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "To run the task immediately, open Task Scheduler and click 'Run'." -ForegroundColor Yellow
Write-Host "To view the task, open Task Scheduler and search for '$TaskName'." -ForegroundColor Yellow