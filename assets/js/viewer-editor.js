/**
 * Elementor editor integration for the 3D viewer.
 */
import {
    VIEWER_SELECTOR,
    initAll,
    collectContainersFromNode,
    initialiseContainer,
    teardownContainer,
    viewerInstances,
    parseConfig
} from './viewer-core.js';

let observerStarted = false;
let elementorInitHandled = false;
let elementorHooksRegistered = false;
let elementorHandlerRegistered = false;

function startObserver() {
    if (observerStarted || typeof MutationObserver === 'undefined') {
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                const targetNode = mutation.target;
                if (
                    targetNode instanceof HTMLElement &&
                    targetNode.matches(VIEWER_SELECTOR) &&
                    (mutation.attributeName === 'data-viewer-config' ||
                        mutation.attributeName === 'data-settings' ||
                        mutation.attributeName === 'data-elementor-settings')
                ) {
                    initialiseContainer(targetNode, { force: true });
                }
                continue;
            }

            mutation.removedNodes.forEach?.((node) => {
                collectContainersFromNode(node).forEach((container) => {
                    teardownContainer(container);
                });
            });

            mutation.addedNodes.forEach?.((node) => {
                collectContainersFromNode(node).forEach((container) => {
                    initialiseContainer(container);
                });
            });
        }
    });

    observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true
    });

    observerStarted = true;
}

function runWhenReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

function configFromElementorSettings(settings = {}, container = null, fallback = null) {
    const safeFallback = fallback || {};

    if (!settings || typeof settings !== 'object') {
        return { ...safeFallback };
    }

    const cleanString = (value) =>
        typeof value === 'string' ? value.trim() : '';

    const extractUrl = (value) => {
        if (!value) {
            return '';
        }
        if (typeof value === 'string') {
            return value.trim();
        }
        if (typeof value === 'object') {
            if (typeof value.url === 'string') {
                return value.url.trim();
            }
            if (typeof value.value === 'string') {
                return value.value.trim();
            }
            if (typeof value.id === 'string') {
                return value.id.trim();
            }
        }
        return '';
    };

    const hasOwn = (obj, key) =>
        obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);

    const modelFileRaw =
        settings.model_file ??
        settings?.settings?.model_file ??
        settings?.attributes?.model_file;
    const modelUrlRaw =
        settings.model_url ??
        settings?.settings?.model_url ??
        settings?.attributes?.model_url;

    const dynamicObj =
        settings.__dynamic__ ||
        settings?.settings?.__dynamic__ ||
        settings?.attributes?.__dynamic__ ||
        {};

    const modelFile = extractUrl(modelFileRaw);
    const modelUrl = extractUrl(modelUrlRaw);
    const dynamicUrl = extractUrl(dynamicObj.model_url);

    const explicitClear =
        (hasOwn(settings, 'model_file') ||
            hasOwn(settings, 'model_url') ||
            hasOwn(dynamicObj, 'model_url') ||
            hasOwn(settings?.settings || {}, 'model_file') ||
            hasOwn(settings?.settings || {}, 'model_url') ||
            hasOwn(settings?.attributes || {}, 'model_file') ||
            hasOwn(settings?.attributes || {}, 'model_url')) &&
        !modelFile &&
        !modelUrl &&
        !dynamicUrl;

    const resolveSwitch = (value, fallbackValue) => {
        if (value === 'yes' || value === true) {
            return true;
        }
        if (value === 'no' || value === false) {
            return false;
        }
        return fallbackValue;
    };

    const resolvedUrl = explicitClear
        ? ''
        : modelFile ||
          modelUrl ||
          dynamicUrl ||
          safeFallback.model_url ||
          '';

    const backgroundRaw =
        settings.background_color ??
        settings?.settings?.background_color ??
        settings?.attributes?.background_color ??
        safeFallback.background_color;

    return {
        widget_id: container?.id || safeFallback.widget_id || '',
        model_url: resolvedUrl,
        auto_rotation: resolveSwitch(
            settings.auto_rotation ??
                settings?.settings?.auto_rotation ??
                settings?.attributes?.auto_rotation,
            safeFallback.auto_rotation ?? true
        ),
        mouse_controls: resolveSwitch(
            settings.mouse_controls ??
                settings?.settings?.mouse_controls ??
                settings?.attributes?.mouse_controls,
            safeFallback.mouse_controls ?? true
        ),
        background_color: cleanString(backgroundRaw) || '#f0f0f0',
        antialias: resolveSwitch(
            settings.antialias ??
                settings?.settings?.antialias ??
                settings?.attributes?.antialias,
            safeFallback.antialias ?? true
        ),
        shadows: resolveSwitch(
            settings.shadows ??
                settings?.settings?.shadows ??
                settings?.attributes?.shadows,
            safeFallback.shadows ?? true
        )
    };
}

function registerElementorHandler() {
    if (elementorHandlerRegistered) {
        return true;
    }

    const frontend = window.elementorFrontend;
    const modules = window.elementorModules;
    const BaseHandler = modules?.frontend?.handlers?.Base;

    if (!frontend || !frontend.elementsHandler || !BaseHandler) {
        return false;
    }

    class ViewerWidgetHandler extends BaseHandler {
        getDefaultSettings() {
            return {
                selectors: {
                    container: VIEWER_SELECTOR
                }
            };
        }

        getViewerContainer() {
            const selector = this.getSettings('selectors').container;
            const $element = this.findElement(selector);
            return $element?.length ? $element.get(0) : null;
        }

        onInit(...args) {
            if (typeof super.onInit === 'function') {
                super.onInit(...args);
            }
            this.mountViewer(true);
        }

        onDestroy(...args) {
            this.unmountViewer();
            if (typeof super.onDestroy === 'function') {
                super.onDestroy(...args);
            }
        }

        onElementChange(propertyName) {
            const watchedProps = [
                'model_url',
                'model_file',
                'auto_rotation',
                'mouse_controls',
                'background_color'
            ];

            if (watchedProps.includes(propertyName)) {
                this.mountViewer(true);
            }
        }

        mountViewer(force = false) {
            const container = this.getViewerContainer();
            if (!container) {
                return;
            }

            const currentConfig = parseConfig(container) || {};
            const settings = this.getElementSettings ? this.getElementSettings() : {};
            const config = configFromElementorSettings(settings, container, currentConfig);

            if (!config.model_url) {
                container.removeAttribute('data-viewer-config');
                try {
                    delete container.dataset.viewerConfig;
                } catch (err) {
                    // ignore
                }
                teardownContainer(container);
                return;
            }

            initialiseContainer(container, {
                force: true,
                configOverride: config
            });
        }

        unmountViewer() {
            const container = this.getViewerContainer();
            if (container) {
                teardownContainer(container);
            }
        }
    }

    try {
        frontend.elementsHandler.addHandler(ViewerWidgetHandler, {
            widgetType: 'viewer-to-elementor'
        });
        elementorHandlerRegistered = true;
        return true;
    } catch (err) {
        console.error('Falha ao registrar handler do Elementor:', err);
        return false;
    }
}

function setupElementorHooks() {
    const frontend = window.elementorFrontend;

    if (!frontend || !frontend.hooks || elementorHooksRegistered) {
        return elementorHooksRegistered;
    }

    const handlerReady = registerElementorHandler();

    if (!handlerReady) {
        const onWidgetReady = ($element) => {
            const scope = Array.isArray($element)
                ? $element[0]
                : $element?.[0] ?? $element;

            if (!(scope instanceof HTMLElement)) {
                return;
            }

            if (scope.matches(VIEWER_SELECTOR)) {
                initialiseContainer(scope, { force: true });
            } else {
                scope.querySelectorAll(VIEWER_SELECTOR).forEach((container) => {
                    initialiseContainer(container, { force: true });
                });
            }
        };

        ['frontend/element_ready/viewer-to-elementor.default', 'preview/element_ready/viewer-to-elementor.default'].forEach(
            (hook) => {
                frontend.hooks.addAction(hook, onWidgetReady);
            }
        );
    }

    frontend.on?.('document:loaded', () => initAll(document));
    frontend.on?.('components:init', () => initAll(document));

    elementorHooksRegistered = true;
    return true;
}

function ensureElementorIntegration() {
    if (elementorHooksRegistered) {
        return;
    }

    if (setupElementorHooks()) {
        return;
    }

    let attempts = 0;
    const maxAttempts = 40;

    const timer = setInterval(() => {
        attempts += 1;
        if (setupElementorHooks() || attempts >= maxAttempts) {
            clearInterval(timer);
        }
    }, 200);
}

function handleElementorFrontendInit() {
    if (elementorInitHandled) {
        return;
    }

    elementorInitHandled = true;
    ensureElementorIntegration();
    initAll(document);
    startObserver();
}

runWhenReady(() => {
    initAll(document);
    startObserver();
    ensureElementorIntegration();
});

window.addEventListener('elementor/frontend/init', handleElementorFrontendInit, {
    once: true
});

if (window.elementorFrontend?.hooks) {
    handleElementorFrontendInit();
} else {
    ensureElementorIntegration();
}

window.viewerToElementorRefresh = () => {
    initAll(document);
    startObserver();
};
