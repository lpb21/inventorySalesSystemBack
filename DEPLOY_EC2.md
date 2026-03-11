# 🚀 DEPLOYMENT AWS EC2 - CONTROL TOTAL

## ⚡ **SETUP COMPLETO (2-3 horas)**

### **1. Crear Instancia EC2 (15 min)**
```bash
# 1. AWS Console → EC2 → Launch Instance
# 2. Ubuntu Server 22.04 LTS
# 3. Instance type: t3.micro (Free tier) o t3.small
# 4. Create new key pair (guardar .pem file)
# 5. Security Group: Allow HTTP (80), HTTPS (443), SSH (22)
# 6. Storage: 20GB gp3
```

### **2. Conectar y Configurar Servidor (30 min)**
```bash
# Conectar via SSH
ssh -i "tu-key.pem" ubuntu@tu-ip-publica

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # v18.x.x
npm --version   # 9.x.x

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### **3. Subir y Configurar Aplicación (20 min)**
```bash
# Clonar tu repositorio
git clone https://github.com/tu-usuario/sisInventariosBACK.git
cd sisInventariosBACK

# Instalar dependencias
npm ci --production

# Configurar variables de entorno
cp .env.production .env
# Editar JWT_SECRET y FRONTEND_URL

# Crear directorios
mkdir -p logs uploads
sudo chown -R ubuntu:ubuntu logs uploads

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 startup  # Seguir instrucciones
pm2 save
```

### **4. Configurar Nginx (20 min)**
```bash
# Crear configuración Nginx
sudo nano /etc/nginx/sites-available/invleo-api

# Contenido del archivo:
server {
    listen 80;
    server_name tu-dominio.com;  # O IP pública
    
    location / {
        proxy_pass http://localhost:3000;
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

# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/invleo-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### **5. Configurar SSL con Let's Encrypt (15 min)**
```bash
# Instalar Certbot
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com

# Renovación automática
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 💸 **COSTOS EC2**
- **t3.micro**: $8.5/mes (750h free tier primer año)
- **t3.small**: $16.7/mes
- **Elastic IP**: $3.6/mes si no está en uso
- **Traffic**: Gratis hasta 1TB/mes
- **Domain**: $12/año (Route 53)

## 🛠️ **MANTENIMIENTO REQUERIDO**
⚠️ **Updates mensuales**:
```bash
sudo apt update && sudo apt upgrade -y
pm2 update
```

⚠️ **Monitoreo**:
```bash
pm2 status
pm2 logs
sudo systemctl status nginx
df -h  # Espacio en disco
```

⚠️ **Backups**:
```bash
# Código (automático con git)
# Logs si es necesario
```

## 📊 **COMANDOS DE ADMINISTRACIÓN**
```bash
# PM2 Management
pm2 status                    # Ver estado
pm2 logs invleo-api          # Ver logs
pm2 restart invleo-api       # Reiniciar app
pm2 reload invleo-api        # Reload sin downtime

# Nginx Management  
sudo systemctl status nginx  # Estado Nginx
sudo nginx -t               # Test configuración
sudo systemctl reload nginx # Reload config

# System Management
htop                        # Monitor recursos
df -h                      # Espacio disco
free -h                    # Memoria RAM
```

## ✅ **VENTAJAS EC2**
✅ Control total del servidor  
✅ Escalabilidad manual/automática  
✅ Integración AWS ecosystem  
✅ Precio bajo para tráfico alto  
✅ Profesional para enterprise  

## ❌ **DESVENTAJAS EC2**  
❌ Setup complejo (2-3 horas)  
❌ Mantenimiento manual  
❌ Responsabilidad seguridad  
❌ Configuración SSL manual  
❌ Monitoreo manual