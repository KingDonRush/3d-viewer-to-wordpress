<?php
/**
 * Enfileira scripts e estilos do plugin (versão CDN)
 */

if (!defined('ABSPATH')) {
    exit;
}

class ThreeJS_Elementor_Enqueue {

    public static function enqueue_scripts() {
        // Three.js (núcleo)
        wp_register_script(
            'threejs-library',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js',
            [],
            '0.158.0',
            false
        );

        // DRACOLoader
        wp_register_script(
            'threejs-draco-loader',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/examples/jsm/loaders/DRACOLoader.min.js',
            ['threejs-library'],
            '0.158.0',
            false
        );

        // GLTFLoader
        wp_register_script(
            'threejs-gltf-loader',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/examples/jsm/loaders/GLTFLoader.min.js',
            ['threejs-library', 'threejs-draco-loader'],
            '0.158.0',
            false
        );

        // OrbitControls
        wp_register_script(
            'threejs-orbit-controls',
            'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/examples/jsm/controls/OrbitControls.min.js',
            ['threejs-library'],
            '0.158.0',
            false
        );

        // Stats.js (debug/performance opcional)
        wp_register_script(
            'threejs-stats',
            'https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/stats.min.js',
            [],
            'r17',
            false
        );

        // Viewer principal (mantido local)
        wp_register_script(
            'threejs-elementor-viewer',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/viewer.js',
            [
                'jquery',
                'threejs-library',
                'threejs-draco-loader',
                'threejs-gltf-loader',
                'threejs-orbit-controls',
                'threejs-stats'
            ],
            '1.0.0',
            true
        );

        // Estilos principais
        wp_register_style(
            'threejs-elementor-viewer',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/css/viewer.css',
            [],
            '1.0.0'
        );

        // Enfileirar scripts e estilos
        wp_enqueue_script('threejs-elementor-viewer');
        wp_enqueue_style('threejs-elementor-viewer');

        // Passar variáveis ao JS
        wp_localize_script('threejs-elementor-viewer', 'threejs_viewer_config', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threejs_viewer_nonce'),
            'plugin_url' => THREEJS_ELEMENTOR_PLUGIN_URL,
            'debug' => defined('WP_DEBUG') && WP_DEBUG,
        ]);

        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('ThreeJS Viewer: scripts e estilos carregados via CDN.');
        }
    }
}
