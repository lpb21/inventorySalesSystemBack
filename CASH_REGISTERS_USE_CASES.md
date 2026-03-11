# 💰 CASOS DE USO PARA CASH_REGISTERS

## 🎯 **FUNCIONALIDADES A IMPLEMENTAR:**

### **1️⃣ GESTIÓN DE TURNOS**
- **Abrir turno:** Registrar dinero inicial y cajero responsable
- **Cerrar turno:** Realizar cuadre de caja y calcular diferencias
- **Turnos múltiples:** Soporte para varios cajeros simultáneos

### **2️⃣ CONTROL DE VENTAS POR CAJA**
- Asociar cada venta a una caja específica
- Cálculo automático del dinero esperado
- Seguimiento en tiempo real del efectivo

### **3️⃣ AUDITORÍA Y REPORTES**
- Histórico completo de todos los turnos
- Análisis de diferencias (faltantes/sobrantes)
- Reportes por cajero y período

---

## 📊 **ENDPOINTS RECOMENDADOS:**

### **GESTIÓN DE TURNOS:**
```bash
POST   /v1/cash-registers/open           # Abrir turno
POST   /v1/cash-registers/:id/close      # Cerrar turno
GET    /v1/cash-registers/active         # Turnos abiertos
GET    /v1/cash-registers/:id            # Detalle de turno
```

### **REPORTES:**
```bash
GET    /v1/cash-registers                # Histórico de turnos
GET    /v1/cash-registers/:id/sales      # Ventas del turno
GET    /v1/cash-registers/reports        # Reportes de cuadre
```

---

## 💼 **CASOS DE USO ESPECÍFICOS PARA SALSAMENTARÍAS:**

### **🌅 TURNO MAÑANA (6:00 - 14:00)**
- Cajero: María González
- Dinero inicial: $100,000
- Ventas típicas: Desayunos, embutidos para almuerzo
- Cliente objetivo: Trabajadores, amas de casa

### **🌆 TURNO TARDE (14:00 - 22:00)** 
- Cajero: Carlos Pérez
- Dinero inicial: $80,000
- Ventas típicas: Meriendas, cenas rápidas
- Cliente objetivo: Estudiantes, familias

### **🏪 MÚLTIPLES CAJAS**
- Caja 1: Productos frescos (carnes, quesos)
- Caja 2: Productos secos y envasados
- Control independiente por especialización

---

## 🔍 **CAMPOS ESPECÍFICOS Y SU USO:**

### **APERTURA (`opening_amount`):**
- **Uso:** Dinero base para dar cambio
- **Ejemplo:** $50,000 en billetes pequeños
- **Validación:** Debe ser verificado físicamente

### **CIERRE (`closing_amount`):**
- **Uso:** Dinero real contado al final
- **Proceso:** Contar físicamente todo el efectivo
- **Comparison:** vs `expected_amount` para detectar diferencias

### **ESPERADO (`expected_amount`):**
- **Cálculo:** `opening_amount + ventas_efectivo - gastos`
- **Automático:** Se actualiza con cada transacción
- **Crítico:** Para detectar faltantes/sobrantes

### **EN CAJA (`cash_in_drawer`):**
- **Tiempo Real:** Se actualiza automáticamente
- **Útil para:** Saber cuánto hay sin contar físicamente
- **Incluye:** Efectivo inicial + ventas efectivo

---

## 🚨 **ALERTAS Y VALIDACIONES:**

### **⚠️ DIFERENCIAS CRÍTICAS:**
```javascript
if (Math.abs(closing_amount - expected_amount) > 10000) {
  alert("DIFERENCIA CRÍTICA: Revisar inmediatamente");
}
```

### **📊 REPORTES DIARIOS:**
- Resumen de todos los turnos del día
- Total de diferencias por cajero
- Análisis de horarios problemáticos

### **🔒 CONTROLES DE SEGURIDAD:**
- Solo el cajero asignado puede cerrar su turno
- Histórico inmutable de todas las operaciones
- Auditoría completa de cambios

---

## 💡 **EXTENSIONES FUTURAS:**

### **📱 INTEGRACIÓN CON VENTAS:**
- Modificar `Sale.js` para incluir `cash_register_id` obligatorio
- Validar que solo se pueda vender con turno abierto
- Calcular automáticamente dinero esperado

### **💸 GASTOS DE CAJA:**
- Tabla adicional `CashMovements` para gastos menores
- Control de dinero que sale de caja
- Ajustes al dinero esperado

### **📈 ANÁLISIS AVANZADO:**
- Patrones de venta por horario
- Rendimiento por cajero
- Optimización de dinero inicial por turno

---

## 🎯 **PRÓXIMO PASO RECOMENDADO:**

**Implementar primero lo básico:**
1. ✅ Endpoint para abrir turno
2. ✅ Asociar ventas a caja activa
3. ✅ Endpoint para cerrar turno con cuadre
4. ✅ Reporte simple de diferencias

**Después expandir:**
- 📊 Reportes avanzados
- 💸 Control de gastos menores  
- 📱 Dashboard en tiempo real
- 🔔 Alertas automáticas

¿Te gustaría que implemente alguno de estos endpoints específicos?