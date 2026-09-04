$MAC_IP = "192.168.1.24"
$MAC_USER = "FERROX"
$MAC_KEY = "$env:USERPROFILE\.ssh\gserver_deploy_ed25519"
$DEPLOY_KEY = "$env:USERPROFILE\.ssh\github_deploy_key_global_mcp"

Write-Host "🚀 Шаг 1: Копирование Deploy Key на Mac сервер..." -ForegroundColor Cyan
scp -i $MAC_KEY -o StrictHostKeyChecking=no $DEPLOY_KEY "${MAC_USER}@${MAC_IP}:~/.ssh/github_deploy_key_global_mcp"
scp -i $MAC_KEY -o StrictHostKeyChecking=no "${DEPLOY_KEY}.pub" "${MAC_USER}@${MAC_IP}:~/.ssh/github_deploy_key_global_mcp.pub"

Write-Host "🚀 Шаг 2: Настройка ~/.ssh/config на Mac для доступа к GitHub..." -ForegroundColor Cyan
$sshConfig = @"

Host github-globalmcp
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key_global_mcp
    IdentitiesOnly yes
"@

$remoteScript = @"
chmod 600 ~/.ssh/github_deploy_key_global_mcp
touch ~/.ssh/config
if ! grep -q 'github-globalmcp' ~/.ssh/config; then
    echo '$sshConfig' >> ~/.ssh/config
fi
chmod 644 ~/.ssh/config
"@

ssh -i $MAC_KEY -o StrictHostKeyChecking=no "${MAC_USER}@${MAC_IP}" $remoteScript

Write-Host "🚀 Шаг 3: Клонирование репозитория на Mac..." -ForegroundColor Cyan
# Using the custom SSH host alias we just created
ssh -i $MAC_KEY -o StrictHostKeyChecking=no "${MAC_USER}@${MAC_IP}" "if [ ! -d '~/AI-GLOBAL-SKILLS' ]; then git clone git@github-globalmcp:BlackWh1te/AI-GLOBAL-SKILLS.git ~/AI-GLOBAL-SKILLS; else echo 'Репозиторий уже склонирован'; fi"

Write-Host "✅ Базовая настройка Mac сервера завершена!" -ForegroundColor Green
