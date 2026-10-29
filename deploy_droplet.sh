#!/usr/bin/env bash
set -e

echo "=========================================="
echo " FLYERA PRODUCTION DEPLOYMENT (Ubuntu)   "
echo " Target: DigitalOcean 64.227.171.31      "
echo "=========================================="

# 1. Setup 2GB Swap Memory (Crucial for 512MB RAM Droplet)
if [ ! -f /swapfile ]; then
    echo "==> Configuring 2GB Swap File for memory stability..."
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "==> Swap created successfully:"
    free -h
else
    echo "==> Swapfile already active:"
    free -h
fi

# 2. System updates & install essentials
echo "==> Installing system packages (Python, Nginx, Git, Curl)..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-pip python3-venv git curl nginx ufw certbot python3-certbot-nginx

# 3. Install Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "==> Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "==> Node: $(node -v), NPM: $(npm -v)"

# 4. Install PM2 process manager
npm install -g pm2

APP_DIR="/var/www/flyera"
REPO_URL="https://github.com/Intasolutions/Flyera_Water_SupplyManagement.git"

# 5. Clone or update repository
if [ -d "$APP_DIR/.git" ]; then
    echo "==> Updating repository in $APP_DIR..."
    cd "$APP_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo "==> Cloning repository to $APP_DIR..."
    mkdir -p /var/www
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 6. Setup Backend
echo "==> Setting up Python virtual environment..."
cd "$APP_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Run migrations/table creation
./venv/bin/python -c "from main import app; print('Backend verified!')"

# 7. Setup Frontend
echo "==> Installing frontend dependencies & building Next.js..."
cd "$APP_DIR/frontend"
export NODE_OPTIONS="--max-old-space-size=1536"
npm install
npm run build

# 8. PM2 Process Configuration
echo "==> Configuring PM2 services..."
cd "$APP_DIR"

cat << 'EOF' > ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "flyera-backend",
      cwd: "/var/www/flyera/backend",
      script: "venv/bin/python",
      args: "-m uvicorn main:app --host 127.0.0.1 --port 8000",
      env: {
        NODE_ENV: "production",
        PYTHONUNBUFFERED: "1"
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "flyera-frontend",
      cwd: "/var/www/flyera/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        BACKEND_URL: "http://127.0.0.1:8000"
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root || true

# 9. Configure Nginx Reverse Proxy
echo "==> Configuring Nginx Reverse Proxy..."
cat << 'EOF' > /etc/nginx/sites-available/flyera
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend Next.js proxy
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/flyera /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 10. Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable || true

echo "=========================================="
echo " DEPLOYMENT COMPLETE!                     "
echo " Live at: http://64.227.171.31           "
echo "=========================================="
