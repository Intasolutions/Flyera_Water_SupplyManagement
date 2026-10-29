#!/usr/bin/env bash
set -e

echo "=========================================="
echo " FLYERA - AUTO-LOCATE & UPDATE           "
echo "=========================================="

# Ensure 2GB swap is active so build never fails
if [ ! -f /swapfile ]; then
    echo "==> Setting up 2GB swap for safe memory headroom..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Auto-detect repository path
REPO_DIR="/var/www/aquaflow"

if [ ! -d "$REPO_DIR" ]; then
    RUNNING_DIR=$(pwdx $(pgrep -f "uvicorn" | head -n 1) 2>/dev/null | awk '{print $2}' || true)
    if [ -n "$RUNNING_DIR" ] && [ -d "$RUNNING_DIR" ]; then
        if [ -f "$RUNNING_DIR/main.py" ]; then
            REPO_DIR=$(dirname "$RUNNING_DIR")
        elif [ -d "$RUNNING_DIR/backend" ]; then
            REPO_DIR="$RUNNING_DIR"
        fi
    fi
fi

if [ ! -d "$REPO_DIR" ]; then
    for candidate in \
        "/var/www/aquaflow" \
        "/var/www/flyera" \
        "/var/www/water_supply" \
        "/var/www/Flyera_Water_SupplyManagement" \
        "/root/Flyera_Water_SupplyManagement" \
        "$(pwd)"; do
        if [ -d "$candidate/.git" ]; then
            REPO_DIR="$candidate"
            break
        fi
    done
fi

echo "==> Found Repository at: $REPO_DIR"
cd "$REPO_DIR"

# 1. Pull latest code from GitHub
echo "==> Pulling latest changes from origin main..."
git fetch origin main
git reset --hard origin/main

# 2. Update Backend
echo "==> Updating Backend..."
cd "$REPO_DIR/backend"
if [ -d "venv" ]; then
    ./venv/bin/pip install -r requirements.txt
    ./venv/bin/python -c "from main import app; print('Backend modules verified!')"
elif command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
fi

# 3. Ensure Node.js & npm are installed
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

if ! command -v npm &> /dev/null; then
    echo "==> Installing Node.js 20 LTS & npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "==> Node version: $(node -v), NPM version: $(npm -v)"

# 4. Update Frontend & Build
if [ -d "$REPO_DIR/frontend" ]; then
    echo "==> Updating Frontend & Building Next.js..."
    cd "$REPO_DIR/frontend"
    export NODE_OPTIONS="--max-old-space-size=1536"
    npm install
    npm run build
fi

# 5. Restart Services
echo "==> Restarting Application Services..."
cd "$REPO_DIR"

# Restart systemd services
systemctl restart aquaflow* 2>/dev/null || true
systemctl restart flyera* 2>/dev/null || true
systemctl restart water* 2>/dev/null || true
systemctl restart uvicorn 2>/dev/null || true
systemctl restart nginx 2>/dev/null || true

# Check if PM2 is used
if command -v pm2 &> /dev/null; then
    pm2 restart all || true
fi

echo "=========================================="
echo " UPDATE COMPLETE!                         "
echo " All latest features are now live!        "
echo "=========================================="
