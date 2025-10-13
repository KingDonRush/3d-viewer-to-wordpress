<?php
if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

/**
 * Elementor 3D Viewer Widget.
 *
 * Elementor widget that displays 3D models from ZIP files using Three.js.
 *
 * @since 1.0.0
 */
class ThreeJS_Elementor_Widget extends \Elementor\Widget_Base {
    
    /**
     * Get widget name.
     *
     * Retrieve 3D Viewer widget name.
     *
     * @since 1.0.0
     * @access public
     * @return string Widget name.
     */
    public function get_name(): string {
        return 'threejs-viewer';
    }

    /**
     * Get widget title.
     *
     * Retrieve 3D Viewer widget title.
     *
     * @since 1.0.0
     * @access public
     * @return string Widget title.
     */
    public function get_title(): string {
        return esc_html__('3D Viewer', 'threejs-elementor-viewer');
    }

    /**
     * Get widget icon.
     *
     * Retrieve 3D Viewer widget icon.
     *
     * @since 1.0.0
     * @access public
     * @return string Widget icon.
     */
    public function get_icon(): string {
        return 'eicon-cube';
    }

    /**
     * Get widget categories.
     *
     * Retrieve the list of categories the 3D Viewer widget belongs to.
     *
     * @since 1.0.0
     * @access public
     * @return array Widget categories.
     */
    public function get_categories(): array {
        return ['general'];
    }

    /**
     * Get widget keywords.
     *
     * Retrieve the list of keywords the 3D Viewer widget belongs to.
     *
     * @since 1.0.0
     * @access public
     * @return array Widget keywords.
     */
    public function get_keywords(): array {
        return ['3d', 'viewer', 'model', 'threejs', 'glb', 'gltf'];
    }

    /**
     * Get custom help URL.
     *
     * Retrieve a URL where the user can get more information about the widget.
     *
     * @since 1.0.0
     * @access public
     * @return string Widget help URL.
     */
    public function get_custom_help_url(): string {
        return 'https://developers.elementor.com/docs/widgets/';
    }

    /**
     * Whether the widget requires inner wrapper.
     *
     * Determine whether to optimize the DOM size.
     *
     * @since 1.0.0
     * @access public
     * @return bool Whether to optimize the DOM size.
     */
    public function has_widget_inner_wrapper(): bool {
        return false;
    }

    /**
     * Whether the element returns dynamic content.
     *
     * Determine whether to cache the element output or not.
     *
     * @since 1.0.0
     * @access protected
     * @return bool Whether to cache the element output.
     */
    protected function is_dynamic_content(): bool {
        return false;
    }
    
    /**
     * Register 3D Viewer widget controls.
     *
     * Add input fields to allow the user to customize the widget settings.
     *
     * @since 1.0.0
     * @access protected
     */
    protected function register_controls(): void {
        // Seção de Conteúdo
        $this->start_controls_section(
            'content_section',
            [
                'label' => esc_html__('Conteúdo', 'threejs-elementor-viewer'),
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );
        
        $this->add_control(
            'model_file',
            [
                'label' => esc_html__('Modelo 3D (.zip)', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::MEDIA,
                'dynamic' => [
                    'active' => true,
                ],
                'description' => esc_html__('Selecione um arquivo .zip contendo o modelo .glb/.gltf', 'threejs-elementor-viewer'),
            ]
        );
        
        $this->add_control(
            'model_url',
            [
                'label' => esc_html__('URL do Modelo (Alternativo)', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::TEXT,
                'dynamic' => [
                    'active' => true,
                ],
                'placeholder' => esc_html__('https://exemplo.com/modelo.zip ou https://exemplo.com/modelo.glb', 'threejs-elementor-viewer'),
                'description' => esc_html__('URL externa do arquivo .zip, .glb ou .gltf (use se não selecionar arquivo acima)', 'threejs-elementor-viewer'),
                'condition' => [
                    'model_file[url]' => '',
                ],
            ]
        );
        
        // API Settings
        $this->add_control(
            'api_section',
            [
                'label' => esc_html__('API Externa', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );
        
        $this->add_control(
            'upload_to_api',
            [
                'label' => esc_html__('Enviar para API Externa', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
                'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
                'return_value' => 'yes',
                'default' => '',
                'description' => esc_html__('Enviar modelo automaticamente para API externa quando carregado', 'threejs-elementor-viewer'),
            ]
        );
        
        $this->add_control(
            'api_endpoint',
            [
                'label' => esc_html__('Endpoint da API', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::TEXT,
                'placeholder' => esc_html__('https://api.exemplo.com/upload', 'threejs-elementor-viewer'),
                'description' => esc_html__('URL da API para onde enviar o modelo', 'threejs-elementor-viewer'),
                'condition' => [
                    'upload_to_api' => 'yes',
                ],
            ]
        );
        
        $this->add_control(
            'api_key',
            [
                'label' => esc_html__('Chave da API', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::TEXT,
                'placeholder' => esc_html__('sua_chave_api_aqui', 'threejs-elementor-viewer'),
                'description' => esc_html__('Chave de autenticação para a API (opcional)', 'threejs-elementor-viewer'),
                'condition' => [
                    'upload_to_api' => 'yes',
                ],
            ]
        );
        
        $this->end_controls_section();
        
        // Seção de Configurações
        $this->start_controls_section(
            'settings_section',
            [
                'label' => esc_html__('Configurações', 'threejs-elementor-viewer'),
                'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
            ]
        );
        
        $this->add_control(
            'idle_animation',
            [
                'label' => esc_html__('Animação Idle', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SELECT,
                'default' => 'idle1',
                'options' => [
                    'idle1' => esc_html__('Idle 1 - Rotação Suave', 'threejs-elementor-viewer'),
                    'idle2' => esc_html__('Idle 2 - Flutuação', 'threejs-elementor-viewer'),
                    'idle3' => esc_html__('Idle 3 - Rotação + Pulsação', 'threejs-elementor-viewer'),
                ],
            ]
        );
        
        $this->add_control(
            'auto_rotation',
            [
                'label' => esc_html__('Rotação Automática', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
                'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
                'return_value' => 'yes',
                'default' => 'yes',
            ]
        );
        
        $this->add_control(
            'mouse_zoom',
            [
                'label' => esc_html__('Zoom do Mouse', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
                'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
                'return_value' => 'yes',
                'default' => 'yes',
            ]
        );
        
        $this->add_control(
            'mouse_controls',
            [
                'label' => esc_html__('Controles Orbitais', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
                'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
                'return_value' => 'yes',
                'default' => 'yes',
            ]
        );
        
        $this->add_control(
            'background_color',
            [
                'label' => esc_html__('Cor de Fundo', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::COLOR,
                'default' => '#f0f0f0',
                'selectors' => [
                    '{{WRAPPER}} .threejs-viewer-container' => 'background-color: {{VALUE}};',
                ],
            ]
        );
        
        $this->add_control(
            'canvas_height',
            [
                'label' => esc_html__('Altura do Canvas', 'threejs-elementor-viewer'),
                'type' => \Elementor\Controls_Manager::SLIDER,
                'size_units' => ['px', 'vh'],
                'range' => [
                    'px' => [
                        'min' => 200,
                        'max' => 800,
                        'step' => 10,
                    ],
                    'vh' => [
                        'min' => 20,
                        'max' => 100,
                        'step' => 5,
                    ],
                ],
                'default' => [
                    'unit' => 'px',
                    'size' => 400,
                ],
                'selectors' => [
                    '{{WRAPPER}} .threejs-viewer-container' => 'height: {{SIZE}}{{UNIT}};',
                ],
            ]
        );
        
        // Performance Settings
        $this->add_control(
            'performance_section',
            [
                'label' => esc_html__('Performance Settings', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::HEADING,
                'separator' => 'before',
            ]
        );

        $this->add_control(
            'antialias',
            [
                'label' => esc_html__('Antialiasing', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Enable', '3d-viewer-to-wordpress'),
                'label_off' => esc_html__('Disable', '3d-viewer-to-wordpress'),
                'return_value' => 'yes',
                'default' => 'yes',
                'description' => esc_html__('Improves visual quality but may impact performance', '3d-viewer-to-wordpress'),
            ]
        );

        $this->add_control(
            'shadows',
            [
                'label' => esc_html__('Shadows', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Enable', '3d-viewer-to-wordpress'),
                'label_off' => esc_html__('Disable', '3d-viewer-to-wordpress'),
                'return_value' => 'yes',
                'default' => 'yes',
                'description' => esc_html__('Realistic shadows (may impact performance)', '3d-viewer-to-wordpress'),
            ]
        );

        $this->add_control(
            'additional_lighting',
            [
                'label' => esc_html__('Additional Lighting', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Enable', '3d-viewer-to-wordpress'),
                'label_off' => esc_html__('Disable', '3d-viewer-to-wordpress'),
                'return_value' => 'yes',
                'default' => 'yes',
                'description' => esc_html__('Extra lighting for better visual quality', '3d-viewer-to-wordpress'),
            ]
        );

        $this->add_control(
            'show_stats',
            [
                'label' => esc_html__('Show Performance Stats', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Show', '3d-viewer-to-wordpress'),
                'label_off' => esc_html__('Hide', '3d-viewer-to-wordpress'),
                'return_value' => 'yes',
                'default' => '',
                'description' => esc_html__('Display FPS and performance metrics (debug mode)', '3d-viewer-to-wordpress'),
            ]
        );

        $this->add_control(
            'debug_performance',
            [
                'label' => esc_html__('Debug Performance', '3d-viewer-to-wordpress'),
                'type' => \Elementor\Controls_Manager::SWITCHER,
                'label_on' => esc_html__('Enable', '3d-viewer-to-wordpress'),
                'label_off' => esc_html__('Disable', '3d-viewer-to-wordpress'),
                'return_value' => 'yes',
                'default' => '',
                'description' => esc_html__('Log performance metrics to console', '3d-viewer-to-wordpress'),
            ]
        );

        // Animation Settings
        $this->end_controls_section();
    }
    
    /**
     * Render 3D Viewer widget output on the frontend.
     *
     * Written in PHP and used to generate the final HTML.
     *
     * @since 1.0.0
     * @access protected
     */
    protected function render(): void {
        $settings = $this->get_settings_for_display();

        // Determinar a URL do modelo
        $model_url = '';
        
        // Primeiro, verificar se há um arquivo de mídia selecionado
        if (!empty($settings['model_file']['url'])) {
            $model_url = $settings['model_file']['url'];
        } 
        // Se não houver arquivo de mídia, usar a URL externa
        elseif (!empty($settings['model_url'])) {
            $model_url = $settings['model_url'];
        }
        
        // Se não houver nenhuma URL, mostrar mensagem
        if (empty($model_url)) {
            echo '<div class="threejs-viewer-container" style="min-height: 200px; border: 2px dashed #ddd; display: flex; align-items: center; justify-content: center; background-color: #f9f9f9; border-radius: 8px;">';
            echo '<p style="color: #666; text-align: center; margin: 0;">' . esc_html__('Selecione um modelo 3D no painel lateral.', 'threejs-elementor-viewer') . '</p>';
            echo '</div>';
            return;
        }

        // Gerar ID único para o widget
        $widget_id = 'threejs-viewer-' . $this->get_id();
        
        // Preparar dados para o JavaScript
        $viewer_data = array(
            'widget_id' => $widget_id,
            'model_url' => $model_url,
            'idle_animation' => $settings['idle_animation'],
            'auto_rotation' => $settings['auto_rotation'] === 'yes',
            'mouse_zoom' => $settings['mouse_zoom'] === 'yes',
            'mouse_controls' => $settings['mouse_controls'] === 'yes',
            'background_color' => $settings['background_color'],
            // Performance settings
            'antialias' => $settings['antialias'] === 'yes',
            'shadows' => $settings['shadows'] === 'yes',
            'additional_lighting' => $settings['additional_lighting'] === 'yes',
            'show_stats' => $settings['show_stats'] === 'yes',
            'debug_performance' => $settings['debug_performance'] === 'yes',
            // API settings
            'upload_to_api' => $settings['upload_to_api'] === 'yes',
            'api_endpoint' => $settings['api_endpoint'],
            'api_key' => $settings['api_key'],
        );
        
        ?>
        <div class="threejs-viewer-container" id="<?php echo esc_attr($widget_id); ?>" data-viewer-config='<?php echo esc_attr(json_encode($viewer_data)); ?>'>
            <div class="threejs-loading">
                <div class="threejs-spinner"></div>
                <div class="threejs-loading-text"><?php echo esc_html__('Carregando modelo 3D...', 'threejs-elementor-viewer'); ?></div>
            </div>
            <canvas class="threejs-canvas"></canvas>
        </div>
        <?php
    }
    
    /**
     * Render 3D Viewer widget output in the editor.
     *
     * Written as a Backbone JavaScript template and used to generate the live preview.
     *
     * @since 1.0.0
     * @access protected
     */
    protected function content_template(): void {
        ?>
        <div class="threejs-viewer-container" style="min-height: 200px; border: 2px dashed #ddd; display: flex; align-items: center; justify-content: center; background-color: #f9f9f9; border-radius: 8px;">
            <p style="color: #666; text-align: center; margin: 0;"><?php echo esc_html__('3D Viewer - Selecione um modelo 3D no painel lateral.', 'threejs-elementor-viewer'); ?></p>
        </div>
        <?php
    }
} 