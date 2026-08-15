<?php
/**
 * Plugin Name: 3D Viewer to Elementor
 * Description: Widget Elementor para visualização de modelos 3D (.glb, .gltf, .zip) diretamente no Elementor.
 * Version: 1.0.0
 * Author: Guilherme Silva
 * Text Domain: 3d-viewer-to-elementor
 */

if (!defined('ABSPATH')) {
    exit; // Segurança: bloqueia acesso direto
}

/**
 * Carrega o autoloader do Composer
 */
require_once __DIR__ . '/vendor/autoload.php';

use ViewerToElementor\Includes\Enqueue;
use ViewerToElementor\Elementor\Widget3DViewer;
use ViewerToElementor\Elementor\Controls\ViewerMediaControl;

/**
 * Classe principal do plugin
 */
final class Viewer_To_Elementor_Plugin
{
    private const UPLOAD_CAPACITY_TARGET_BYTES = 134217728;
    private const UPLOAD_CAPACITY_SCHEMA_VERSION = 1;
    private const UPLOAD_CAPACITY_OPTION = 'viewer_to_elementor_upload_capacity';
    private const UPLOAD_CAPACITY_RECHECK_OPTION = 'viewer_to_elementor_upload_capacity_recheck';

    /**
     * Instância única (Singleton)
     */
    private static ?Viewer_To_Elementor_Plugin $instance = null;

    /**
     * Retorna a instância única
     */
    public static function instance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Construtor privado — inicializa o plugin
     */
    private function __construct()
    {
        add_action('plugins_loaded', [$this, 'init']);
    }

    /**
     * Inicializa o plugin (executado após todos os plugins serem carregados)
     */
    public function init(): void
    {
        $this->refresh_upload_capacity_diagnostic();
        add_action('admin_notices', [$this, 'maybe_show_upload_capacity_notice']);

        // Verifica se o Elementor está ativo
        if (!did_action('elementor/loaded')) {
            add_action('admin_notices', [$this, 'admin_notice_missing_elementor']);
            return;
        }

        // 🔹 Scripts do front-end
        add_action('wp_enqueue_scripts', [Enqueue::class, 'enqueue_scripts']);

        // 🔹 Scripts do editor Elementor (admin)
        add_action('elementor/editor/after_enqueue_scripts', [Enqueue::class, 'enqueue_admin_scripts']);

        // 🔹 Registro do widget
        add_action('elementor/widgets/register', [$this, 'register_widget']);
        add_action('elementor/controls/register', [$this, 'register_controls']);

        // 🔹 Permitir upload de .zip e validar conteúdo
        add_filter('upload_mimes', [$this, 'allow_zip_upload']);
        add_filter('wp_check_filetype_and_ext', [$this, 'force_zip_mime_detection'], 999, 5);
        add_filter('wp_handle_upload_prefilter', [$this, 'validate_zip_upload']);
    }

    /**
     * Registra o widget do Viewer no Elementor
     */
    public function register_widget($widgets_manager): void
    {
        $widgets_manager->register(new Widget3DViewer());
    }

    public function register_controls($controls_manager): void
    {
        $controls_manager->register(new ViewerMediaControl());
    }

    /**
     * Libera globalmente o upload de arquivos ZIP
     */
    public function allow_zip_upload($mimes): array
    {
        $mimes['zip']  = 'application/zip';
        $mimes['zipx'] = 'application/x-zip-compressed';
        $mimes['x-zip'] = 'application/x-zip';
        $mimes['octet-stream'] = 'application/octet-stream';
        $mimes['compressed'] = 'multipart/x-zip';
        $mimes['application/x-zip-compressed'] = 'application/x-zip-compressed';
        $mimes['gltf'] = 'model/gltf+json';
        $mimes['glb']  = 'model/gltf-binary';

        return $mimes;
    }

    public static function activate(): void
    {
        update_option(self::UPLOAD_CAPACITY_RECHECK_OPTION, 1, false);
    }

    private function refresh_upload_capacity_diagnostic(): void
    {
        if (!is_admin()) {
            return;
        }

        $detected = $this->detect_upload_capacity();
        $current = get_option(self::UPLOAD_CAPACITY_OPTION, []);
        $diagnostic = [
            'schema_version' => self::UPLOAD_CAPACITY_SCHEMA_VERSION,
            'target_bytes' => self::UPLOAD_CAPACITY_TARGET_BYTES,
            'effective_bytes' => $detected['effective_bytes'],
            'status' => $detected['status'],
            'limiting_layer' => $detected['limiting_layer'],
            'checked_at' => $current['checked_at'] ?? gmdate('c'),
            'needs_recheck' => false,
        ];
        $recheck = (bool) get_option(self::UPLOAD_CAPACITY_RECHECK_OPTION, false);
        $relevantKeys = ['schema_version', 'target_bytes', 'effective_bytes', 'status', 'limiting_layer'];
        $changed = $recheck;

        foreach ($relevantKeys as $key) {
            if (($current[$key] ?? null) !== $diagnostic[$key]) {
                $changed = true;
                break;
            }
        }

        if ($changed || !is_array($current)) {
            $diagnostic['checked_at'] = gmdate('c');
            update_option(self::UPLOAD_CAPACITY_OPTION, $diagnostic, false);
        }

        if ($recheck) {
            update_option(self::UPLOAD_CAPACITY_RECHECK_OPTION, 0, false);
        }
    }

    private function detect_upload_capacity(): array
    {
        $limits = [
            'wp_max_upload_size' => (int) wp_max_upload_size(),
            'upload_max_filesize' => $this->parse_size_bytes((string) ini_get('upload_max_filesize')),
            'post_max_size' => $this->parse_size_bytes((string) ini_get('post_max_size')),
        ];
        $effective = null;
        $limitingLayers = [];

        foreach ($limits as $layer => $bytes) {
            if ($bytes > 0 && ($effective === null || $bytes < $effective)) {
                $effective = $bytes;
                $limitingLayers = [$layer];
            } elseif ($bytes > 0 && $bytes === $effective) {
                $limitingLayers[] = $layer;
            }
        }

        $effective ??= 0;

        return [
            'wp_max_upload_size' => $limits['wp_max_upload_size'],
            'upload_max_filesize' => $limits['upload_max_filesize'],
            'post_max_size' => $limits['post_max_size'],
            'effective_bytes' => $effective,
            'limiting_layer' => implode(', ', $limitingLayers),
            'status' => $this->get_upload_capacity_status($effective),
        ];
    }

    private function get_upload_capacity_status(int $effectiveBytes): string
    {
        return $effectiveBytes >= self::UPLOAD_CAPACITY_TARGET_BYTES ? 'ready' : 'blocked';
    }

    private function parse_size_bytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '-1') {
            return 0;
        }

        $unit = strtolower(substr($value, -1));
        $number = (float) $value;
        $multipliers = ['k' => 1024, 'm' => 1024 ** 2, 'g' => 1024 ** 3, 't' => 1024 ** 4];

        return (int) ($number * ($multipliers[$unit] ?? 1));
    }

    private function maybe_show_upload_capacity_notice(): void
    {
        $diagnostic = get_option(self::UPLOAD_CAPACITY_OPTION, []);
        if (!is_array($diagnostic) || !$this->should_show_upload_capacity_notice($diagnostic, current_user_can('manage_options'))) {
            return;
        }

        $effective = size_format((int) ($diagnostic['effective_bytes'] ?? 0));
        $target = size_format(self::UPLOAD_CAPACITY_TARGET_BYTES);
        $layer = $diagnostic['limiting_layer'] ?: __('unknown layer', '3d-viewer-to-elementor');
        printf(
            '<div class="notice notice-warning"><p>%s</p></div>',
            esc_html(
                sprintf(
                    __('3D Viewer uploads target %1$s, but this environment allows %2$s. Limiting layer: %3$s. Adjust PHP, webserver, or hosting configuration; the plugin cannot exceed this limit by itself.', '3d-viewer-to-elementor'),
                    $target,
                    $effective,
                    $layer
                )
            )
        );
    }

    private function should_show_upload_capacity_notice(array $diagnostic, bool $canManage): bool
    {
        return $canManage && ($diagnostic['status'] ?? '') === 'blocked';
    }

    /**
     * Corrige a detecção MIME do WordPress para arquivos ZIP
     */
    public function force_zip_mime_detection($data, $file, $filename, $mimes, $real_mime = false)
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($ext === 'zip') {
            $data['ext']  = 'zip';
            $data['type'] = 'application/x-zip-compressed';
            $data['proper_filename'] = $filename;
            error_log("[3D Viewer] force_zip_mime_detection(): MIME forçado para application/x-zip-compressed ({$filename})");
        }

        if (in_array($ext, ['gltf', 'glb'], true) && is_string($file) && is_file($file)) {
            $data['ext']  = false;
            $data['type'] = false;

            if ($ext === 'gltf' && $this->is_valid_gltf_file($file, $real_mime)) {
                $data['ext']  = 'gltf';
                $data['type'] = 'model/gltf+json';
            }

            if ($ext === 'glb' && $this->is_valid_glb_file($file, $real_mime)) {
                $data['ext']  = 'glb';
                $data['type'] = 'model/gltf-binary';
            }
        }

        return $data;
    }

    private function is_valid_gltf_file($file, $real_mime): bool
    {
        if (!is_string($file) || !is_file($file)) {
            return false;
        }

        $fileSize = filesize($file);
        if ($fileSize === false || !$this->has_gltf_memory_budget($fileSize)) {
            return false;
        }

        if ($real_mime && $real_mime !== 'application/json') {
            error_log("[3D Viewer] GLTF com MIME real inesperado: {$real_mime}");
        }

        $contents = file_get_contents($file);
        if (!is_string($contents)) {
            return false;
        }

        try {
            $document = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            return false;
        }

        return is_array($document)
            && isset($document['asset']['version'])
            && $document['asset']['version'] === '2.0';
    }

    private function is_valid_glb_file($file, $real_mime): bool
    {
        if (!is_string($file) || !is_file($file)) {
            return false;
        }

        if ($real_mime && $real_mime !== 'model/gltf-binary') {
            error_log("[3D Viewer] GLB com MIME real inesperado: {$real_mime}");
        }

        $fileSize = filesize($file);
        $handle = fopen($file, 'rb');
        if ($fileSize === false || $fileSize < 20 || $handle === false) {
            return false;
        }

        try {
            $headerContents = fread($handle, 12);
            if (!is_string($headerContents) || strlen($headerContents) !== 12) {
                return false;
            }

            $header = unpack('a4magic/Vversion/Vlength', $headerContents);
            if (
                $header['magic'] !== 'glTF'
                || $header['version'] !== 2
                || $header['length'] !== $fileSize
            ) {
                return false;
            }

            $chunkHeaderContents = fread($handle, 8);
            if (!is_string($chunkHeaderContents) || strlen($chunkHeaderContents) !== 8) {
                return false;
            }

            $chunk = unpack('Vlength/Vtype', $chunkHeaderContents);
            if ($chunk['type'] !== 0x4e4f534a || $chunk['length'] > $fileSize - 20) {
                return false;
            }

            $jsonContents = fread($handle, $chunk['length']);
            if (!is_string($jsonContents) || strlen($jsonContents) !== $chunk['length']) {
                return false;
            }

            return $this->has_valid_glb_json_chunk($jsonContents);
        } finally {
            fclose($handle);
        }
    }

    private function has_valid_glb_json_chunk(string $contents): bool
    {
        try {
            $document = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            return false;
        }

        return is_array($document)
            && isset($document['asset']['version'])
            && $document['asset']['version'] === '2.0';
    }

    private function has_gltf_memory_budget(int $fileSize): bool
    {
        $memoryLimit = ini_get('memory_limit');
        if ($memoryLimit === false || $memoryLimit === '' || $memoryLimit === '-1') {
            return true;
        }

        $limitBytes = $this->parse_memory_limit($memoryLimit);
        $readAndDecodeBudget = ($fileSize * 3) + (1024 * 1024);

        return memory_get_usage(true) + $readAndDecodeBudget <= $limitBytes;
    }

    private function parse_memory_limit(string $memoryLimit): int
    {
        $value = trim($memoryLimit);
        $unit = strtolower(substr($value, -1));
        $number = (float) $value;

        if ($unit === 'g') {
            $number *= 1024;
        }
        if ($unit === 'm' || $unit === 'g') {
            $number *= 1024;
        }
        if ($unit === 'k' || $unit === 'm' || $unit === 'g') {
            $number *= 1024;
        }

        return (int) $number;
    }

    /**
     * Valida o conteúdo de arquivos ZIP enviados (bloqueia scripts e executáveis)
     */
    public function validate_zip_upload($file)
    {
        $name = $file['name'] ?? '(sem nome)';
        $type = $file['type'] ?? '(sem tipo)';
        $ext  = pathinfo($name, PATHINFO_EXTENSION);

        error_log("[3D Viewer] Upload recebido — Nome: {$name} | MIME detectado: {$type} | Extensão: {$ext}");

        $is_zip = preg_match('/\.zip$/i', $name);

        if ($is_zip && file_exists($file['tmp_name'])) {
            $zip = new \ZipArchive();

            if ($zip->open($file['tmp_name']) === true) {
                $blocked = false;
                $blocked_files = [];

                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entry = $zip->getNameIndex($i);

                    // Bloqueia scripts, HTML, executáveis e DLLs
                    if (preg_match('/\.(php|phtml|phar|exe|js|html|htm|sh|bat|cmd|dll)$/i', $entry)) {
                        $blocked = true;
                        $blocked_files[] = $entry;
                    }
                }

                $zip->close();

                if ($blocked) {
                    $file['error'] = sprintf(
                        '🚫 ZIP bloqueado — contém arquivos não permitidos: %s',
                        implode(', ', $blocked_files)
                    );
                    error_log("[3D Viewer] ZIP bloqueado: {$name} -> " . implode(', ', $blocked_files));
                } else {
                    error_log("[3D Viewer] ZIP validado com sucesso: {$name}");
                }
            } else {
                error_log("[3D Viewer] Falha ao abrir ZIP temporário: {$file['tmp_name']}");
            }
        }

        return $file;
    }

    /**
     * Exibe aviso no painel caso o Elementor não esteja ativo
     */
    public function admin_notice_missing_elementor(): void
    {
        if (isset($_GET['activate'])) {
            unset($_GET['activate']);
        }

        $message = sprintf(
            esc_html__(
                '"%1$s" requer que o plugin "%2$s" esteja instalado e ativo.',
                '3d-viewer-to-elementor'
            ),
            '<strong>' . esc_html__('3D Viewer to Elementor', '3d-viewer-to-elementor') . '</strong>',
            '<strong>' . esc_html__('Elementor', '3d-viewer-to-elementor') . '</strong>'
        );

        printf('<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message);
    }
}

/**
 * Inicializa o plugin
 */
register_activation_hook(__FILE__, ['Viewer_To_Elementor_Plugin', 'activate']);
Viewer_To_Elementor_Plugin::instance();
