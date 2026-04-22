# Propuestas de Mejora - AcademiCS

Este documento resume las oportunidades de mejora identificadas para el proyecto AcademiCS, manteniendo la arquitectura actual de React + PHP Vanilla.

## 1. Arquitectura y Backend (PHP)

*   **Refactorización de Archivos Extensos:** Extraer la lógica de negocio de `index.php` y de los archivos de rutas hacia clases de servicio o helpers (ej. `src/Services/AiService.php`). Esto mejorará la mantenibilidad sin cambiar el sistema de ruteo.
*   **Validación de Datos:** Implementar un sistema de validación centralizado para las peticiones API, asegurando que los datos que llegan al backend cumplan con el esquema esperado antes de procesarlos.
*   **Manejo de Errores Global:** Crear un manejador de excepciones que registre errores detallados en una tabla de base de datos (`error_logs`) para facilitar el debugging en producción.
*   **Seguridad:** Añadir protección CSRF para operaciones que mutan datos y asegurar que todas las entradas se limpien correctamente para prevenir inyecciones.

## 2. Frontend (React)

*   **Gestión de Estado con TanStack Query:** Reemplazar el uso manual de `useEffect` y `fetch` por TanStack Query. Esto permitiría un manejo superior de la caché, reintentos automáticos y estados de carga globales.
*   **Actualizaciones en Tiempo Real:** Implementar Server-Sent Events (SSE) para informar al usuario sobre el progreso de tareas largas (como la transcripción de IA) en lugar de usar polling manual.
*   **Accesibilidad (a11y):** Asegurar que todos los componentes de la interfaz cumplan con los estándares WCAG, incluyendo etiquetas ARIA adecuadas y navegación completa por teclado.

## 3. IA e Integración

*   **Caché de Resultados de IA:** Implementar una capa de caché en la base de datos para almacenar respuestas de OpenAI basadas en el hash del archivo y el prompt. Esto reduciría costos significativamente al evitar regenerar el mismo contenido.
*   **Prompt Engineering Dinámico:** Separar los prompts del código (ya iniciado con `app_settings`) y permitir versiones de prueba (A/B testing) para evaluar qué instrucciones generan mejores resultados educativos.

## 4. Base de Datos

*   **Soft Deletes:** Implementar una columna `deleted_at` en todas las entidades principales para permitir la recuperación de datos borrados accidentalmente.
*   **Sistema de Migraciones:** Adoptar una herramienta sencilla de migraciones para mantener el esquema de base de datos sincronizado entre entornos (Local, Staging, Producción).

## 5. Reportes y Métricas (Nueva Propuesta)

*   **Reportes de Efectividad:** Medir la tasa de aprobación por módulo para identificar contenidos que puedan ser demasiado difíciles o confusos.
*   **Dashboard Gerencial:** Visualizaciones de métricas clave como:
    *   Tasa de finalización de cursos.
    *   Promedio de calificaciones.
    *   Tiempo promedio de estudio por estudiante.
    *   Costo de IA por curso generado vs. uso real.
