# 🚀 DESPLIEGUE A PRODUCCIÓN - API invLeo

## 🎯 **PASOS CRÍTICOS ANTES DE PRODUCCIÓN**

### **1. 📄 ARCHIVO .env PARA PRODUCCIÓN**
Crea `.env.production` con estos valores:

```bash
# NUNCA usar valores de desarrollo en producción
NODE_ENV=production
PORT=80

# Base de datos (Supabase está OK)
DB_HOST=aws-0-us-west-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.nhqqzqsuvomvrhsfzntt
DB_PASSWORD=postgresLeo01*

# JWT - ¡CAMBIAR OBLIGATORIO!
JWT_SECRET=tu-clave-super-secreta-compleja-256-bits-minimo
JWT_EXPIRES_IN=24h

# CORS - URL Real del Frontend
FRONTEND_URL=https://tu-dominio-frontend.com

# Redis (Upstash está OK)
REDIS_URL=rediss://default:gQAAAAAAAQL3AAIncDEyMzk5N2M5NjJhYTM0ZjA2OWYwYTU3NmQ0ODNiNzJiN3AxNjYyOTU@daring-viper-66295.upstash.io:6379

DATABASE_URL=postgresql://postgres.nhqqzqsuvomvrhsfzntt:postgresLeo01*@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

### **2. ⚠️  CONFIGURACIONES A AJUSTAR**

#### **A. Rate Limiting más estricto**
```javascript
// En rateLimitMiddleware.js
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Reducir de 100 a 500 por ventana
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Reducir de 20 a 10 intentos
});
```

#### **B. Logging para producción**
```javascript
// En app.js - Cambiar logging
if (env.nodeEnv === 'production') {
  app.use(morgan('combined'));
  // Sin logs detallados de debugging
} else {
  app.use(morgan('dev'));
}
```

#### **C. CORS específico**
```javascript
// En app.js - CORS específico para tu dominio
app.use(cors({
  origin: env.frontendUrl, // Solo tu dominio, no '*'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
```

### **3. 🗑️  ELIMINAR/DESACTIVAR PARA PRODUCCIÓN**

#### **Código a remover:**
- ❌ `console.log` de debugging
- ❌ Endpoints de testing
- ❌ Archivos `test-*.js`
- ❌ Logs detallados de desarrollo

#### **Archivos innecesarios:**
```bash
del test-rate-limiting.js
del RATE_LIMITING.md
del README.md  # Si tiene info sensible
```

### **4. 📦 PREPARAR PARA DESPLIEGUE**

#### **A. Scripts de producción**
```json
{
  "scripts": {
    "start": "NODE_ENV=production node src/server.js",
    "start:pm2": "pm2 start ecosystem.config.js",
    "build": "echo 'API Ready for production'",
    "db:migrate": "node src/config/sync.js",
    "health": "curl http://localhost/health"
  }
}
```

#### **B. Archivo PM2 (ecosystem.config.js)**
```javascript
module.exports = {
  apps: [{
    name: 'invleo-api',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 80
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
  }]
}
```

### **5. 🌐 OPCIONES DE HOSTING**

#### **A. VPS/Servidor Dedicado:**
```bash
# 1. Subir código
git clone tu-repo
cd invleo-api

# 2. Instalar dependencias
npm ci --production

# 3. Variables de entorno
cp .env.production .env

# 4. PM2 global
npm install -g pm2

# 5. Iniciar
pm2 start ecosystem.config.js

# 6. Proxy reverso (Nginx)
# /etc/nginx/sites-available/invleo-api
server {
    listen 80;
    server_name api.tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### **B. Railway/Heroku/DigitalOcean:**
```bash
# Solo necesitas:
1. Configurar variables de entorno en el panel
2. Conectar GitHub repo
3. Deploy automático
```

#### **C. Docker (Opcional):**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
EXPOSE 80
CMD ["node", "src/server.js"]
```

### **6. 🔐 SEGURIDAD CRÍTICA**

#### **Variables de entorno OBLIGATORIAS a cambiar:**
```bash
JWT_SECRET=clave-de-256-bits-completamente-diferente-y-secreta
FRONTEND_URL=https://tu-dominio-real.com
NODE_ENV=production
```

#### **Headers de seguridad:**
```javascript
// Ya tienes helmet(), asegúrate que esté activo:
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  }
}));
```

### **7. ✅ CHECKLIST DE PRE-PRODUCCIÓN**

- [ ] JWT_SECRET cambiado
- [ ] FRONTEND_URL configurado
- [ ] NODE_ENV=production
- [ ] Rate limits ajustados
- [ ] Logs de debug removidos
- [ ] CORS específico configurado
- [ ] SSL/HTTPS configurado
- [ ] Base de datos Supabase funcionando
- [ ] Redis Upstash funcionando
- [ ] Backups de BD configurados

### **8. 🚀 COMANDO DE DESPLIEGUE**

```bash
# Local
NODE_ENV=production npm start

# Con PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Monitoreo
pm2 logs
pm2 monit
```

## ⚡ **RESUMEN: Lo que SÍ va a producción**

✅ **Mantener:**
- Rate limiting (ajustado)
- Sistema multi-tenant
- Autenticación JWT
- Cache Redis
- Base de datos Supabase
- Middleware de seguridad

❌ **Remover:**
- Logs de debugging
- Archivos de testing
- Variables de desarrollo
- Endpoints de prueba

¿Qué plataforma piensas usar para el despliegue?