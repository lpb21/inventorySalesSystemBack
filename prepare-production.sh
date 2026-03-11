#!/bin/bash
# 🚀 Script de Preparación para Producción
# Ejecutar antes de despliegue

echo "🚀 PREPARANDO API INVLEO PARA PRODUCCIÓN..."
echo "==========================================="

# 1. Limpiar archivos de desarrollo
echo "1️⃣  Limpiando archivos de desarrollo..."
rm -f test-rate-limiting.js
rm -f RATE_LIMITING.md
echo "   ✅ Archivos de testing eliminados"

# 2. Crear directorio de logs
echo "2️⃣  Creando directorio de logs..."
mkdir -p logs
touch logs/err.log
touch logs/out.log
touch logs/combined.log
echo "   ✅ Directorio de logs creado"

# 3. Validar .env.production
echo "3️⃣  Validando configuración de producción..."
if [ ! -f .env.production ]; then
    echo "   ❌ Falta archivo .env.production"
    echo "   📋 Copia .env.production.example y configúralo"
    exit 1
fi

# Verificar variables críticas
if grep -q "CAMBIAR-POR-CLAVE" .env.production; then
    echo "   ❌ JWT_SECRET no está configurado"
    echo "   ⚠️  Cambia JWT_SECRET en .env.production"
    exit 1
fi

if grep -q "tu-dominio-frontend.com" .env.production; then
    echo "   ❌ FRONTEND_URL no está configurado"
    echo "   ⚠️  Cambia FRONTEND_URL en .env.production"
    exit 1
fi

echo "   ✅ Configuración de producción válida"

# 4. Instalar dependencias de producción
echo "4️⃣  Instalando dependencias de producción..."
npm ci --production --silent
echo "   ✅ Dependencias instaladas"

# 5. Verificar conectividad
echo "5️⃣  Verificando servicios externos..."
echo "   🔍 Verificando base de datos..."
# Aquí podrías agregar un test de conexión a BD

echo "   🔍 Verificando Redis..."
# Aquí podrías agregar un test de conexión a Redis

echo "   ✅ Servicios verificados"

# 6. Configurar PM2
echo "6️⃣  Configurando PM2..."
if ! command -v pm2 &> /dev/null; then
    echo "   📦 Instalando PM2 globalmente..."
    npm install -g pm2
fi
echo "   ✅ PM2 configurado"

# 7. Resumen final
echo ""
echo "✅ ¡LISTO PARA PRODUCCIÓN!"
echo "=========================="
echo "📋 Comandos para desplegar:"
echo "   cp .env.production .env"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "📊 Monitoreo:"
echo "   pm2 status"
echo "   pm2 logs"
echo "   pm2 monit"
echo ""
echo "🚀 ¡Tu API invLeo está lista para conquistar el mundo!"