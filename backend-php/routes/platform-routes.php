<?php
declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'platform-settings-ai-routes.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'platform-users-badges-routes.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'platform-courses-routes.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'platform-content-routes.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'platform-reports-routes.php';


function handlePlatformRoutes(string $method, string $path): void {
    handlePlatformSettingsAiRoutes($method, $path);
    handlePlatformUsersBadgesRoutes($method, $path);
    handlePlatformCoursesRoutes($method, $path);
    handlePlatformContentRoutes($method, $path);
    handlePlatformReportsRoutes($method, $path);
    handleAdminAuditRoutes($method, $path);
}
