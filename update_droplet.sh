#!/usr/bin/env bash
set -e

echo "=========================================="
echo " FLYERA - UPDATE TO LATEST COMMIT         "
echo "=========================================="

# Auto-detect repository path
REPO_DIR="$(pwd)"
if [ -d "/var/www/flyera" ]; then
    REPO_DIR="/var/www/flyera"
elif [ -d "/root/Flyera_Water_SupplyManagement" ]; then
    REPO_DIR="/root/Flyera_Water_SupplyManagement"
elif [ -d "/var/www/Flyera_Water_SupplyManagement" ]; then
    REPO_DIR="/var/www/Flyera_Water_SupplyManagement"
fi

cd "$REPO_DIR"
echo "==> Working directory: $REPO_DIR"

# Ensure 2GB swap is active so build never fails
if [ ! -f /swapfile ]; then
    echo "==> Setting up 2GB swap for safe Next.js build..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

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

# 3. Update Frontend & Build
if [ -d "$REPO_DIR/frontend" ]; then
    echo "==> Updating Frontend & Building..."
    cd "$REPO_DIR/frontend"
    export NODE_OPTIONS="--max-old-space-size=1536"
    npm install
    npm run build
fi

# 4. Restart Services
echo "==> Restarting Application Services..."
cd "$REPO_DIR"

# Check if PM2 is used
if command -v pm2 &> /dev/null; then
    pm2 restart all || true
fi

# Check if Systemd is used
systemctl restart flyera-backend 2>/dev/null || systemctl restart water-backend 2>/dev/null || true
systemctl restart flyera-frontend 2>/dev/null || systemctl restart water-frontend 2>/dev/null || true
systemctl restart uvicorn 2>/dev/null || true
systemctl restart nginx 2>/dev/null || true

echo "=========================================="
echo " UPDATE COMPLETE!                         "
echo " All latest features are now live!        "
echo "=========================================="
