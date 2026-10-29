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
REPO_DIR=""

# Check running uvicorn / python process to find exact directory
RUNNING_DIR=$(pwdx $(pgrep -f "uvicorn" | head -n 1) 2>/dev/null | awk '{print $2}' || true)
if [ -n "$RUNNING_DIR" ] && [ -d "$RUNNING_DIR" ]; then
    if [ -f "$RUNNING_DIR/main.py" ]; then
        REPO_DIR=$(dirname "$RUNNING_DIR")
    elif [ -d "$RUNNING_DIR/backend" ]; then
        REPO_DIR="$RUNNING_DIR"
    fi
fi

# Fallback searches
if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    for candidate in \
        "/var/www/flyera" \
        "/var/www/water_supply" \
        "/var/www/Flyera_Water_SupplyManagement" \
        "/root/Flyera_Water_SupplyManagement" \
        "/root/water_supply" \
        "/home/*" \
        "$(pwd)"; do
        if [ -d "$candidate/.git" ]; then
            REPO_DIR="$candidate"
            break
        fi
    done
fi

if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR/.git" ]; then
    echo "==> Searching for repository on filesystem..."
    GIT_DIR=$(find / -name ".git" -type d 2>/dev/null | grep -iE "flyera|water" | head -n 1 || true)
    if [ -n "$GIT_DIR" ]; then
        REPO_DIR=$(dirname "$GIT_DIR")
    fi
fi

# If still not found, search by water_supply.db
if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    DB_FILE=$(find / -name "water_supply.db" 2>/dev/null | head -n 1 || true)
    if [ -n "$DB_FILE" ]; then
        REPO_DIR=$(dirname $(dirname "$DB_FILE"))
    fi
fi

if [ -z "$REPO_DIR" ] || [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: Could not locate existing Flyera directory."
    echo "Running processes:"
    ps aux | grep -E "uvicorn|node|next|python" | grep -v grep || true
    echo "Found git repositories:"
    find / -name ".git" -type d 2>/dev/null | head -n 10 || true
    exit 1
fi

echo "==> Found Repository at: $REPO_DIR"
cd "$REPO_DIR"

# 1. Pull latest code from GitHub
echo "==> Pulling latest changes from origin main..."
if [ -d ".git" ]; then
    git fetch origin main
    git reset --hard origin/main
else
    echo "Directory has no .git, checking if git clone is needed..."
    git init
    git remote add origin https://github.com/Intasolutions/Flyera_Water_SupplyManagement.git || true
    git fetch origin main
    git reset --hard origin/main
fi

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

# Restart systemd services if present
systemctl restart flyera-backend 2>/dev/null || systemctl restart water-backend 2>/dev/null || true
systemctl restart flyera-frontend 2>/dev/null || systemctl restart water-frontend 2>/dev/null || true
systemctl restart uvicorn 2>/dev/null || true
systemctl restart nginx 2>/dev/null || true

# If running directly under supervisor or screen/tmux or custom service
pkill -f "uvicorn main:app" || true
pkill -f "next start" || true

# Check if services need starting
sleep 2
if ! pgrep -f "uvicorn" > /dev/null; then
    echo "==> Starting backend with nohup..."
    cd "$REPO_DIR/backend"
    nohup ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 > /var/log/flyera-backend.log 2>&1 &
fi

if ! pgrep -f "next start" > /dev/null; then
    echo "==> Starting frontend with nohup..."
    cd "$REPO_DIR/frontend"
    nohup npm run start -- -p 3000 > /var/log/flyera-frontend.log 2>&1 &
fi

echo "=========================================="
echo " UPDATE COMPLETE!                         "
echo " All latest features are now live!        "
echo "=========================================="
