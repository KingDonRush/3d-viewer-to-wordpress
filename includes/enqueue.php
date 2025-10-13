<?php
/**
 * Enqueue scripts e estilos do plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

class ThreeJS_Elementor_Enqueue {
    
    public static function enqueue_scripts() {
        // Registrar Three.js
        wp_register_script(
            'threejs-library',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/three.min.js',
            array(),
            '0.158.0',
            false
        );
        
        // Registrar JSZip
        wp_register_script(
            'jszip-library',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/jszip.min.js',
            array(),
            '3.10.1',
            false
        );
        
        // Registrar DRACOLoader
        wp_register_script(
            'threejs-draco-loader',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/DRACOLoader.js',
            array('threejs-library'),
            '0.158.0',
            false
        );
        
        // Registrar GLTFLoader
        wp_register_script(
            'threejs-gltf-loader',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/GLTFLoader.js',
            array('threejs-library', 'threejs-draco-loader'),
            '0.158.0',
            false
        );
        
        // Registrar OrbitControls
        wp_register_script(
            'threejs-orbit-controls',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/OrbitControls.js',
            array('threejs-library'),
            '0.158.0',
            false
        );
        
        // Registrar e enfileirar scripts do viewer
        wp_register_script(
            'threejs-elementor-viewer',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/viewer.js',
            array('jquery', 'threejs-library', 'jszip-library', 'threejs-draco-loader', 'threejs-gltf-loader', 'threejs-orbit-controls'),
            '1.0.0',
            true
        );
        
        // Registrar e enfileirar estilos
        wp_register_style(
            'threejs-elementor-viewer',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/css/viewer.css',
            array(),
            '1.0.0'
        );
        
        // Registrar Smart Analyzer
        wp_register_script(
            'threejs-smart-analyzer',
            THREEJS_ELEMENTOR_PLUGIN_URL . 'assets/js/smart-analyzer.js',
            array('jquery'),
            '1.0.0',
            true
        );
        
        // Enfileirar scripts e estilos
        wp_enqueue_script('threejs-elementor-viewer');
        wp_enqueue_script('threejs-smart-analyzer');
        wp_enqueue_style('threejs-elementor-viewer');
        
        // Debug: Verificar se os scripts foram carregados
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('ThreeJS Viewer: Scripts carregados - ' . THREEJS_ELEMENTOR_PLUGIN_URL);
        }
        
        // Localizar script para AJAX
        wp_localize_script('threejs-elementor-viewer', 'threejs_viewer_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threejs_viewer_nonce'),
            'plugin_url' => THREEJS_ELEMENTOR_PLUGIN_URL
        ));
        
        // Localizar script do Smart Analyzer
        wp_localize_script('threejs-smart-analyzer', 'threejs_analyzer_config', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('threejs_analyze_nonce')
        ));
    }
} 