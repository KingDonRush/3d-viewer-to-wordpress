/**
 * Elementor control for selecting a supported 3D model from the Media Library.
 */
(function ($) {
  const CONTROL_TYPE = 'viewer_media';

  const MEDIA_TYPES = [
    'application/zip',
    'application/x-zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
    'model/gltf-binary',
    'model/gltf+json'
  ];

  let registered = false;

  function registerControl() {
    if (registered) {
      return;
    }

    const editor = window.elementor;
    const BaseData = editor?.modules?.controls?.BaseData;

    if (!editor?.addControlView || !BaseData || !window.wp?.media) {
      return;
    }

    const ControlView = BaseData.extend({
      template: '#tmpl-elementor-control-viewer_media-content',

      ui() {
        return {
          button: '.viewer-media-button',
          clear: '.viewer-media-clear',
          selected: '.viewer-media-selected',
          status: '.viewer-media-status',
          spinner: '.viewer-media-spinner'
        };
      },

      events() {
        return {
          'click @ui.button': 'onPickMedia',
          'click @ui.clear': 'onClearSelection'
        };
      },

      initialize() {
        BaseData.prototype.initialize.apply(this, arguments);
        this.attachment = null;
      },

      onReady() {
        this.renderSelected();
        this.renderClearState();
      },

      onValueChange() {
        if (!this.getControlValue()) {
          this.attachment = null;
        }

        this.renderSelected();
        this.renderClearState();
      },

      getFrame() {
        if (this.frame) {
          return this.frame;
        }

        this.frame = window.wp.media({
          title: editor.translate('select_image', 'Selecionar arquivo 3D'),
          button: { text: editor.translate('insert_media', 'Usar arquivo') },
          multiple: false,
          library: { type: MEDIA_TYPES }
        });

        this.frame.on('open', () => this.setLoading(true));
        this.frame.on('close', () => this.setLoading(false));
        this.frame.on('select', () => {
          const attachment = this.frame.state().get('selection').first()?.toJSON();
          const url = attachment?.url || '';

          this.attachment = attachment || null;
          this.setValue(url);
          this.renderSelected();
          this.renderClearState();
        });

        return this.frame;
      },

      onPickMedia(event) {
        event.preventDefault();
        this.getFrame().open();
      },

      onClearSelection(event) {
        event.preventDefault();
        this.attachment = null;
        this.setValue('');
        this.renderSelected();
        this.renderClearState();
      },

      setLoading(isLoading) {
        const active = Boolean(isLoading);
        this.$el.toggleClass('viewer-media-loading', active);
        this.ui.button.toggleClass('viewer-media-button-loading', active);
        this.ui.spinner.toggleClass('is-visible', active);
      },

      renderSelected() {
        if (!this.ui.selected.length) {
          return;
        }

        const value = this.getControlValue() || '';
        this.ui.selected.empty().removeClass('is-empty');
        this.ui.status.text('').removeClass('viewer-media-status-active');

        if (!value) {
          const placeholder =
            this.model.get('placeholder') ||
            editor.translate('no_image_selected', 'Nenhum arquivo selecionado.');

          this.ui.selected.text(placeholder).addClass('is-empty');
          return;
        }

        const filename = this.attachment?.filename || this.getFilename(value);
        const displayName = filename || value;

        this.ui.selected.append($('<strong>').text(displayName));
        if (displayName !== value) {
          this.ui.selected.append(
            $('<span>', { class: 'viewer-media-path' }).text(value)
          );
        }

        const mime =
          this.attachment?.mime ||
          this.attachment?.type ||
          this.attachment?.subtype ||
          editor.translate('selected', 'Arquivo selecionado');

        this.ui.status
          .text(mime)
          .addClass('viewer-media-status-active');
      },

      renderClearState() {
        this.ui.clear.toggleClass('is-visible', Boolean(this.getControlValue()));
      },

      getFilename(value) {
        try {
          const pathname = new URL(value, window.location.href).pathname;
          return decodeURIComponent(pathname.split('/').pop() || '');
        } catch (error) {
          return String(value).split('/').pop() || '';
        }
      }
    });

    editor.addControlView(CONTROL_TYPE, ControlView);
    registered = true;
  }

  if (window.elementor?.addControlView) {
    registerControl();
  } else {
    $(window).on('elementor:init', registerControl);
  }

  const styleId = 'viewer-media-control-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .viewer-media-control {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 4px;
      }
      .viewer-media-control:hover {
        border-color: rgba(255, 255, 255, 0.12);
      }
      .viewer-media-control .viewer-media-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .viewer-media-control .viewer-media-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .viewer-media-control .viewer-media-button.viewer-media-button-loading,
      .viewer-media-control.viewer-media-loading {
        opacity: 0.7;
      }
      .viewer-media-control .viewer-media-button .eicon-upload {
        font-size: 14px;
      }
      .viewer-media-control .viewer-media-button .viewer-media-button-text {
        white-space: nowrap;
      }
      .viewer-media-control .viewer-media-clear {
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .viewer-media-control .viewer-media-clear.is-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .viewer-media-control .viewer-media-spinner {
        display: none;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(0, 0, 0, 0.12);
        border-top-color: var(--e-color-primary, #6d7882);
        border-radius: 50%;
        animation: viewer-media-spin 0.6s linear infinite;
      }
      .viewer-media-control .viewer-media-spinner.is-visible {
        display: inline-block;
      }
      .viewer-media-control .viewer-media-selected {
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--e-color-text, #e6e9ec);
        font-size: 12px;
        word-break: break-word;
      }
      .viewer-media-control .viewer-media-selected.is-empty {
        color: var(--e-color-text-muted, #a3adb7);
        font-style: italic;
      }
      .viewer-media-control .viewer-media-selected strong,
      .viewer-media-control .viewer-media-path {
        display: block;
      }
      .viewer-media-control .viewer-media-selected strong {
        font-weight: 600;
      }
      .viewer-media-control .viewer-media-path {
        margin-top: 2px;
        color: var(--e-color-text-muted, #8f99a4);
        font-size: 11px;
        word-break: break-all;
      }
      .viewer-media-control .viewer-media-status {
        margin-top: -2px;
        color: var(--e-color-text-muted, #8f99a4);
        font-size: 11px;
      }
      .viewer-media-control .viewer-media-status.viewer-media-status-active {
        color: var(--e-color-primary, #6d7882);
      }
      @keyframes viewer-media-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
})(jQuery);
