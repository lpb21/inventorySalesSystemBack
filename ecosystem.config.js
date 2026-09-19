/**
 * PM2 Ecosystem Configuration
 * Para despliegue en producción
 */
module.exports = {
  apps: [{
    name: 'puntofresco-api',
    script: 'src/server.js',
    cwd: __dirname,
    instances: '1', // Usar solo 1 cpu disponible
    exec_mode: 'fork', // Modo fork
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    // Configuración de memoria
    max_memory_restart: '400M', // Reiniciar si excede 400MB de RAM
    
    // Logs
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true, // Timestamps en logs
    
    // Monitoreo
    monitoring: false, // Cambiar a true si usas PM2 Plus
    
    // Auto restart
    watch: false, // No watch en producción
    ignore_watch: ['node_modules', 'logs'],
    
    // Configuración adicional
    autorestart: true,
    max_restarts: 10,
    min_uptime: '60s',
    
    // Configuración avanzada
    kill_timeout: 5000,
    listen_timeout: 3000
  }]
}