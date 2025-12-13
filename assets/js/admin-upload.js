/**
 * Viewer Media Control - Elementor custom control com loading e UX melhorada
 */
(function ($, elementor) {
  const CONTROL_TYPE = 'viewer_media';

  const MEDIA_TYPES = [
    'application/zip',
    'application/x-zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
    'model/gltf-binary',
    'model/gltf+json',
    'application/glb',
    'application/json',
    'model/vnd.usdz+zip',
    'model/stl',
    'application/sla',
    'model/vnd.collada+xml',
    'model/obj',
    'application/x-3ds',
    'model/vnd.fbx'
  ];

  const ControlView = elementor.modules.controls.BaseData.extend({
    template: '#tmpl-viewer-media-control',

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
      elementor.modules.controls.BaseData.prototype.initialize.apply(this, arguments);
      this.undoState = null;
      this.isUndoing = false;
      this.elementSettingsModel =
        (typeof this.getElementSettingsModel === 'function'
          ? this.getElementSettingsModel()
          : null) ||
        this.container?.settings ||
        this.parent?.model ||
        null;

      if (this.elementSettingsModel?.on) {
        this.listenTo(this.elementSettingsModel, 'change:model_url', this.onModelUrlChange);
      }

      this.currentMedia = {
        url: this.getControlValue() || '',
        attachment: null
      };
      this.pendingAttachment = null;
    },

    onReady() {
      this.renderSelected();
      this.renderClearState();
    },

    onValueChange() {
      const attachment = this.pendingAttachment || null;
      this.renderSelected(attachment);
      this.renderClearState();

      const currentUrl = this.getControlValue();
      this.currentMedia = {
        url: currentUrl,
        attachment: currentUrl ? (attachment || this.currentMedia.attachment || null) : null
      };

      this.pendingAttachment = null;
    },

    getFrame() {
      if (this.frame) {
        return this.frame;
      }

      this.frame = wp.media({
        title: elementor.translate('select_image', 'Selecionar arquivo 3D'),
        button: { text: elementor.translate('insert_media', 'Usar arquivo') },
        multiple: false,
        library: { type: MEDIA_TYPES }
      });

      this.frame.on('open', () => {
        this.setLoading(true);
      });

      this.frame.on('close', () => {
        this.setLoading(false);
      });

      this.frame.on('select', () => {
        const attachment = this.frame.state().get('selection').first()?.toJSON();
        const url = attachment?.url || '';

        this.pendingAttachment = attachment || null;
        this.undoState = null;

        if (this.elementSettingsModel?.set) {
          this.isUndoing = true;
          this.elementSettingsModel.set('model_url', '');
          this.isUndoing = false;
        }

        this.setValue(url);
        this.currentMedia = { url, attachment: attachment || null };
        this.renderSelected(attachment);
        this.renderClearState();

        elementor.channels.editor.trigger('editor:dirty-state', true);
        elementor.channels.editor.trigger('editor:save:set-state', 'changes_pending');
      });

      return this.frame;
    },

    onPickMedia(event) {
      event.preventDefault();
      this.getFrame().open();
    },

    onClearSelection(event) {
      event.preventDefault();

      if (this.undoState && this.undoState.mediaValue) {
        const mediaValue = this.undoState.mediaValue;
        const mediaAttachment = this.undoState.attachment || null;
        const settingsModel = this.elementSettingsModel;

        if (settingsModel?.set) {
          this.isUndoing = true;
          settingsModel.set('model_url', '');
          this.isUndoing = false;
        }

        this.pendingAttachment = mediaAttachment;
        this.setValue(mediaValue);
        this.currentMedia = { url: mediaValue, attachment: mediaAttachment };
        this.clearUndoState();
        elementor.channels.editor.trigger('editor:dirty-state', true);
        elementor.channels.editor.trigger('editor:save:set-state', 'changes_pending');
        return;
      }

      this.setValue('');
      this.currentMedia = { url: '', attachment: null };
      this.renderSelected();
      this.renderClearState();
      elementor.channels.editor.trigger('editor:dirty-state', true);
    },

    setLoading(isLoading) {
      const active = !!isLoading;
      this.$el.toggleClass('viewer-media-loading', active);
      this.ui.button.toggleClass('viewer-media-button-loading', active);
      this.ui.spinner.toggleClass('is-visible', active);
    },

    renderSelected(attachment) {
      if (!this.ui.selected.length) {
        return;
      }

      const value = this.getControlValue();
      const info = this.getUndoInfo();
      const fileData = attachment || this.currentMedia.attachment || info.attachment || null;

      if (!value) {
        const placeholder = this.model.get('placeholder') || elementor.translate('no_image_selected', 'Nenhum arquivo selecionado.');
        this.ui.selected
          .text(placeholder)
          .addClass('is-empty');

        if (info.cleared) {
          this.ui.status
            .text(elementor.translate('using_custom_url', 'Usando URL / Dynamic Tag do campo.'))
            .addClass('viewer-media-status-active');
        } else {
          this.ui.status.text('').removeClass('viewer-media-status-active');
        }
        return;
      }

      const name = fileData?.filename || value.split('/').pop();
      const displayName = name || value;
      const helper = value !== name ? `<span class="viewer-media-path">${value}</span>` : '';

      this.ui.selected
        .html(`<strong>${displayName}</strong>${helper}`)
        .removeClass('is-empty');

      const mime = fileData?.mime || fileData?.type || fileData?.subtype || '';
      this.ui.status
        .text(mime || elementor.translate('selected', 'Arquivo selecionado'))
        .addClass('viewer-media-status-active');
    },

    renderClearState() {
      const undoInfo = this.getUndoInfo();
      const hasValue = !!this.getControlValue();
      const undoActive = undoInfo.cleared && !!undoInfo.mediaValue;
      const label = undoActive
        ? elementor.translate('undo', 'Desfazer')
        : (this.model.get('clear_label') || elementor.translate('clear', 'Limpar seleção'));

      this.ui.clear
        .toggleClass('is-visible', hasValue || undoActive)
        .toggleClass('viewer-media-undo', undoActive)
        .text(label);
    },

    onModelUrlChange(model, value) {
      if (this.isUndoing) {
        return;
      }

      const normalized = this.normalizeValue(value);
      const currentMedia = this.currentMedia?.url || '';

      if (!normalized) {
        this.clearUndoState();
        return;
      }

      if (!currentMedia) {
        this.undoState = {
          mediaValue: '',
          attachment: null,
          clearedFrom: normalized
        };
        this.renderSelected();
        this.renderClearState();
        return;
      }

      this.undoState = {
        mediaValue: currentMedia,
        attachment: this.currentMedia?.attachment || null,
        clearedFrom: normalized
      };

      this.isUndoing = true;
      this.pendingAttachment = null;
      this.setValue('');
      this.isUndoing = false;

      this.currentMedia = { url: '', attachment: null };
      this.renderSelected();
      this.renderClearState();
    },

    normalizeValue(raw) {
      if (!raw) {
        return '';
      }
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (typeof raw === 'object') {
        if (raw.url || raw.value) {
          return raw.url || raw.value;
        }
        if (raw.tag || raw.id) {
          return raw.tag || raw.id;
        }
        try {
          return JSON.stringify(raw);
        } catch (e) {
          return '';
        }
      }
      return '';
    },

    clearUndoState() {
      this.undoState = null;
      this.renderClearState();
      this.ui.status.text('').removeClass('viewer-media-status-active');
      this.renderSelected();
    },

    getUndoInfo() {
      return {
        cleared: !!(this.undoState && this.undoState.clearedFrom),
        mediaValue: this.undoState?.mediaValue || '',
        attachment: this.undoState?.attachment || null
      };
    }
  });

  const registerControl = () => {
    if (!window.elementor || !window.wp?.media) {
      return;
    }
    elementor.addControlView(CONTROL_TYPE, ControlView);
  };

  if (elementor && elementor.addControlView) {
    registerControl();
  } else {
    $(window).on('elementor:init', registerControl);
  }

  // Injeta template e estilos uma única vez
  if (!document.getElementById('tmpl-viewer-media-control')) {
    const template = document.createElement('script');
    template.type = 'text/html';
    template.id = 'tmpl-viewer-media-control';
    template.innerHTML = `
      <div class="viewer-media-control">
        <div class="viewer-media-actions">
          <button type="button" class="elementor-button elementor-button-secondary viewer-media-button">
            <span class="eicon-upload"></span>
            <span class="viewer-media-button-text">
              {{{ data.button_label || elementor.translate('select_image', 'Selecionar arquivo 3D') }}}
            </span>
            <span class="viewer-media-spinner" aria-hidden="true"></span>
          </button>
          <button type="button" class="elementor-button elementor-button-link viewer-media-clear">
            {{{ data.clear_label || elementor.translate('clear', 'Limpar seleção') }}}
          </button>
        </div>
        <div class="viewer-media-selected">{{{ data.controlValue || data.placeholder || elementor.translate('no_image_selected', 'Nenhum arquivo selecionado.') }}}</div>
        <div class="viewer-media-status"></div>
      </div>
    `;
    document.body.appendChild(template);
  }

  const styleId = 'viewer-media-control-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .viewer-media-control {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        border-radius: 4px;
        background: transparent;
        border: 1px solid rgba(255,255,255,0.07);
      }
      .viewer-media-control:hover {
        border-color: rgba(255,255,255,0.12);
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
      .viewer-media-control .viewer-media-button.viewer-media-button-loading {
        opacity: 0.6;
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
      .viewer-media-control .viewer-media-clear.viewer-media-undo {
        color: var(--e-color-primary,#6d7882);
        font-weight: 500;
      }
      .viewer-media-control .viewer-media-spinner {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(0,0,0,.12);
        border-top-color: var(--e-color-primary,#6d7882);
        animation: viewer-media-spin 0.6s linear infinite;
        display: none;
      }
      .viewer-media-control .viewer-media-spinner.is-visible {
        display: inline-block;
      }
      .viewer-media-control.viewer-media-loading {
        opacity: 0.7;
        pointer-events: none;
      }
      .viewer-media-control .viewer-media-selected {
        font-size: 12px;
        color: var(--e-color-text, #e6e9ec);
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 4px;
        padding: 8px;
        word-break: break-word;
      }
      .viewer-media-control .viewer-media-selected.is-empty {
        color: var(--e-color-text-muted,#a3adb7);
        font-style: italic;
      }
      .viewer-media-control .viewer-media-selected strong {
        display: block;
        font-weight: 600;
      }
      .viewer-media-control .viewer-media-selected .viewer-media-path {
        display: block;
        margin-top: 2px;
        font-size: 11px;
        color: var(--e-color-text-muted,#8f99a4);
        word-break: break-all;
      }
      .viewer-media-control .viewer-media-status {
        font-size: 11px;
        color: var(--e-color-text-muted,#8f99a4);
        margin-top: -2px;
      }
      .viewer-media-control .viewer-media-status.viewer-media-status-active {
        color: var(--e-color-primary,#6d7882);
      }
      @keyframes viewer-media-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
})(jQuery, window.elementor || {});
