/**
 * PM2 Ecosystem Configuration
 * Para despliegue en producción
 */
module.exports = {
  apps: [{
    name: 'invleo-api',
    script: 'src/server.js',
    instances: 'max', // Usar todas las CPUs disponibles
    exec_mode: 'cluster', // Modo cluster para mejor rendimiento
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 80
    },
    
    // Configuración de memoria
    max_memory_restart: '1G', // Reiniciar si excede 1GB
    
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
    listen_timeout: 3000,
    shutdown_with_message: true,
  }]
}