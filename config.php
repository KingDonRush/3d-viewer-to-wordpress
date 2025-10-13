<?php
/**
 * Configurações do Plugin ThreeJS Elementor 3D Viewer
 */

if (!defined('ABSPATH')) {
    exit;
}

// Configurações do plugin
define('THREEJS_PLUGIN_VERSION', '1.0.0');
define('THREEJS_PLUGIN_NAME', 'ThreeJS Elementor 3D Viewer');

// Configurações de performance
define('THREEJS_MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB
define('THREEJS_TIMEOUT', 30000); // 30 segundos

// Configurações de CDN
define('THREEJS_DRACO_CDN', 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
define('THREEJS_THREE_CDN', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/');

// Configurações de debug
define('THREEJS_DEBUG', false);

// Configurações de cache
define('THREEJS_CACHE_ENABLED', true);
define('THREEJS_CACHE_DURATION', 3600); // 1 hora

/**
 * Classe de configuração
 */
class ThreeJS_Config {
    
    /**
     * Obter configurações do plugin
     */
    public static function get_settings() {
        return array(
            'version' => THREEJS_PLUGIN_VERSION,
            'name' => THREEJS_PLUGIN_NAME,
            'max_file_size' => THREEJS_MAX_FILE_SIZE,
            'timeout' => THREEJS_TIMEOUT,
            'draco_cdn' => THREEJS_DRACO_CDN,
            'three_cdn' => THREEJS_THREE_CDN,
            'debug' => THREEJS_DEBUG,
            'cache_enabled' => THREEJS_CACHE_ENABLED,
            'cache_duration' => THREEJS_CACHE_DURATION
        );
    }
    
    /**
     * Verificar se debug está ativo
     */
    public static function is_debug() {
        return defined('WP_DEBUG') && WP_DEBUG && THREEJS_DEBUG;
    }
    
    /**
     * Obter versão do plugin
     */
    public static function get_version() {
        return THREEJS_PLUGIN_VERSION;
    }
} 