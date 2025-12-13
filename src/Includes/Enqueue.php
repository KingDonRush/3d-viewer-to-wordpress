<?php
/**
 * Responsável por enfileirar scripts e estilos do plugin 3D Viewer to Elementor.
 * Inclui Import Map apenas no front-end e no preview do Elementor.
 */

namespace ViewerToElementor\Includes;

use ViewerToElementor\Config\Config;

defined('ABSPATH') || exit;

class Enqueue
{
    /**
     * Scripts e estilos para o FRONT-END e PREVIEW do Elementor
     */
    public static function enqueue_scripts(): void
    {
        // Só carrega no front-end e no iframe de preview do Elementor
        if (is_admin() && !isset($_GET['elementor-preview'])) {
            return;
        }

        $plugin_url = plugin_dir_url(__DIR__) . '../';

        /**
         * 🧩 Import Map — apenas onde o preview do widget é renderizado
         */
        add_action('wp_head', function () {
            echo '<script type="importmap">
            {
              "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/",
                "jszip": "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
              }
            }
            </script>';
        });

        /**
         * 🧱 Script principal do viewer (usa módulos ES importados via import map)
         */
        wp_register_script(
            'viewer-to-elementor-frontend',
            $plugin_url . 'assets/js/viewer-frontend.js',
            [],
            Config::VERSION,
            true
        );

        // Força o script a ser tratado como módulo ES6
        add_filter('script_loader_tag', function ($tag, $handle, $src) {
            if (in_array($handle, ['viewer-to-elementor-frontend', 'viewer-to-elementor-editor'], true)) {
                return '<script type="module" src="' . esc_url($src) . '"></script>';
            }
            return $tag;
        }, 10, 3);

        /**
         * 🎨 Estilos do Viewer
         */
        wp_register_style(
            'viewer-to-elementor',
            $plugin_url . 'assets/css/viewer.css',
            [],
            Config::VERSION
        );

        // Enfileira os recursos apenas no preview / front
        wp_enqueue_script('viewer-to-elementor-frontend');
        wp_enqueue_style('viewer-to-elementor');

        // Dados globais JS (opcional)
        wp_localize_script('viewer-to-elementor-frontend', 'viewer_to_elementor_config', [
            'ajax_url'   => admin_url('admin-ajax.php'),
            'nonce'      => wp_create_nonce('viewer_to_elementor_nonce'),
            'plugin_url' => $plugin_url,
            'debug'      => Config::is_debug(),
        ]);
    }

    /**
     * Scripts para o EDITOR DO ELEMENTOR (painel lateral)
     * — inclui seletor de mídia (admin-upload.js)
     */
    public static function enqueue_admin_scripts(): void
    {
        // Garante que estamos realmente no editor do Elementor
        if (empty($_GET['action']) || $_GET['action'] !== 'elementor') {
            return;
        }

        // Garante que a biblioteca de mídia do WP esteja disponível
        wp_enqueue_media();

        $plugin_url = plugin_dir_url(__DIR__) . '../';

        wp_enqueue_script(
            'viewer-to-elementor-admin',
            $plugin_url . 'assets/js/admin-upload.js',
            ['jquery', 'elementor-editor', 'wp-util'],
            Config::VERSION,
            true
        );

        wp_enqueue_script(
            'viewer-to-elementor-editor',
            $plugin_url . 'assets/js/viewer-editor.js',
            ['elementor-editor'],
            Config::VERSION,
            true
        );
    }
}
