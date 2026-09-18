<?php

$failures = [];

$assert = static function (string $label, bool $expected, bool $actual) use (&$failures): void {
    if ($expected !== $actual) {
        $failures[] = sprintf('%s: expected %s, got %s', $label, $expected ? 'true' : 'false', $actual ? 'true' : 'false');
    }
};

try {
    if (!class_exists('Viewer_To_Elementor_Plugin')) {
        throw new RuntimeException('Viewer_To_Elementor_Plugin is not loaded by WordPress.');
    }

    $reflection = new ReflectionClass('Viewer_To_Elementor_Plugin');
    $plugin = $reflection->newInstanceWithoutConstructor();
    $assert('WordPress can invoke notice callback', true, is_callable([$plugin, 'maybe_show_upload_capacity_notice']));
    $parseSize = $reflection->getMethod('parse_size_bytes');
    $parseSize->setAccessible(true);
    $capacityStatus = $reflection->getMethod('get_upload_capacity_status');
    $capacityStatus->setAccessible(true);
    $noticePolicy = $reflection->getMethod('should_show_upload_capacity_notice');
    $noticePolicy->setAccessible(true);
    $detector = $reflection->getMethod('detect_upload_capacity');
    $detector->setAccessible(true);
    $targetBytes = $reflection->getConstant('UPLOAD_CAPACITY_TARGET_BYTES');
    $recheckOption = $reflection->getConstant('UPLOAD_CAPACITY_RECHECK_OPTION');

    $assert('parse 2M', true, $parseSize->invoke($plugin, '2M') === 2 * 1024 * 1024);
    $assert('parse 8M', true, $parseSize->invoke($plugin, '8M') === 8 * 1024 * 1024);
    $assert('parse 128M', true, $parseSize->invoke($plugin, '128M') === 128 * 1024 * 1024);
    $assert('parse 1G', true, $parseSize->invoke($plugin, '1G') === 1024 * 1024 * 1024);

    $assert('below target blocked', true, $capacityStatus->invoke($plugin, $targetBytes - 1) === 'blocked');
    $assert('equal target ready', true, $capacityStatus->invoke($plugin, $targetBytes) === 'ready');
    $assert('above target ready', true, $capacityStatus->invoke($plugin, $targetBytes * 2) === 'ready');

    $detected = $detector->invoke($plugin);
    $detectedKeys = [
        'wp_max_upload_size',
        'upload_max_filesize',
        'post_max_size',
        'effective_bytes',
        'limiting_layer',
        'status',
    ];
    $assert('detector fields', true, array_diff($detectedKeys, array_keys($detected)) === []);
    $assert('detector effective positive', true, $detected['effective_bytes'] > 0);
    $assert('detector status derived', true, in_array($detected['status'], ['ready', 'blocked'], true));

    $readyDiagnostic = [
        'schema_version' => 1,
        'target_bytes' => $targetBytes,
        'effective_bytes' => $targetBytes * 2,
        'status' => 'ready',
        'limiting_layer' => 'post_max_size',
        'checked_at' => '2026-01-01T00:00:00+00:00',
        'needs_recheck' => false,
    ];
    $blockedDiagnostic = $readyDiagnostic;
    $blockedDiagnostic['effective_bytes'] = $targetBytes - 1;
    $blockedDiagnostic['status'] = 'blocked';
    $allowedOptionKeys = [
        'schema_version',
        'target_bytes',
        'effective_bytes',
        'status',
        'limiting_layer',
        'checked_at',
        'needs_recheck',
    ];
    $assert('option fields allowed', true, array_diff(array_keys($readyDiagnostic), $allowedOptionKeys) === []);
    $assert('ready notice absent', false, $noticePolicy->invoke($plugin, $readyDiagnostic, true));
    $assert('blocked notice eligible', true, $noticePolicy->invoke($plugin, $blockedDiagnostic, true));
    $assert('blocked notice denied without capability', false, $noticePolicy->invoke($plugin, $blockedDiagnostic, false));

    $previousRecheck = get_option($recheckOption, '__missing__');
    try {
        Viewer_To_Elementor_Plugin::activate();
        $assert('activation marks recheck', true, (int) get_option($recheckOption, 0) === 1);
        Viewer_To_Elementor_Plugin::activate();
        $assert('activation idempotent', true, (int) get_option($recheckOption, 0) === 1);
    } finally {
        if ($previousRecheck === '__missing__') {
            delete_option($recheckOption);
        } else {
            update_option($recheckOption, $previousRecheck, false);
        }
    }

    $pluginSource = file_get_contents(__DIR__ . '/../plugin.php');
    $assert(
        'no upload limit mutation',
        true,
        is_string($pluginSource) && preg_match('/ini_set\s*\(\s*[\'\"](?:upload_max_filesize|post_max_size)/i', $pluginSource) !== 1
    );

    if ($failures !== []) {
        throw new RuntimeException(implode(PHP_EOL, $failures));
    }

    echo "B1_CAPACITY_DIAGNOSTIC_PASS\n";
} catch (Throwable $exception) {
    fwrite(STDERR, "B1_CAPACITY_DIAGNOSTIC_FAIL\n" . $exception->getMessage() . PHP_EOL);
    exit(1);
}
