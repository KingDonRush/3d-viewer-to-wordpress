<?php

$failures = [];
$temporaryDirectory = sys_get_temp_dir() . '/3d-viewer-upload-smoke-' . bin2hex(random_bytes(6));

$assert = static function (string $label, bool $expected, bool $actual) use (&$failures): void {
    if ($expected !== $actual) {
        $failures[] = sprintf('%s: expected %s, got %s', $label, $expected ? 'true' : 'false', $actual ? 'true' : 'false');
    }
};

$writeFixture = static function (string $path, string $contents): string {
    if (file_put_contents($path, $contents) === false) {
        throw new RuntimeException("Could not write fixture: {$path}");
    }

    return $path;
};

$buildGlb = static function (string $json, int $version = 2, ?int $declaredLength = null): string {
    $jsonLength = strlen($json);
    $padding = (4 - ($jsonLength % 4)) % 4;
    $jsonChunk = $json . str_repeat(' ', $padding);
    $length = 12 + 8 + strlen($jsonChunk);
    $declaredLength ??= $length;

    return pack('a4V2', 'glTF', $version, $declaredLength)
        . pack('V2', strlen($jsonChunk), 0x4e4f534a)
        . $jsonChunk;
};

$writeSparseGlb = static function (string $path, string $json, int $binLength): string {
    $jsonLength = strlen($json);
    $padding = (4 - ($jsonLength % 4)) % 4;
    $jsonChunk = $json . str_repeat(' ', $padding);
    $length = 12 + 8 + strlen($jsonChunk) + 8 + $binLength;
    $handle = fopen($path, 'wb');
    if ($handle === false) {
        throw new RuntimeException("Could not create sparse GLB fixture: {$path}");
    }

    try {
        fwrite($handle, pack('a4V2', 'glTF', 2, $length));
        fwrite($handle, pack('V2', strlen($jsonChunk), 0x4e4f534a));
        fwrite($handle, $jsonChunk);
        fwrite($handle, pack('V2', $binLength, 0x004e4942));
        ftruncate($handle, $length);
    } finally {
        fclose($handle);
    }

    return $path;
};

$zipFixture = static function (string $path, string $entry, string $contents): string {
    $zip = new ZipArchive();
    if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException("Could not create ZIP fixture: {$path}");
    }

    $zip->addFromString($entry, $contents);
    $zip->close();

    return $path;
};

$removeDirectory = static function (string $directory) use (&$removeDirectory): void {
    if (!is_dir($directory)) {
        return;
    }

    foreach (scandir($directory) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $path = $directory . '/' . $entry;
        is_dir($path) ? $removeDirectory($path) : unlink($path);
    }

    rmdir($directory);
};

try {
    if (!class_exists('Viewer_To_Elementor_Plugin')) {
        throw new RuntimeException('Viewer_To_Elementor_Plugin is not loaded by WordPress.');
    }

    if (!mkdir($temporaryDirectory, 0700, true) && !is_dir($temporaryDirectory)) {
        throw new RuntimeException("Could not create temporary directory: {$temporaryDirectory}");
    }

    $reflection = new ReflectionClass('Viewer_To_Elementor_Plugin');
    $plugin = $reflection->newInstanceWithoutConstructor();

    $gltfValidator = $reflection->getMethod('is_valid_gltf_file');
    $gltfValidator->setAccessible(true);
    $glbValidator = $reflection->getMethod('is_valid_glb_file');
    $glbValidator->setAccessible(true);
    $jsonChunkValidator = $reflection->getMethod('has_valid_glb_json_chunk');
    $jsonChunkValidator->setAccessible(true);
    $gltfMemoryValidator = $reflection->getMethod('has_gltf_memory_budget');
    $gltfMemoryValidator->setAccessible(true);

    $validGltf = $writeFixture(
        $temporaryDirectory . '/valid.gltf',
        '{"asset":{"version":"2.0"}}'
    );
    $invalidGltf = $writeFixture($temporaryDirectory . '/invalid.gltf', '{invalid json');
    $wrongVersionGltf = $writeFixture(
        $temporaryDirectory . '/wrong-version.gltf',
        '{"asset":{"version":"1.0"}}'
    );

    $validGlb = $writeFixture(
        $temporaryDirectory . '/valid.glb',
        $buildGlb('{"asset":{"version":"2.0"}}')
    );
    $invalidMagicGlb = $writeFixture(
        $temporaryDirectory . '/invalid-magic.glb',
        $buildGlb('{"asset":{"version":"2.0"}}')
    );
    $invalidVersionGlb = $writeFixture(
        $temporaryDirectory . '/invalid-version.glb',
        $buildGlb('{"asset":{"version":"2.0"}}', 3)
    );
    $invalidLengthGlb = $writeFixture(
        $temporaryDirectory . '/invalid-length.glb',
        $buildGlb('{"asset":{"version":"2.0"}}', 2, 9999)
    );
    $invalidJsonChunkGlb = $writeFixture(
        $temporaryDirectory . '/invalid-json-chunk.glb',
        $buildGlb('{"asset":')
    );
    $largePayloadGlb = $writeSparseGlb(
        $temporaryDirectory . '/large-payload.glb',
        '{"asset":{"version":"2.0"}}',
        64 * 1024 * 1024
    );
    $validGlbContents = file_get_contents($validGlb);
    if (!is_string($validGlbContents)) {
        throw new RuntimeException('Could not read valid GLB fixture.');
    }
    $truncatedHeaderGlb = $writeFixture(
        $temporaryDirectory . '/truncated-header.glb',
        substr($validGlbContents, 0, 8)
    );
    $truncatedChunkHeaderGlb = $writeFixture(
        $temporaryDirectory . '/truncated-chunk-header.glb',
        substr($validGlbContents, 0, 16)
    );
    $longJsonChunkGlb = $writeFixture(
        $temporaryDirectory . '/long-json-chunk.glb',
        pack('a4V2', 'glTF', 2, 22)
            . pack('V2', 100, 0x4e4f534a)
            . '{}'
    );
    $firstChunkBinGlb = $writeFixture(
        $temporaryDirectory . '/first-chunk-bin.glb',
        pack('a4V2', 'glTF', 2, 22)
            . pack('V2', 2, 0x004e4942)
            . '{}'
    );
    $invalidMagicContents = file_get_contents($invalidMagicGlb);
    if (!is_string($invalidMagicContents)) {
        throw new RuntimeException('Could not read invalid magic fixture.');
    }
    $invalidMagicGlb = $writeFixture(
        $invalidMagicGlb,
        'BAD!' . substr($invalidMagicContents, 4)
    );

    $assert('GLTF valid 2.0', true, $gltfValidator->invoke($plugin, $validGltf, 'application/json'));
    $assert('GLTF invalid JSON', false, $gltfValidator->invoke($plugin, $invalidGltf, 'application/json'));
    $assert('GLTF version != 2.0', false, $gltfValidator->invoke($plugin, $wrongVersionGltf, 'application/json'));

    $assert('GLB valid minimum', true, $glbValidator->invoke($plugin, $validGlb, 'model/gltf-binary'));
    $assert('GLB invalid magic', false, $glbValidator->invoke($plugin, $invalidMagicGlb, 'model/gltf-binary'));
    $assert('GLB version != 2', false, $glbValidator->invoke($plugin, $invalidVersionGlb, 'model/gltf-binary'));
    $assert('GLB declared length incoherent', false, $glbValidator->invoke($plugin, $invalidLengthGlb, 'model/gltf-binary'));
    $assert('GLB invalid JSON chunk', false, $glbValidator->invoke($plugin, $invalidJsonChunkGlb, 'model/gltf-binary'));
    $assert('GLB large payload accepted', true, $glbValidator->invoke($plugin, $largePayloadGlb, 'model/gltf-binary'));
    $assert('GLB truncated header rejected', false, $glbValidator->invoke($plugin, $truncatedHeaderGlb, 'model/gltf-binary'));
    $assert('GLB truncated chunk header rejected', false, $glbValidator->invoke($plugin, $truncatedChunkHeaderGlb, 'model/gltf-binary'));
    $assert('GLB JSON chunk length exceeds bytes', false, $glbValidator->invoke($plugin, $longJsonChunkGlb, 'model/gltf-binary'));
    $assert('GLB first chunk non-JSON rejected', false, $glbValidator->invoke($plugin, $firstChunkBinGlb, 'model/gltf-binary'));

    $validJsonChunk = '{"asset":{"version":"2.0"}}';
    $invalidJsonChunk = '{"asset":';
    $assert('GLB JSON chunk valid', true, $jsonChunkValidator->invoke($plugin, $validJsonChunk));
    $assert('GLB JSON chunk invalid', false, $jsonChunkValidator->invoke($plugin, $invalidJsonChunk));

    $sparseGltf = $temporaryDirectory . '/memory-budget.gltf';
    $sparseHandle = fopen($sparseGltf, 'wb');
    if ($sparseHandle === false) {
        throw new RuntimeException('Could not create GLTF memory budget fixture.');
    }
    ftruncate($sparseHandle, 64 * 1024 * 1024);
    fclose($sparseHandle);
    $assert('GLTF memory budget sufficient', true, $gltfMemoryValidator->invoke($plugin, 1024));
    $previousMemoryLimit = ini_get('memory_limit');
    if (ini_set('memory_limit', '128M') === false) {
        throw new RuntimeException('Could not set temporary test memory limit.');
    }
    try {
        $assert('GLTF memory budget insufficient', false, $gltfValidator->invoke($plugin, $sparseGltf, 'application/json'));
    } finally {
        ini_set('memory_limit', (string) $previousMemoryLimit);
    }

    $validZip = $zipFixture($temporaryDirectory . '/valid.zip', 'scene.bin', 'binary');
    $blockedZip = $zipFixture($temporaryDirectory . '/blocked.zip', 'payload.php', '<?php echo "blocked";');
    $validZipResult = $plugin->validate_zip_upload([
        'name' => 'valid.zip',
        'type' => 'application/zip',
        'tmp_name' => $validZip,
    ]);
    $blockedZipResult = $plugin->validate_zip_upload([
        'name' => 'blocked.zip',
        'type' => 'application/zip',
        'tmp_name' => $blockedZip,
    ]);
    $assert('ZIP normal accepted', true, !isset($validZipResult['error']));
    $assert('ZIP payload.php rejected', true, isset($blockedZipResult['error']));

    if ($failures !== []) {
        throw new RuntimeException(implode(PHP_EOL, $failures));
    }

    echo "A0_CHARACTERIZATION_PASS\n";
} catch (Throwable $exception) {
    fwrite(STDERR, "A0_CHARACTERIZATION_FAIL\n" . $exception->getMessage() . PHP_EOL);
    exit(1);
} finally {
    $removeDirectory($temporaryDirectory);
}
