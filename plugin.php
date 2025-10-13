<?php
/**
 * Plugin Name: ThreeJS Elementor 3D Viewer
 * Description: Widget Elementor para visualização de modelos 3D (.glb/.gltf) a partir de arquivos .zip
 * Version: 1.0.0
 * Author: Guilherme Silva - MindSync
 * Text Domain: threejs-elementor-viewer
 */

// Prevenir acesso direto
if (!defined('ABSPATH')) {
    exit;
}

// Carregar configurações
require_once __DIR__ . '/config.php';

// Definir constantes do plugin
define('THREEJS_ELEMENTOR_PLUGIN_URL', plugin_dir_url(__FILE__));
define('THREEJS_ELEMENTOR_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Classe principal do plugin
 */
class ThreeJS_Elementor_Viewer_Plugin {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_action('plugins_loaded', array($this, 'init'));
    }
    
    public function init() {
        // Verificar se o Elementor está ativo
        if (!did_action('elementor/loaded')) {
            add_action('admin_notices', array($this, 'admin_notice_missing_elementor'));
            return;
        }
        
        // Carregar dependências apenas quando o Elementor estiver pronto
        add_action('elementor/init', array($this, 'load_dependencies'));
        
        // Registrar widget
        add_action('elementor/widgets/register', array($this, 'register_widget'));
        
        // Registrar scripts e estilos
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Permitir upload de arquivos ZIP
        add_filter('upload_mimes', array($this, 'allow_zip_upload'));
    }
    
    public function load_dependencies() {
        // Verificar se o Elementor está completamente carregado
        if (!class_exists('\Elementor\Widget_Base')) {
            return;
        }
        
        require_once THREEJS_ELEMENTOR_PLUGIN_PATH . 'includes/enqueue.php';
        require_once THREEJS_ELEMENTOR_PLUGIN_PATH . 'elementor/widget-threejs-viewer.php';
    }
    
    public function register_widget($widgets_manager) {
        // Verificar se a classe do widget existe antes de registrar
        if (class_exists('\ThreeJS_Elementor_Widget')) {
            $widgets_manager->register(new \ThreeJS_Elementor_Widget());
        }
    }
    
    public function enqueue_scripts() {
        ThreeJS_Elementor_Enqueue::enqueue_scripts();
    }
    
    public function allow_zip_upload($mimes) {
        // Adicionar suporte para arquivos ZIP
        $mimes['zip'] = 'application/zip';
        return $mimes;
    }
    
    public function admin_notice_missing_elementor() {
        if (isset($_GET['activate'])) unset($_GET['activate']);
        
        $message = sprintf(
            esc_html__('"%1$s" requires "%2$s" to be installed and activated.', 'threejs-elementor-viewer'),
            '<strong>' . esc_html__('ThreeJS Elementor 3D Viewer', 'threejs-elementor-viewer') . '</strong>',
            '<strong>' . esc_html__('Elementor', 'threejs-elementor-viewer') . '</strong>'
        );
        
        printf('<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message);
    }
}

// Inicializar o plugin
ThreeJS_Elementor_Viewer_Plugin::get_instance(); 