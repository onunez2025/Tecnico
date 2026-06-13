# Liquidaciones - MT Industrial

Aplicación operativa diseñada exclusivamente para la **liquidación y registro de pagos**. Integrada con el ecosistema **SAP FSM** y compartiendo infraestructura de seguridad con **EBM** y **Gestor de Tickets FSM**.

## 🚀 Módulos Principales

- **Analítica de Liquidaciones (Dashboard):** Visualización en tiempo real de los pagos procesados, estados de liquidación y KPI's de recaudación.
- **Registro y Validación de Pagos:** Gestión, validación y trazabilidad de transacciones POS, transferencias y vouchers recaudados en campo.
- **Seguridad Centralizada:** Gestión de usuarios y roles compartida con el esquema `EBM`.

## 🛠️ Tecnologías

- **Frontend:** React + Vite + TypeScript.
- **Styling:** Tailwind CSS 4 (Sistema de diseño premium MT).
- **Backend:** Express + Node.js (Servidor `.ts`).
- **Base de Datos:** Azure SQL (Esquema `dbo` para operación, `EBM` para seguridad).
- **Auth:** JWT + Bcrypt.

## ⚙️ Configuración

1. Crear un archivo `.env` basado en la configuración de Azure SQL.
2. Ejecutar `npm install`.
3. Iniciar en desarrollo:
   - Frontend: `npm run dev`
   - Servidor: `npm run server`

## 🔒 Seguridad (Esquema EBM)

Para que un usuario tenga acceso a esta aplicación, debe figurar `Liq` en la columna `Apps` de la tabla `EBM.Users`. Los permisos específicos se gestionan a través del módulo de Roles dentro de la aplicación.

---
© 2026 MT Industrial S.A.C - Advanced Agentic Coding

# Last Build: 2026-03-31 16:32:58
