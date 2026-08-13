<?php

namespace ViewerToElementor\Elementor\Controls;

use Elementor\Base_Data_Control;

if (!defined('ABSPATH')) {
    exit;
}

class ViewerMediaControl extends Base_Data_Control
{
    public function get_type()
    {
        return 'viewer_media';
    }

    public function get_default_value()
    {
        return '';
    }

    public function get_default_settings()
    {
        return [
            'label_block'   => true,
            'button_label'  => esc_html__('Escolher arquivo 3D', '3d-viewer-to-elementor'),
            'clear_label'   => esc_html__('Limpar seleção', '3d-viewer-to-elementor'),
            'placeholder'   => esc_html__('Nenhum arquivo selecionado.', '3d-viewer-to-elementor'),
        ];
    }

    public function enqueue()
    {
        // Script já enfileirado via Enqueue::enqueue_admin_scripts
    }

    protected function get_default_data()
    {
        $data = parent::get_default_data();
        $data['button_label'] = $this->get_settings('button_label');
        $data['clear_label']  = $this->get_settings('clear_label');
        $data['placeholder']  = $this->get_settings('placeholder');
        return $data;
    }

    public function content_template()
    {
        ?>
        <div class="viewer-media-control">
            <div class="viewer-media-actions">
                <button type="button" class="elementor-button elementor-button-secondary viewer-media-button">
                    <span class="eicon-upload" aria-hidden="true"></span>
                    <span class="viewer-media-button-text">{{ data.button_label }}</span>
                    <span class="viewer-media-spinner" aria-hidden="true"></span>
                </button>
                <button type="button" class="elementor-button elementor-button-link viewer-media-clear">
                    {{ data.clear_label }}
                </button>
            </div>
            <div class="viewer-media-selected">{{ data.placeholder }}</div>
            <div class="viewer-media-status" aria-live="polite"></div>
        </div>
        <?php
    }
}
