/**
 * Frontend bootstrap for the 3D viewer.
 */
import {
    VIEWER_SELECTOR,
    initAll,
    collectContainersFromNode,
    initialiseContainer,
    teardownContainer
} from './viewer-core.js';

let observerStarted = false;

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
                        mutation.attributeName === 'data-settings')
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

runWhenReady(() => {
    initAll(document);
    startObserver();
});

if (!window.viewerToElementorRefresh) {
    window.viewerToElementorRefresh = () => {
        initAll(document);
    };
}

