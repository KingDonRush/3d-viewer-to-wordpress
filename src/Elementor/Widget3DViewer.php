<?php

namespace ViewerToElementor\Elementor;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;

defined('ABSPATH') || exit;

/**
 * Widget Elementor — 3D Viewer
 * Mantém campos independentes: model_url (manual) e model_file (selecionado).
 */
class Widget3DViewer extends Widget_Base
{
    public function get_name(): string
    {
        return 'viewer-to-elementor';
    }

    public function get_title(): string
    {
        return esc_html__('3D Viewer', '3d-viewer-to-elementor');
    }

    public function get_icon(): string
    {
        return 'eicon-cube';
    }

    public function get_categories(): array
    {
        return ['general'];
    }

    public function has_widget_inner_wrapper(): bool
    {
        return false;
    }

    protected function register_controls(): void
    {
        /**
         * 🧩 Seção: Fonte do Modelo
         */
        $this->start_controls_section('content_section', [
            'label' => esc_html__('Modelo 3D', '3d-viewer-to-elementor'),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ]);

        // Campo manual / dinâmico de URL
        $this->add_control('model_url', [
            'label'       => esc_html__('URL do Modelo (.zip, .glb, .gltf)', '3d-viewer-to-elementor'),
            'type'        => Controls_Manager::TEXT,
            'dynamic'     => ['active' => true],
            'placeholder' => esc_html__('https://exemplo.com/modelo.zip', '3d-viewer-to-elementor'),
            'description' => esc_html__('Cole a URL do modelo ou use Dynamic Tags (ACF, JetEngine, etc.)', '3d-viewer-to-elementor'),
            'default'     => '',
        ]);

        $this->add_control('model_file', [
            'label'       => esc_html__('Arquivo da Biblioteca', '3d-viewer-to-elementor'),
            'type'        => 'viewer_media',
            'label_block' => true,
            'default'     => '',
        ]);

        $this->end_controls_section();

        /**
         * ⚙️ Seção: Configurações de visualização
         */
        $this->start_controls_section('settings_section', [
            'label' => esc_html__('Configurações de Visualização', '3d-viewer-to-elementor'),
            'tab'   => Controls_Manager::TAB_CONTENT,
        ]);

        $this->add_control('auto_rotation', [
            'label'        => esc_html__('Rotação automática', '3d-viewer-to-elementor'),
            'type'         => Controls_Manager::SWITCHER,
            'label_on'     => esc_html__('Sim', '3d-viewer-to-elementor'),
            'label_off'    => esc_html__('Não', '3d-viewer-to-elementor'),
            'return_value' => 'yes',
            'default'      => 'yes',
        ]);

        $this->add_control('mouse_controls', [
            'label'        => esc_html__('Controles orbitais (mouse)', '3d-viewer-to-elementor'),
            'type'         => Controls_Manager::SWITCHER,
            'label_on'     => esc_html__('Ativo', '3d-viewer-to-elementor'),
            'label_off'    => esc_html__('Desativado', '3d-viewer-to-elementor'),
            'return_value' => 'yes',
            'default'      => 'yes',
        ]);

        $this->add_control('background_color', [
            'label'       => esc_html__('Cor de fundo', '3d-viewer-to-elementor'),
            'type'        => Controls_Manager::COLOR,
            'default'     => '#f0f0f0',
            'render_type' => 'template',
            'selectors'   => [
                '{{WRAPPER}} .viewer-container' => 'background-color: {{VALUE}};',
            ],
        ]);

        $this->add_control('canvas_height', [
            'label'      => esc_html__('Altura do Canvas', '3d-viewer-to-elementor'),
            'type'       => Controls_Manager::SLIDER,
            'size_units' => ['px', 'vh'],
            'range'      => [
                'px' => ['min' => 200, 'max' => 800, 'step' => 10],
                'vh' => ['min' => 20, 'max' => 100, 'step' => 5],
            ],
            'default'   => ['unit' => 'px', 'size' => 400],
            'selectors' => [
                '{{WRAPPER}} .viewer-container' => 'height: {{SIZE}}{{UNIT}};',
            ],
        ]);

        $this->end_controls_section();
    }

    /**
     * Renderização no front-end
     */
    protected function render(): void
    {
        $settings = $this->get_settings_for_display();

        $model_url = '';

        if (!empty($settings['model_file'])) {
            $model_url = $settings['model_file'];
        } elseif (!empty($settings['model_url'])) {
            $model_url = $settings['model_url'];
        }

        if (empty($model_url)) {
            echo '<div class="viewer-container" style="min-height:200px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;border-radius:8px;">';
            echo '<p style="color:#666;margin:0;">' . esc_html__('Selecione um modelo 3D (.zip/.glb/.gltf).', '3d-viewer-to-elementor') . '</p>';
            echo '</div>';
            return;
        }

        $widget_id = 'viewer-' . $this->get_id();

        $viewer_data = [
            'widget_id'        => $widget_id,
            'model_url'        => esc_url($model_url),
            'auto_rotation'    => $settings['auto_rotation'] === 'yes',
            'mouse_controls'   => $settings['mouse_controls'] === 'yes',
            'background_color' => $settings['background_color'] ?? '#f0f0f0',
        ];
        ?>
        <div class="viewer-container" id="<?php echo esc_attr($widget_id); ?>"
             data-viewer-config='<?php echo esc_attr(wp_json_encode($viewer_data)); ?>'>
            <div class="viewer-loading">
                <div class="viewer-spinner"></div>
                <div class="viewer-loading-text"><?php echo esc_html__('Carregando modelo 3D...', '3d-viewer-to-elementor'); ?></div>
            </div>
            <canvas class="viewer-canvas"></canvas>
        </div>
        <?php
    }

    protected function content_template(): void
    {
        ?>
        <#
        const rawModelUrl = settings.model_file || settings.model_url || '';
        const modelUrl = typeof rawModelUrl === 'object'
            ? (rawModelUrl.url || rawModelUrl.value || '')
            : rawModelUrl;

        if (!modelUrl) {
            #>
            <div class="viewer-container"
                 style="min-height:200px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;border-radius:8px;">
                <p style="color:#666;margin:0;"><?php echo esc_html__('Selecione um modelo 3D (.zip/.glb/.gltf).', '3d-viewer-to-elementor'); ?></p>
            </div>
            <#
            return;
        }

        const widgetId = 'viewer-' + view.getID();
        const viewerData = {
            widget_id: widgetId,
            model_url: String(modelUrl),
            auto_rotation: settings.auto_rotation === 'yes',
            mouse_controls: settings.mouse_controls === 'yes',
            background_color: settings.background_color || '#f0f0f0'
        };

        view.addRenderAttribute('viewer-container', {
            class: 'viewer-container',
            id: widgetId,
            'data-viewer-config': JSON.stringify(viewerData)
        });
        #>
        <div {{{ view.getRenderAttributeString('viewer-container') }}}>
            <div class="viewer-loading">
                <div class="viewer-spinner"></div>
                <div class="viewer-loading-text"><?php echo esc_html__('Carregando modelo 3D...', '3d-viewer-to-elementor'); ?></div>
            </div>
            <canvas class="viewer-canvas"></canvas>
        </div>
        <?php
    }
}
