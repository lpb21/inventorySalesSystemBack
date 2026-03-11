# 🚀 DEPLOYMENT RAILWAY - SÚPER SIMPLE

## ⚡ **5 MINUTOS TOTAL**

### **1. Configurar Railway (2 min)**
```bash
# 1. Ir a railway.app
# 2. Login con GitHub
# 3. "New Project" → "Deploy from GitHub repo"
# 4. Seleccionar tu repo sisInventariosBACK
```

### **2. Variables de Entorno (1 min)**
```bash
# En el panel de Railway, agregar:
NODE_ENV=production
JWT_SECRET=tu-clave-super-secreta-diferente
FRONTEND_URL=https://tu-dominio-frontend.railway.app
PORT=3000

# Las otras variables se toman automáticamente del .env
```

### **3. Deploy Automático (2 min)**
```bash
# Railway hace todo automáticamente:
✅ npm install
✅ npm run start  
✅ SSL Certificate
✅ HTTPS Domain: https://tu-app-random.railway.app
✅ Logs en tiempo real
✅ Auto-scaling
```

## 💸 **COSTO RAILWAY**
- **$5/mes** - Para empezar
- **$20/mes** - Para crecimiento  
- **0 configuración de servidor**
- **0 mantenimiento**

## 📊 **VENTAJAS**
✅ Deploy en 5 minutos  
✅ SSL automático  
✅ Dominio incluido  
✅ Logs en tiempo real  
✅ Auto-restart si falla  
✅ GitHub integration  
✅ Escalabilidad automática  

## 🔄 **MIGRAR A EC2 DESPUÉS**
Si creces mucho, puedes migrar a EC2:
- Mismo código
- Misma estructura  
- Solo cambias hosting
- Sin reescribir nada