/**
 * Frontend and Elementor preview lifecycle for the 3D viewer.
 */
import {
    VIEWER_SELECTOR,
    initialiseContainer,
    teardownContainer
} from './viewer-core.js';

let handlerRegistered = false;

function registerElementorHandler() {
    if (handlerRegistered) {
        return;
    }

    const HandlerBase = window.elementorModules?.frontend?.handlers?.Base;
    const elementsHandler = window.elementorFrontend?.elementsHandler;

    if (!HandlerBase || !elementsHandler?.attachHandler) {
        return;
    }

    const ViewerWidgetHandler = HandlerBase.extend({
        getDefaultSettings() {
            return {
                selectors: {
                    container: VIEWER_SELECTOR
                }
            };
        },

        getDefaultElements() {
            return {
                $container: this.findElement(this.getSettings('selectors.container'))
            };
        },

        onInit() {
            HandlerBase.prototype.onInit.apply(this, arguments);

            const container = this.elements.$container.get(0);
            if (container) {
                initialiseContainer(container, { force: true });
            }
        },

        onDestroy() {
            const container = this.elements.$container.get(0);
            if (container) {
                teardownContainer(container);
            }

            HandlerBase.prototype.onDestroy.apply(this, arguments);
        }
    });

    elementsHandler.attachHandler('viewer-to-elementor', ViewerWidgetHandler);
    handlerRegistered = true;
}

if (window.elementorFrontend?.elementsHandler) {
    registerElementorHandler();
}

window.addEventListener('elementor/frontend/init', registerElementorHandler, { once: true });
