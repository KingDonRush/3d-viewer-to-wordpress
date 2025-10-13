<?php
/**
 * Detector Inteligente de Conteúdo ZIP
 * 
 * @since 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class ThreeJS_Smart_Content_Detector {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Hook para processar conteúdo inteligentemente
        add_action('wp_ajax_threejs_analyze_zip', array($this, 'analyze_zip_content'));
        add_action('wp_ajax_nopriv_threejs_analyze_zip', array($this, 'analyze_zip_content'));
    }
    
    /**
     * Analisar conteúdo do arquivo
     */
    public function analyze_zip_content() {
        // Verificar nonce
        if (!wp_verify_nonce($_POST['nonce'], 'threejs_analyze_nonce')) {
            wp_die('Security check failed');
        }
        
        $file_url = sanitize_url($_POST['zip_url']); // Mantém compatibilidade com nome antigo
        
        if (empty($file_url)) {
            wp_send_json_error('URL do arquivo não fornecida');
        }
        
        // Analisar arquivo inteligentemente
        $analysis = $this->analyze_file($file_url);
        
        if ($analysis['success']) {
            wp_send_json_success($analysis['data']);
        } else {
            wp_send_json_error($analysis['message']);
        }
    }
    
    /**
     * Analisar arquivo inteligentemente
     */
    public function analyze_file($file_url) {
        // Detectar tipo de arquivo pela URL
        $file_type = $this->detect_file_type_from_url($file_url);
        
        if ($file_type === 'zip') {
            return $this->analyze_zip($file_url);
        } elseif ($file_type === 'glb' || $file_type === 'gltf') {
            return $this->analyze_direct_model($file_url, $file_type);
        } else {
            return array(
                'success' => false,
                'message' => 'Tipo de arquivo não suportado'
            );
        }
    }
    
    /**
     * Detectar tipo de arquivo pela URL
     */
    private function detect_file_type_from_url($url) {
        $extension = strtolower(pathinfo($url, PATHINFO_EXTENSION));
        
        if ($extension === 'zip') return 'zip';
        if ($extension === 'glb') return 'glb';
        if ($extension === 'gltf') return 'gltf';
        
        return 'unknown';
    }
    
    /**
     * Analisar modelo direto (GLB/GLTF)
     */
    private function analyze_direct_model($model_url, $file_type) {
        $filename = basename($model_url);
        
        // Detectar se é arquivo otimizado
        $is_optimized = $this->detect_optimized_file($model_url);
        
        $analysis = array(
            'type' => '3d_model',
            'files' => array(
                array(
                    'name' => $filename,
                    'size' => 0, // Não conseguimos saber sem baixar
                    'type' => 'model_3d'
                )
            ),
            'models' => array(
                array(
                    'name' => $filename,
                    'size' => 0,
                    'type' => 'model_3d'
                )
            ),
            'textures' => array(),
            'materials' => array(),
            'animations' => array(),
            'metadata' => array(),
            'optimization' => array(
                'is_optimized' => $is_optimized,
                'level' => $is_optimized ? 'priority' : 'standard',
                'features' => $is_optimized ? array(
                    'Processamento prioritário',
                    'Otimizações aplicadas'
                ) : array()
            ),
            'recommendations' => $this->generate_optimized_recommendations($file_type, $is_optimized)
        );
        
        return array(
            'success' => true,
            'data' => $analysis
        );
    }
    
    /**
     * Detectar se arquivo foi otimizado
     */
    private function detect_optimized_file($url) {
        $optimized_indicators = array(
            'optimized',
            'optimized_',
            'opt_',
            'fast_',
            'web_',
            'threejs_',
            '1sec_',
            'render_'
        );
        
        $filename = strtolower(basename($url));
        
        // Verificar se filename contém indicadores
        foreach ($optimized_indicators as $indicator) {
            if (strpos($filename, $indicator) !== false) {
                return true;
            }
        }
        
        // Verificar se URL contém indicadores
        $url_lower = strtolower($url);
        foreach ($optimized_indicators as $indicator) {
            if (strpos($url_lower, $indicator) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Gerar recomendações para modelos otimizados
     */
    private function generate_optimized_recommendations($file_type, $is_optimized) {
        $recommendations = array();
        
        if ($is_optimized) {
            $recommendations[] = array(
                'type' => 'success',
                'message' => 'Modelo ' . strtoupper($file_type) . ' otimizado detectado - processamento prioritário'
            );
        } else {
            $recommendations[] = array(
                'type' => 'success',
                'message' => 'Modelo ' . strtoupper($file_type) . ' detectado - formato otimizado para web'
            );
            $recommendations[] = array(
                'type' => 'info',
                'message' => 'Modelo carregado diretamente - sem arquivos adicionais'
            );
        }
        
        return $recommendations;
    }
    
    /**
     * Analisar arquivo ZIP
     */
    public function analyze_zip($zip_url) {
        // Baixar ZIP
        $zip_content = $this->download_zip($zip_url);
        
        if (!$zip_content) {
            return array(
                'success' => false,
                'message' => 'Não foi possível baixar o arquivo ZIP'
            );
        }
        
        // Salvar temporariamente
        $temp_file = wp_tempnam('threejs_zip_');
        file_put_contents($temp_file, $zip_content);
        
        // Analisar conteúdo
        $analysis = $this->detect_content($temp_file);
        
        // Limpar arquivo temporário
        unlink($temp_file);
        
        return $analysis;
    }
    
    /**
     * Detectar conteúdo do ZIP
     */
    private function detect_content($zip_file) {
        $zip = new ZipArchive();
        
        if ($zip->open($zip_file) !== true) {
            return array(
                'success' => false,
                'message' => 'Arquivo ZIP inválido'
            );
        }
        
        $content_analysis = array(
            'type' => 'unknown',
            'files' => array(),
            'models' => array(),
            'textures' => array(),
            'materials' => array(),
            'animations' => array(),
            'metadata' => array(),
            'recommendations' => array()
        );
        
        // Listar todos os arquivos
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            $file_info = $zip->statIndex($i);
            
            $content_analysis['files'][] = array(
                'name' => $filename,
                'size' => $file_info['size'],
                'type' => $this->detect_file_type($filename)
            );
        }
        
        // Analisar tipos de conteúdo
        $content_analysis = $this->analyze_content_types($content_analysis, $zip);
        
        // Gerar recomendações
        $content_analysis['recommendations'] = $this->generate_recommendations($content_analysis);
        
        $zip->close();
        
        return array(
            'success' => true,
            'data' => $content_analysis
        );
    }
    
    /**
     * Detectar tipo de arquivo
     */
    private function detect_file_type($filename) {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        
        $type_map = array(
            // Modelos 3D
            'glb' => 'model_3d',
            'gltf' => 'model_3d',
            'obj' => 'model_3d',
            'fbx' => 'model_3d',
            'dae' => 'model_3d',
            '3ds' => 'model_3d',
            'blend' => 'model_3d',
            
            // Texturas
            'jpg' => 'texture',
            'jpeg' => 'texture',
            'png' => 'texture',
            'tga' => 'texture',
            'tiff' => 'texture',
            'bmp' => 'texture',
            'hdr' => 'texture',
            
            // Materiais
            'mtl' => 'material',
            'mat' => 'material',
            
            // Animações
            'bvh' => 'animation',
            'fbx' => 'animation',
            
            // Metadados
            'json' => 'metadata',
            'xml' => 'metadata',
            'txt' => 'metadata',
            'md' => 'metadata',
            
            // Outros
            'zip' => 'archive',
            'rar' => 'archive',
            '7z' => 'archive'
        );
        
        return isset($type_map[$extension]) ? $type_map[$extension] : 'unknown';
    }
    
    /**
     * Analisar tipos de conteúdo
     */
    private function analyze_content_types($analysis, $zip) {
        $models = array();
        $textures = array();
        $materials = array();
        $animations = array();
        $metadata = array();
        
        foreach ($analysis['files'] as $file) {
            switch ($file['type']) {
                case 'model_3d':
                    $models[] = $file;
                    break;
                case 'texture':
                    $textures[] = $file;
                    break;
                case 'material':
                    $materials[] = $file;
                    break;
                case 'animation':
                    $animations[] = $file;
                    break;
                case 'metadata':
                    $metadata[] = $file;
                    break;
            }
        }
        
        // Determinar tipo principal
        if (!empty($models)) {
            $analysis['type'] = '3d_model';
            $analysis['models'] = $models;
        } elseif (!empty($textures)) {
            $analysis['type'] = 'texture_pack';
            $analysis['textures'] = $textures;
        } elseif (!empty($materials)) {
            $analysis['type'] = 'material_library';
            $analysis['materials'] = $materials;
        } elseif (!empty($animations)) {
            $analysis['type'] = 'animation_pack';
            $analysis['animations'] = $animations;
        }
        
        $analysis['textures'] = $textures;
        $analysis['materials'] = $materials;
        $analysis['animations'] = $animations;
        $analysis['metadata'] = $metadata;
        
        return $analysis;
    }
    
    /**
     * Gerar recomendações
     */
    private function generate_recommendations($analysis) {
        $recommendations = array();
        
        // Verificar se é um modelo 3D válido
        if ($analysis['type'] === '3d_model') {
            $glb_count = 0;
            $gltf_count = 0;
            
            foreach ($analysis['models'] as $model) {
                $ext = strtolower(pathinfo($model['name'], PATHINFO_EXTENSION));
                if ($ext === 'glb') $glb_count++;
                if ($ext === 'gltf') $gltf_count++;
            }
            
            if ($glb_count > 0) {
                $recommendations[] = array(
                    'type' => 'success',
                    'message' => 'Modelo GLB detectado - formato otimizado para web'
                );
            } elseif ($gltf_count > 0) {
                $recommendations[] = array(
                    'type' => 'info',
                    'message' => 'Modelo GLTF detectado - verificar se tem texturas'
                );
            }
            
            // Verificar texturas
            if (empty($analysis['textures'])) {
                $recommendations[] = array(
                    'type' => 'warning',
                    'message' => 'Nenhuma textura encontrada - modelo pode aparecer sem cor'
                );
            }
            
            // Verificar tamanho
            $total_size = 0;
            foreach ($analysis['files'] as $file) {
                $total_size += $file['size'];
            }
            
            if ($total_size > 50 * 1024 * 1024) { // 50MB
                $recommendations[] = array(
                    'type' => 'warning',
                    'message' => 'Arquivo muito grande (' . round($total_size / 1024 / 1024, 1) . 'MB) - considere otimizar'
                );
            }
        }
        
        // Verificar estrutura
        if (count($analysis['files']) === 1) {
            $recommendations[] = array(
                'type' => 'info',
                'message' => 'Arquivo único detectado - pode ser um modelo GLB standalone'
            );
        } else {
            $recommendations[] = array(
                'type' => 'info',
                'message' => 'Múltiplos arquivos detectados - estrutura completa de modelo 3D'
            );
        }
        
        return $recommendations;
    }
    
    /**
     * Baixar arquivo ZIP
     */
    private function download_zip($url) {
        $response = wp_remote_get($url, array(
            'timeout' => 60,
            'sslverify' => false,
        ));
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        
        if (empty($body)) {
            return false;
        }
        
        return $body;
    }
    
    /**
     * Processar ZIP inteligentemente
     */
    public function process_zip_intelligently($zip_url, $widget_id) {
        $analysis = $this->analyze_zip($zip_url);
        
        if (!$analysis['success']) {
            return $analysis;
        }
        
        $content_data = $analysis['data'];
        
        // Determinar ação baseada no tipo de conteúdo
        switch ($content_data['type']) {
            case '3d_model':
                return $this->process_3d_model($content_data, $widget_id);
                
            case 'texture_pack':
                return $this->process_texture_pack($content_data, $widget_id);
                
            case 'material_library':
                return $this->process_material_library($content_data, $widget_id);
                
            case 'animation_pack':
                return $this->process_animation_pack($content_data, $widget_id);
                
            default:
                return array(
                    'success' => false,
                    'message' => 'Tipo de conteúdo não reconhecido'
                );
        }
    }
    
    /**
     * Processar modelo 3D
     */
    private function process_3d_model($content_data, $widget_id) {
        $models = $content_data['models'];
        $textures = $content_data['textures'];
        
        // Encontrar modelo principal (priorizar GLB)
        $main_model = null;
        foreach ($models as $model) {
            $ext = strtolower(pathinfo($model['name'], PATHINFO_EXTENSION));
            if ($ext === 'glb') {
                $main_model = $model;
                break;
            }
        }
        
        if (!$main_model && !empty($models)) {
            $main_model = $models[0];
        }
        
        if (!$main_model) {
            return array(
                'success' => false,
                'message' => 'Nenhum modelo 3D válido encontrado'
            );
        }
        
        // Preparar dados para API
        $api_data = array(
            'type' => '3d_model',
            'main_model' => $main_model,
            'textures' => $textures,
            'materials' => $content_data['materials'],
            'animations' => $content_data['animations'],
            'metadata' => $content_data['metadata'],
            'recommendations' => $content_data['recommendations'],
            'widget_id' => $widget_id,
            'total_files' => count($content_data['files']),
            'total_size' => array_sum(array_column($content_data['files'], 'size'))
        );
        
        return array(
            'success' => true,
            'data' => $api_data
        );
    }
    
    /**
     * Processar pack de texturas
     */
    private function process_texture_pack($content_data, $widget_id) {
        $api_data = array(
            'type' => 'texture_pack',
            'textures' => $content_data['textures'],
            'widget_id' => $widget_id,
            'total_files' => count($content_data['files']),
            'total_size' => array_sum(array_column($content_data['files'], 'size'))
        );
        
        return array(
            'success' => true,
            'data' => $api_data
        );
    }
    
    /**
     * Processar biblioteca de materiais
     */
    private function process_material_library($content_data, $widget_id) {
        $api_data = array(
            'type' => 'material_library',
            'materials' => $content_data['materials'],
            'widget_id' => $widget_id,
            'total_files' => count($content_data['files']),
            'total_size' => array_sum(array_column($content_data['files'], 'size'))
        );
        
        return array(
            'success' => true,
            'data' => $api_data
        );
    }
    
    /**
     * Processar pack de animações
     */
    private function process_animation_pack($content_data, $widget_id) {
        $api_data = array(
            'type' => 'animation_pack',
            'animations' => $content_data['animations'],
            'widget_id' => $widget_id,
            'total_files' => count($content_data['files']),
            'total_size' => array_sum(array_column($content_data['files'], 'size'))
        );
        
        return array(
            'success' => true,
            'data' => $api_data
        );
    }
}

// Inicializar detector inteligente
ThreeJS_Smart_Content_Detector::get_instance(); 