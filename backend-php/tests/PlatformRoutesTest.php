<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

class PlatformRoutesTest extends TestCase {
    public function testAiResolveCourseIdLogic(): void {
        $this->assertEquals(5, aiResolveCourseId(5, 0));
        $this->assertEquals(0, aiResolveCourseId(0, 0));
    }

    public function testMapCourseLevelStatus(): void {
        $this->assertEquals('completed', mapCourseLevelStatus(true, false, 'in-progress'));
        $this->assertEquals('completed', mapCourseLevelStatus(false, false, 'completed'));
        $this->assertEquals('in-progress', mapCourseLevelStatus(false, false, 'in-progress'));
        $this->assertEquals('locked', mapCourseLevelStatus(false, true, 'in-progress'));
    }
}
