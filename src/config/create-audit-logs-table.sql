-- Script para crear la tabla de auditoría
-- Ejecutar en la base de datos PostgreSQL

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    changes JSONB,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
    ON audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
    ON audit_logs(tenant_id, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
    ON audit_logs(user_id, created_at DESC);

-- Habilitar extensión UUID si no está habilitada
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

COMMENT ON TABLE audit_logs IS 'Tabla de auditoría para rastrear todos los cambios en el sistema';
COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo de entidad: Product, User, Customer, etc.';
COMMENT ON COLUMN audit_logs.action IS 'Acción: create, update, delete, login, logout, price_change, cost_change';
COMMENT ON COLUMN audit_logs.changes IS 'JSON con los valores old y new';

