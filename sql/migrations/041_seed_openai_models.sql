INSERT INTO `ai_models` (`id`, `name`, `pricing_input`, `pricing_output`, `status`) VALUES
('gpt-5.4', 'OpenAI GPT-5.4', '$2.50 / 1M tokens', '$15.00 / 1M tokens', 'active'),
('gpt-5.4-mini', 'OpenAI GPT-5.4 Mini', '$0.75 / 1M tokens', '$4.50 / 1M tokens', 'active'),
('gpt-5.4-nano', 'OpenAI GPT-5.4 Nano', '$0.20 / 1M tokens', '$1.25 / 1M tokens', 'active'),
('gpt-5.4-pro', 'OpenAI GPT-5.4 Pro', '$30.00 / 1M tokens', '$180.00 / 1M tokens', 'active'),
('gpt-4.1', 'OpenAI GPT-4.1', '$2.00 / 1M tokens', '$8.00 / 1M tokens', 'active'),
('gpt-4.1-mini', 'OpenAI GPT-4.1 Mini', '$0.40 / 1M tokens', '$1.60 / 1M tokens', 'active'),
('gpt-4.1-nano', 'OpenAI GPT-4.1 Nano', '$0.10 / 1M tokens', '$0.40 / 1M tokens', 'active'),
('gpt-4o', 'OpenAI GPT-4o', '$2.50 / 1M tokens', '$10.00 / 1M tokens', 'active'),
('gpt-4o-mini', 'OpenAI GPT-4o Mini', '$0.15 / 1M tokens', '$0.60 / 1M tokens', 'active'),
('o3', 'OpenAI o3', '$2.00 / 1M tokens', '$8.00 / 1M tokens', 'active'),
('o3-mini', 'OpenAI o3 Mini', '$1.10 / 1M tokens', '$4.40 / 1M tokens', 'active'),
('o4-mini', 'OpenAI o4 Mini', '$1.10 / 1M tokens', '$4.40 / 1M tokens', 'active')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `pricing_input` = VALUES(`pricing_input`),
  `pricing_output` = VALUES(`pricing_output`),
  `status` = VALUES(`status`);
