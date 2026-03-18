-- Migración para crear la tabla de modelos de IA y poblarla con datos iniciales.

CREATE TABLE `ai_models` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pricing_input` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pricing_output` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar los modelos de IA iniciales
INSERT INTO `ai_models` (`id`, `name`, `pricing_input`, `pricing_output`, `status`) VALUES
('gemini-1.5-flash-latest', 'Gemini 1.5 Flash', '$0.35 / 1M tokens', '$0.70 / 1M tokens', 'active'),
('gemini-1.5-pro-latest', 'Gemini 1.5 Pro', '$3.50 / 1M tokens', '$10.50 / 1M tokens', 'active'),
('gemini-2.0-flash', 'Gemini 2.0 Flash', '$0.50 / 1M tokens', '$1.00 / 1M tokens', 'active');

-- Asegurarse de que exista una configuración predeterminada en app_settings
INSERT INTO `app_settings` (`key`, `value`)
VALUES ('aiModel', 'gemini-1.5-flash-latest')
ON DUPLICATE KEY UPDATE `value` = IF(`value` IS NULL OR `value` = '', 'gemini-1.5-flash-latest', `value`);

