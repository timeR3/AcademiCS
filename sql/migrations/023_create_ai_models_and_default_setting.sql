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
('gpt-4o-mini', 'OpenAI GPT-4o Mini', '$0.15 / 1M tokens', '$0.60 / 1M tokens', 'active'),
('gpt-4o', 'OpenAI GPT-4o', '$2.50 / 1M tokens', '$10.00 / 1M tokens', 'active'),
('gpt-4.1-mini', 'OpenAI GPT-4.1 Mini', '$0.40 / 1M tokens', '$1.60 / 1M tokens', 'active');

-- Asegurarse de que exista una configuración predeterminada en app_settings
INSERT INTO `app_settings` (`key`, `value`)
VALUES ('aiModel', 'gpt-4o-mini')
ON DUPLICATE KEY UPDATE `value` = IF(`value` IS NULL OR `value` = '', 'gpt-4o-mini', `value`);
