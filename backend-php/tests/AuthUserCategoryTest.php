<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

class AuthUserCategoryTest extends TestCase {
    public function testInClausePlaceholders(): void {
        $this->assertEquals('?,?,?', inClausePlaceholders([1, 2, 3]));
    }

    public function testUserRolesFunctionExists(): void {
        $this->assertTrue(function_exists('userRoles'));
    }
}
