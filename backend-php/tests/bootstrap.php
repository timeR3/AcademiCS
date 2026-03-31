<?php
define('PHPUNIT_RUNNING', true);
putenv('APP_ENV=testing');
require_once __DIR__ . '/../public/index.php';
require_once __DIR__ . '/../routes/auth-users-categories.php';
require_once __DIR__ . '/../routes/platform-routes.php';
