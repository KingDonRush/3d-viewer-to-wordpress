<?php
if (!defined('ABSPATH')) {
    exit;
}

class ThreeJS_Elementor_Widget extends \Elementor\Widget_Base {

    public function get_name(): string {
        return 'threejs-viewer';
    }

    public function get_title(): string {
        return esc_html__('3D Viewer', 'threejs-elementor-viewer');
    }

    public function get_icon(): string {
        return 'eicon-cube';
    }

    public function get_categories(): array {
        return ['general'];
    }

    public function get_keywords(): array {
        return ['3d', 'viewer', 'model', 'threejs', 'glb', 'gltf'];
    }

    public function get_custom_help_url(): string {
        return 'https://developers.elementor.com/docs/widgets/';
    }

    public function has_widget_inner_wrapper(): bool {
        return false;
    }

    protected function is_dynamic_content(): bool {
        return false;
    }

    protected function register_controls(): void {
        $this->start_controls_section('content_section', [
            'label' => esc_html__('Conteúdo', 'threejs-elementor-viewer'),
            'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
        ]);

        $this->add_control('model_file', [
            'label' => esc_html__('Modelo 3D (.zip)', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::MEDIA,
            'dynamic' => ['active' => true],
            'description' => esc_html__('Selecione um arquivo .zip contendo o modelo .glb/.gltf', 'threejs-elementor-viewer'),
        ]);

        $this->add_control('model_url', [
            'label' => esc_html__('URL do Modelo (Alternativo)', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::TEXT,
            'dynamic' => ['active' => true],
            'placeholder' => esc_html__('https://exemplo.com/modelo.zip ou https://exemplo.com/modelo.glb', 'threejs-elementor-viewer'),
            'description' => esc_html__('URL externa do arquivo .zip, .glb ou .gltf (use se não selecionar arquivo acima)', 'threejs-elementor-viewer'),
            'condition' => ['model_file[url]' => ''],
        ]);

        $this->end_controls_section();

        $this->start_controls_section('settings_section', [
            'label' => esc_html__('Configurações', 'threejs-elementor-viewer'),
            'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
        ]);

        $this->add_control('idle_animation', [
            'label' => esc_html__('Animação Idle', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SELECT,
            'default' => 'idle1',
            'options' => [
                'idle1' => esc_html__('Idle 1 - Rotação Suave', 'threejs-elementor-viewer'),
                'idle2' => esc_html__('Idle 2 - Flutuação', 'threejs-elementor-viewer'),
                'idle3' => esc_html__('Idle 3 - Rotação + Pulsação', 'threejs-elementor-viewer'),
            ],
        ]);

        $this->add_control('auto_rotation', [
            'label' => esc_html__('Rotação Automática', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('mouse_zoom', [
            'label' => esc_html__('Zoom do Mouse', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('mouse_controls', [
            'label' => esc_html__('Controles Orbitais', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Sim', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Não', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('background_color', [
            'label' => esc_html__('Cor de Fundo', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::COLOR,
            'default' => '#f0f0f0',
            'selectors' => [
                '{{WRAPPER}} .threejs-viewer-container' => 'background-color: {{VALUE}};',
            ],
        ]);

        $this->add_control('canvas_height', [
            'label' => esc_html__('Altura do Canvas', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SLIDER,
            'size_units' => ['px', 'vh'],
            'range' => [
                'px' => ['min' => 200, 'max' => 800, 'step' => 10],
                'vh' => ['min' => 20, 'max' => 100, 'step' => 5],
            ],
            'default' => ['unit' => 'px', 'size' => 400],
            'selectors' => [
                '{{WRAPPER}} .threejs-viewer-container' => 'height: {{SIZE}}{{UNIT}};',
            ],
        ]);

        $this->add_control('performance_section', [
            'label' => esc_html__('Performance Settings', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::HEADING,
            'separator' => 'before',
        ]);

        $this->add_control('antialias', [
            'label' => esc_html__('Antialiasing', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Enable', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Disable', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('shadows', [
            'label' => esc_html__('Shadows', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Enable', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Disable', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('additional_lighting', [
            'label' => esc_html__('Additional Lighting', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Enable', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Disable', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => 'yes',
        ]);

        $this->add_control('show_stats', [
            'label' => esc_html__('Show Performance Stats', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Show', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Hide', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => '',
        ]);

        $this->add_control('debug_performance', [
            'label' => esc_html__('Debug Performance', 'threejs-elementor-viewer'),
            'type' => \Elementor\Controls_Manager::SWITCHER,
            'label_on' => esc_html__('Enable', 'threejs-elementor-viewer'),
            'label_off' => esc_html__('Disable', 'threejs-elementor-viewer'),
            'return_value' => 'yes',
            'default' => '',
        ]);

        $this->end_controls_section();
    }

    protected function render(): void {
        $settings = $this->get_settings_for_display();

        $model_url = $settings['model_file']['url'] ?? $settings['model_url'] ?? '';

        if (empty($model_url)) {
            echo '<div class="threejs-viewer-container" style="min-height:200px;border:2px dashed #ddd;display:flex;align-items:center;justify-content:center;background:#f9f9f9;border-radius:8px;">';
            echo '<p style="color:#666;margin:0;">' . esc_html__('Selecione um modelo 3D no painel lateral.', 'threejs-elementor-viewer') . '</p>';
            echo '</div>';
            return;
        }

        $widget_id = 'threejs-viewer-' . $this->get_id();

        $viewer_data = [
            'widget_id' => $widget_id,
            'model_url' => $model_url,
            'idle_animation' => $settings['idle_animation'],
            'auto_rotation' => $settings['auto_rotation'] === 'yes',
            'mouse_zoom' => $settings['mouse_zoom'] === 'yes',
            'mouse_controls' => $settings['mouse_controls'] === 'yes',
            'background_color' => $settings['background_color'],
            'antialias' => $settings['antialias'] === 'yes',
            'shadows' => $settings['shadows'] === 'yes',
            'additional_lighting' => $settings['additional_lighting'] === 'yes',
            'show_stats' => $settings['show_stats'] === 'yes',
            'debug_performance' => $settings['debug_performance'] === 'yes',
        ];
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

    protected function content_template(): void {
        ?>
        <div class="threejs-viewer-container" style="min-height:200px;border:2px dashed #ddd;display:flex;align-items:center;justify-content:center;background:#f9f9f9;border-radius:8px;">
            <p style="color:#666;margin:0;"><?php echo esc_html__('3D Viewer - Selecione um modelo 3D no painel lateral.', 'threejs-elementor-viewer'); ?></p>
        </div>
        <?php
    }
}
