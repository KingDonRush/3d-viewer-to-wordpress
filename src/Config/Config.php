<?php
/**
 * Configurações do Plugin 3D Viewer to Elementor
 */

namespace ViewerToElementor\Config;

defined('ABSPATH') || exit;

/**
 * Classe de configuração central do plugin.
 * Define constantes e métodos utilitários.
 */
class Config {

    // Informações principais do plugin
    public const VERSION = '1.0.0';
    public const NAME = '3D Viewer to Elementor';

    // Configurações de performance
    public const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    public const TIMEOUT = 30000; // 30 segundos

    // URLs de CDN
    public const DRACO_CDN = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
    public const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/';

    // Debug
    public const DEBUG = false;

    /**
     * Retorna todas as configurações do plugin em um array associativo.
     */
    public static function get_settings(): array {
        return [
            'version'      => self::VERSION,
            'name'         => self::NAME,
            'max_file_size'=> self::MAX_FILE_SIZE,
            'timeout'      => self::TIMEOUT,
            'draco_cdn'    => self::DRACO_CDN,
            'three_cdn'    => self::THREE_CDN,
            'debug'        => self::DEBUG,
        ];
    }

    /**
     * Retorna se o modo debug está ativo.
     */
    public static function is_debug(): bool {
        return defined('WP_DEBUG') && WP_DEBUG && self::DEBUG;
    }

    /**
     * Retorna a versão atual do plugin.
     */
    public static function get_version(): string {
        return self::VERSION;
    }
}
