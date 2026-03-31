<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

class AiRoutesTest extends TestCase {
    public function testAiParsePricingToRatePerMillion(): void {
        $this->assertEquals(3.5, aiParsePricingToRatePerMillion('$3.50 / 1M tokens'));
        $this->assertEquals(3500.0, aiParsePricingToRatePerMillion('$3.50 / 1K tokens'));
    }

    public function testAiEstimateCostUsd(): void {
        $this->assertEquals(0.014, aiEstimateCostUsd(1000, 1000, 3.5, 10.5));
    }
}
