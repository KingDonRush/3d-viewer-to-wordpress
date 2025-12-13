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
        add_filter('wp_check_filetype_and_ext', [$this, 'force_zip_mime_detection'], 999, 4);
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

        return $mimes;
    }

    /**
     * Corrige a detecção MIME do WordPress para arquivos ZIP
     */
    public function force_zip_mime_detection($data, $file, $filename, $mimes)
    {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($ext === 'zip') {
            $data['ext']  = 'zip';
            $data['type'] = 'application/x-zip-compressed';
            $data['proper_filename'] = $filename;
            error_log("[3D Viewer] force_zip_mime_detection(): MIME forçado para application/x-zip-compressed ({$filename})");
        }

        return $data;
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
Viewer_To_Elementor_Plugin::instance();
