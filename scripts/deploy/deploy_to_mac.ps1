$MAC_IP = "192.168.1.24"
$MAC_USER = "FERROX"
$MAC_KEY = "$env:USERPROFILE\.ssh\gserver_deploy_ed25519"

Write-Host "🚀 Запуск деплоя на Mac сервер ($MAC_IP)..." -ForegroundColor Cyan

$remoteDeployScript = @"
export PATH="`$HOME/.bun/bin:`$PATH"

cd ~/AI-GLOBAL-SKILLS
echo "📥 Получение свежего кода из GitHub..."
git pull origin main

echo "📦 Установка зависимостей..."
bun install

echo "🔨 Сборка проекта..."
bun run build

# echo "🔄 Перезапуск Daemon..."
# Здесь будет команда для pm2 или launchctl после реализации Milestone 2
# pm2 restart global-mcp-daemon
"@

ssh -i $MAC_KEY -o StrictHostKeyChecking=no "${MAC_USER}@${MAC_IP}" $remoteDeployScript

Write-Host "✅ Деплой успешно завершен!" -ForegroundColor Green
