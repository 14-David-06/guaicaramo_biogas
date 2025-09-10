# Sistema de Persistencia de Sesión - Plataforma Biogás

## 📋 Descripción

Se ha implementado un sistema completo de persistencia de sesión que permite a los usuarios mantener su sesión activa sin necesidad de iniciar sesión constantemente.

## 🔐 Características del Sistema de Autenticación

### ✅ **Persistencia de Sesión**
- **Duración**: Las sesiones duran 24 horas automáticamente
- **Almacenamiento**: Los datos se guardan en `localStorage` del navegador del usuario
- **Sincronización**: Si abres múltiples pestañas, todas se sincronizan automáticamente
- **Seguridad**: Incluye verificación de expiración y limpieza automática

### ✅ **Extensión Automática**
- La sesión se extiende automáticamente cada 30 minutos si el usuario está activo
- Notificación cuando la sesión está próxima a expirar (menos de 1 hora)
- Opción manual para extender la sesión

### ✅ **Gestión de Estado**
- Loading states mientras se verifica la sesión
- Redirección automática si no está autenticado
- Limpieza automática de sesiones expiradas

## 🛠️ Implementación Técnica

### **Hook Personalizado: `useAuth`**
Ubicación: `src/hooks/useAuth.tsx`

```typescript
const { user, isLoading, isAuthenticated, login, logout, extendSession } = useAuth();
```

**Funciones disponibles:**
- `login(user)`: Iniciar sesión y guardar en localStorage
- `logout()`: Cerrar sesión y limpiar datos
- `extendSession()`: Extender sesión manualmente
- `isSessionExpiringSoon()`: Verificar si expira pronto

### **Componente de Alerta: `SessionAlert`**
Ubicación: `src/components/SessionAlert.tsx`

- Muestra notificación automática cuando la sesión está por expirar
- Permite extender la sesión con un clic
- Se oculta automáticamente después de 10 segundos

## 📱 Uso en las Páginas

Todas las páginas principales han sido actualizadas para usar el sistema:

1. **Página Principal** (`/`)
2. **Abrir Turno** (`/abrir-turno`)
3. **Registro Jerbacher** (`/registro-jerbacher`)
4. **Bitácora Biogás** (`/bitacora-biogas`)

### **Protección de Rutas**
```typescript
// Verificación automática en cada página
if (isLoading) {
  return <LoadingScreen />;
}

if (!loggedInUser) {
  router.push('/');
  return null;
}
```

## 💾 Datos Almacenados

Los datos se guardan en `localStorage` con la clave `biogas_auth_session`:

```json
{
  "user": {
    "id": "123",
    "nombre": "Juan Pérez",
    "cargo": "Operador",
    "cedula": "12345678"
  },
  "timestamp": 1703123456789,
  "expiresAt": 1703209856789
}
```

## 🔄 Flujo de Autenticación

1. **Login**: Usuario ingresa credenciales → Se valida → Se guarda sesión
2. **Navegación**: Cada página verifica automáticamente la sesión
3. **Extensión**: Sistema extiende automáticamente cada 30 min si hay actividad
4. **Alerta**: Notifica 1 hora antes de expirar
5. **Logout**: Limpia todos los datos almacenados

## ⚡ Beneficios

### **Para los Usuarios:**
- ✅ No necesitan iniciar sesión constantemente
- ✅ Pueden cerrar y reabrir el navegador manteniendo la sesión
- ✅ Reciben avisos antes de perder la sesión
- ✅ Experiencia fluida entre páginas

### **Para el Sistema:**
- ✅ Mejor UX y reducción de fricciones
- ✅ Sincronización entre pestañas
- ✅ Seguridad con expiración automática
- ✅ Fácil integración con backend futuro

## 🚀 Próximos Pasos

1. **Integración con Backend**: Conectar con API real de autenticación
2. **Tokens JWT**: Implementar refresh tokens para mayor seguridad
3. **Roles y Permisos**: Extender para diferentes tipos de usuario
4. **Auditoría**: Log de inicios/cierres de sesión

## 📝 Notas de Desarrollo

- Los datos de usuario demo se eliminaron, ahora todo viene del sistema de auth
- Todas las páginas verifican automáticamente la autenticación
- El sistema es completamente reactivo y se actualiza en tiempo real
- Compatible con todas las funcionalidades existentes

---

**🎯 Resultado**: Los usuarios ahora pueden mantener su sesión activa durante 24 horas, con extensión automática y notificaciones inteligentes, mejorando significativamente la experiencia de uso de la plataforma.
