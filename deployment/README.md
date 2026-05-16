# Edcheck — Production Deployment Guide

**Stack:** Node.js + Express · PM2 · Nginx · Let's Encrypt · GCE Debian 12  
**Domain:** edcheck.pinmypic.online  
**Frontend:** Vercel  
**Backend VM:** Google Compute Engine (Debian 12)

---

## 1. DNS Setup

Point your domain's **A record** to your GCE VM's external IP.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `edcheck.pinmypic.online` | `<YOUR_VM_EXTERNAL_IP>` | 300 |

Find your VM's external IP:
```
GCP Console → Compute Engine → VM instances → External IP
```
Or via CLI:
```bash
gcloud compute instances describe YOUR_VM_NAME \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

> DNS propagation takes 5–30 minutes. Verify with:
> ```bash
> dig edcheck.pinmypic.online +short
> ```

---

## 2. First-Time Server Setup

SSH into your VM, then clone the repo and run the setup script.

```bash
# SSH into VM
gcloud compute ssh YOUR_VM_NAME --zone=asia-south1-a

# Clone repo (first time only)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /home/$USER/edcheck
cd /home/$USER/edcheck

# Install Node.js 20 (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install backend dependencies
cd backend && npm install --omit=dev && cd ..

# Copy your .env file to the backend
cp .env.example backend/.env
# Edit backend/.env with your real values:
nano backend/.env

# Make scripts executable
chmod +x deployment/setup-ssl.sh
chmod +x deployment/deploy.sh

# Create logs directory for PM2
mkdir -p logs

# Run the SSL + nginx setup (requires sudo)
sudo ./deployment/setup-ssl.sh
```

> **Edit `deployment/setup-ssl.sh` first** — change the `EMAIL` variable to your real email address before running.

---

## 3. Start the Backend with PM2

```bash
# Start using ecosystem config (production mode)
pm2 start ecosystem.config.js --env production

# Save process list so PM2 restarts on VM reboot
pm2 save

# Enable PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (starts with: sudo env PATH=...)
```

---

## 4. Deploy Updates

Every time you push new code, SSH into the VM and run:

```bash
cd /home/$USER/edcheck
./deployment/deploy.sh
```

This will:
- Pull latest code from git
- Install any new dependencies
- Reload PM2 with zero downtime
- Verify the health endpoint

---

## 5. SSL Certificate Renewal

Certificates auto-renew via the certbot systemd timer. To check:

```bash
# Check renewal timer status
sudo systemctl status certbot.timer

# Test renewal without actually renewing
sudo certbot renew --dry-run

# Force renew immediately (if needed)
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

Certificates expire every 90 days. Certbot renews them automatically when they are within 30 days of expiry.

---

## 6. Debug Nginx

```bash
# Check nginx status
sudo systemctl status nginx

# Test nginx config for syntax errors
sudo nginx -t

# Reload nginx after config changes (no downtime)
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View nginx access logs
sudo tail -f /var/log/nginx/access.log

# View nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 7. Debug PM2

```bash
# List all PM2 processes
pm2 list

# View live logs
pm2 logs edcheck-backend

# View last 200 log lines
pm2 logs edcheck-backend --lines 200

# Detailed process info
pm2 describe edcheck-backend

# Live monitoring dashboard
pm2 monit

# Restart the process
pm2 restart edcheck-backend

# Reload with zero downtime
pm2 reload edcheck-backend --update-env

# View PM2 error log file directly
cat logs/pm2-error.log
```

---

## 8. Environment Variables

Backend environment variables live in `backend/.env`.  
After editing `.env`, reload PM2:

```bash
pm2 reload edcheck-backend --update-env
```

Required variables (see `backend/.env.example`):
```
MONGO_URL=
JWT_SECRET=
PORT=5001
GROQ_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 9. GCE Firewall Rules

Make sure ports 80 and 443 are open in GCP:

```bash
# Allow HTTP
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 --target-tags http-server

# Allow HTTPS
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 --target-tags https-server
```

Or in GCP Console: **VPC Network → Firewall → Create Firewall Rule**

---

## 10. File Structure

```
Edcheck/
├── backend/                  # Express API
│   ├── index.js              # Entry point (PORT 5001)
│   └── .env                  # Environment variables (not in git)
├── frontend/                 # React app (deployed to Vercel)
├── deployment/
│   ├── nginx/
│   │   └── default.conf      # Nginx reverse proxy config
│   ├── setup-ssl.sh          # One-time SSL + nginx setup
│   ├── deploy.sh             # Deploy updates script
│   └── README.md             # This file
├── ecosystem.config.js       # PM2 process config
└── logs/                     # PM2 log output
    ├── pm2-out.log
    └── pm2-error.log
```
