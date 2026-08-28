# 🎯 GUÍA RÁPIDA DE DESPLIEGUE

## ⚡ **PASOS CRÍTICOS (5 minutos)**

### **1️⃣ CONFIGURAR .env DE PRODUCCIÓN**
```bash
# Editar .env.production con tus valores reales:
JWT_SECRET=tu-clave-super-secreta-256-bits
FRONTEND_URL=https://tu-dominio-real.com
NODE_ENV=production
PORT=80
```

### **2️⃣ LIMPIAR PARA PRODUCCIÓN**
```bash
# Eliminar archivos de desarrollo
del test-rate-limiting.js
del RATE_LIMITING.md

# Crear en producción
cp .env.production .env
```

### **3️⃣ DESPLIEGUE SEGÚN PLATAFORMA**

#### **🚀 VPS/Servidor (PM2):**
```bash
npm install -g pm2
npm run deploy:start
npm run deploy:status
```

#### **☁️ Railway/Heroku:**
```bash
# Solo configurar variables de entorno:
NODE_ENV=production
JWT_SECRET=tu-clave-secreta
FRONTEND_URL=https://tu-dominio.com
```

#### **🐳 Docker:**
```bash
docker build -t invleo-api .
docker run -p 80:3000 --env-file .env.production invleo-api
```

### **4️⃣ VERIFICAR DESPLIEGUE**
```bash
curl https://tu-api.com/health
# Respuesta: {"status":"ok","timestamp":"..."}
```

## 🚫 **COSAS QUE NO VAN A PRODUCCIÓN**

❌ `test-rate-limiting.js`  
❌ `RATE_LIMITING.md`  
❌ `console.log` de debugging  
❌ `NODE_ENV=development`  
❌ `JWT_SECRET=default`  
❌ `FRONTEND_URL=localhost:5173`  

## ✅ **COSAS QUE SÍ VAN A PRODUCCIÓN**

✅ Rate limiting (configurado)  
✅ Multi-tenant system  
✅ JWT Authentication  
✅ Redis Cache (Upstash)  
✅ PostgreSQL (Supabase)  
✅ Helmet security  
✅ CORS configurado  

## 🔧 **CONFIGURACIONES AUTOMÁTICAS**

Tu app ya tiene configurado:
- ✅ Logging para producción
- ✅ Rate limits apropiados  
- ✅ CORS específico
- ✅ Variables de entorno
- ✅ Cache optimizado

**¡Solo cambiar .env y desplegar!** 🚀