#!/bin/bash

# ECOM Task Force - Deploy Script for Digital Ocean
# This script sets up the application on a Digital Ocean droplet

set -e

echo "🚀 ECOM Task Force - Digital Ocean Deploy"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ecom-task-force"
DOMAIN="${DOMAIN:-your-domain.com}"
EMAIL="${EMAIL:-admin@your-domain.com}"

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install Docker Compose
echo -e "${YELLOW}🔧 Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Install Nginx (for reverse proxy)
echo -e "${YELLOW}🌐 Installing Nginx...${NC}"
sudo apt install nginx -y

# Install Certbot for SSL
echo -e "${YELLOW}🔒 Installing Certbot for SSL...${NC}"
sudo apt install certbot python3-certbot-nginx -y

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
sudo mkdir -p /opt/$APP_NAME
sudo chown $USER:$USER /opt/$APP_NAME

# Copy application files
echo -e "${YELLOW}📋 Copying application files...${NC}"
cp -r . /opt/$APP_NAME/
cd /opt/$APP_NAME

# Create necessary directories
mkdir -p data logs ssl

# Set up environment variables
echo -e "${YELLOW}⚙️ Setting up environment variables...${NC}"
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=file:./prisma/atlas.db
PORT=4000
WEB_PORT=3000
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF

# Create systemd service
echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=ECOM Task Force
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/$APP_NAME
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Start application
echo -e "${YELLOW}🚀 Starting application...${NC}"
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl start $APP_NAME

# Wait for application to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 30

# Get SSL certificate
if [ "$DOMAIN" != "your-domain.com" ]; then
    echo -e "${YELLOW}🔒 Getting SSL certificate...${NC}"
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL
fi

# Show status
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${GREEN}🌐 Application URL: http://$DOMAIN${NC}"
echo -e "${GREEN}📊 API URL: http://$DOMAIN/api${NC}"
echo -e "${GREEN}🔧 Service status: sudo systemctl status $APP_NAME${NC}"
echo -e "${GREEN}📋 Logs: sudo journalctl -u $APP_NAME -f${NC}"

echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Configure your domain DNS to point to this server"
echo "2. Add proxy servers to /opt/$APP_NAME/ip-rotator/proxy-list.txt"
echo "3. Monitor logs: sudo journalctl -u $APP_NAME -f"
echo "4. Check application: curl http://$DOMAIN/health"
