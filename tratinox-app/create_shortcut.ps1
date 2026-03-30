$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Tratinox - Sistema de Produção.url'
$Url = "file:///C:/Users/Tratinox/.gemini/antigravity/scratch/tratinox-app/index.html"
$Content = "[InternetShortcut]`r`nURL=$Url"
Set-Content -Path $ShortcutPath -Value $Content -Encoding UTF8
Write-Host "Atalho criado com sucesso no seu Ambiente de Trabalho!"
