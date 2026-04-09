# Server Setup Documentation (setup.md)

## 📌 Overview
This document outlines the current state of the server setup, including completed configurations, installed components, and planned future improvements.

---

## 🖥️ Hardware & Network
- Platform: **Dell OptiPlex 3046** (X99-based starter build noted earlier)
- Storage: NVMe (clean wiped and configured)
- Network: PLDT static IP
- Router: Stock PLDT router (port forwarding used)

---

## 🧱 Base System Installation
- Installed Ubuntu Server LTS
- Disk fully wiped and repartitioned (GPT)
- UEFI boot configured
- OpenSSH installed during setup

---

## 🔐 SSH Configuration
- SSH access verified (LAN)
- Key-based authentication configured (ed25519)
- Password authentication disabled
- Root login disabled

---

## 🔥 Firewall Setup
- UFW installed and enabled
- Default rules:
  - Deny incoming
  - Allow outgoing
- Allowed ports:
  - 22 (SSH)
  - 80 (HTTP)
  - 443 (HTTPS)

---

## 🛡️ Security Tools
- Fail2Ban installed and running
- Basic brute-force protection enabled

---

## 📦 System Packages
Installed:
- curl
- git
- unzip

System fully updated and upgraded

---

## 🐳 Docker Setup
- Docker installed
- Docker Compose installed
- User added to docker group
- Verified using:
  ```bash
  docker run hello-world
  ```

---

## 🌐 Reverse Proxy (Nginx)
- Nginx running inside Docker container
- Exposed ports:
  - 80
  - 443
- Custom configuration directory mounted

### Example Configuration
```nginx
server {
    listen 80;
    server_name _;

    location / {
        return 200 "Server is working";
    }
}
```

---

## 🧩 Docker Networking
- Created network:
  - web
- Nginx connected to web network

Architecture:

Internet → Router → Nginx → Containers

---

## 🌍 Router Configuration
- Port forwarding configured:
  - 80 → server
  - 443 → server
- Disabled:
  - UPnP
  - DMZ
  - Remote admin (recommended)

---

## ✅ Current Status
- Ubuntu server fully operational
- SSH secured and working
- Firewall active
- Docker functioning
- Nginx reverse proxy running
- Ready to host applications

---

## 🚀 Next Steps (Recommended)

### 🔒 Security Enhancements
- Restrict SSH access to specific IP
- Set up VPN (WireGuard)
- Add rate limiting in Nginx
- Add security headers in Nginx

### 🌐 HTTPS Setup
- Install Let's Encrypt (Certbot or automation)
- Configure SSL for all domains

### 🧩 Application Deployment
- Create Docker Compose files for apps
- Separate services:
  - frontend
  - backend
  - database
- Ensure databases are internal-only

### 🌍 Domain & DNS
- Purchase or configure domain
- Point DNS to static IP
- Configure Nginx server_name per service

### 📊 Monitoring & Logging
- Set up logging (Docker logs, Nginx logs)
- Add monitoring (Prometheus + Grafana)

### 💾 Backup Strategy
- Backup Docker volumes
- Backup configuration files
- Store backups offsite

### 🏗️ Future Expansion
- Add additional servers
- Use VPN for inter-server communication
- Centralize reverse proxy
- Consider container orchestration (Docker Swarm / Kubernetes)

---

## 🧠 Notes & Best Practices
- Only expose ports 80/443 publicly
- Do not expose databases
- Use Docker networks for isolation
- Keep system updated regularly
- Use environment variables for secrets

---

## 🧾 Commands Executed (Walkthrough Log)

### Disk & Installation (shell / live environment)
```bash
lsblk
wipefs -a /dev/sda
dd if=/dev/zero of=/dev/sda bs=1M count=200
parted /dev/sda --script mklabel gpt
parted /dev/sda --script mkpart ESP fat32 1MiB 513MiB
parted /dev/sda --script set 1 esp on
parted /dev/sda --script mkpart primary ext4 513MiB 100%
mkfs.fat -F32 /dev/sda1
mkfs.ext4 /dev/sda2
mount /dev/sda2 /mnt
mkdir -p /mnt/boot/efi
mount /dev/sda1 /mnt/boot/efi
```

### System Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install curl git unzip -y
```

### SSH Setup
```bash
ssh-keygen -t ed25519
ssh-copy-id username@SERVER_IP
sudo nano /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Firewall
```bash
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Fail2Ban
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Docker Setup
```bash
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker
sudo usermod -aG docker $USER
newgrp docker
docker run hello-world
```

### Docker Networking & Nginx
```bash
docker network create web
mkdir -p ~/server/nginx
cd ~/server
nano docker-compose.yml
mkdir -p nginx/conf.d
nano nginx/conf.d/default.conf
docker compose up -d
```

---

## 📌 Summary
The server is now in a solid baseline state with:
- Secure access
- Containerized architecture
- Reverse proxy in place

It is ready for application deployment and scaling.

