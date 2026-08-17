/**
 * Frontend and Elementor preview lifecycle for the 3D viewer.
 */
import {
    VIEWER_SELECTOR,
    initialiseContainer,
    teardownContainer
} from 'viewer-core';

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
            const wrapper = this.$element?.get(0);
            if (container) {
                initialiseContainer(container, { force: true });
                this.viewerInteractionActive = false;
                this.onViewerPointerDown = () => {
                    this.viewerInteractionActive = true;
                };
                this.onViewerPointerEnd = () => {
                    this.viewerInteractionActive = false;
                };
                this.onViewerDragStart = (event) => {
                    if (this.viewerInteractionActive) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                };

                container.addEventListener('pointerdown', this.onViewerPointerDown);
                wrapper?.addEventListener('dragstart', this.onViewerDragStart, true);
                document.addEventListener('pointerup', this.onViewerPointerEnd);
                document.addEventListener('pointercancel', this.onViewerPointerEnd);
            }
        },

        onDestroy() {
            const container = this.elements.$container.get(0);
            const wrapper = this.$element?.get(0);
            if (container) {
                container.removeEventListener('pointerdown', this.onViewerPointerDown);
                wrapper?.removeEventListener('dragstart', this.onViewerDragStart, true);
                document.removeEventListener('pointerup', this.onViewerPointerEnd);
                document.removeEventListener('pointercancel', this.onViewerPointerEnd);
                this.viewerInteractionActive = false;
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
