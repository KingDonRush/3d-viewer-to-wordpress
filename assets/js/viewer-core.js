/**
 * 3D Viewer core logic shared by frontend and Elementor editor.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import JSZip from 'jszip';

export const VIEWER_SELECTOR = '.viewer-container[data-viewer-config]';
export const DEFAULT_BACKGROUND = '#f0f0f0';

export class Viewer3D {
    constructor(config, container) {
        this.config = config;
        this.container =
            container ??
            (config.widget_id ? document.getElementById(config.widget_id) : null);

        if (!this.container) {
            throw new Error(
                `Container do viewer "${config.widget_id || 'desconhecido'}" nao encontrado.`
            );
        }

        this.canvas = null;
        this.placeholderCanvas = this.container.querySelector('.viewer-canvas');
        this.loading = this.container.querySelector('.viewer-loading');
        this.container.querySelector('.viewer-error')?.remove();
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.frameId = null;
        this.resizeObserver = null;
        this.handleResize = () => this.onResize();

        this.init();
    }

    async init() {
        try {
            this.setupRenderer();
            this.setupCamera();
            this.onResize();
            this.setupLighting();

            if (this.config.mouse_controls) {
                this.setupControls();
            }

            await this.loadModel();
            this.animate();
        } catch (err) {
            console.error('Erro ao inicializar Viewer3D:', err);
            this.showError(err.message);
        }
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.config.antialias !== false,
            alpha: true
        });

        this.renderer.shadowMap.enabled = this.config.shadows !== false;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const background = this.config.background_color || DEFAULT_BACKGROUND;
        try {
            this.scene.background = new THREE.Color(background);
        } catch (err) {
            console.warn('Cor de fundo invalida, regressando para o padrao.', err);
            this.scene.background = new THREE.Color(DEFAULT_BACKGROUND);
        }

        this.canvas = this.renderer.domElement;
        this.canvas.classList.add('viewer-canvas');

        if (this.placeholderCanvas) {
            if (this.placeholderCanvas !== this.canvas) {
                this.placeholderCanvas.replaceWith(this.canvas);
            }
            this.placeholderCanvas = null;
        } else if (!this.canvas.isConnected) {
            this.container.appendChild(this.canvas);
        }

        const initialWidth =
            this.container.clientWidth || this.container.offsetWidth || 300;
        const initialHeight =
            this.container.clientHeight || this.container.offsetHeight || 300;
        this.renderer.setSize(
            initialWidth > 0 ? initialWidth : 300,
            initialHeight > 0 ? initialHeight : 300,
            false
        );

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => this.onResize());
            this.resizeObserver.observe(this.container);
        }

        window.addEventListener('resize', this.handleResize);
    }

    setupCamera() {
        const width =
            this.container.clientWidth ||
            this.canvas.clientWidth ||
            this.canvas.offsetWidth ||
            1;
        const height =
            this.container.clientHeight ||
            this.canvas.clientHeight ||
            this.canvas.offsetHeight ||
            1;
        const aspect = height > 0 ? width / height : 1;

        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(2, 2, 2);
        dir.castShadow = true;

        this.scene.add(ambient);
        this.scene.add(dir);
    }

    setupControls() {
        if (!this.renderer || !this.camera) {
            return;
        }

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = Boolean(this.config.auto_rotation);
    }

    async loadModel() {
        const url = this.config.model_url;
        if (!url) {
            this.showError('Nenhum modelo informado.');
            return;
        }

        this.showLoading();

        const normalizedUrl = url.split('?')[0].toLowerCase();
        const ext = normalizedUrl.split('.').pop();

        try {
            if (ext === 'zip') {
                await this.loadZipModel(url);
            } else if (ext === 'glb' || ext === 'gltf') {
                await this.loadGLTF(url);
            } else {
                throw new Error(`Formato nao suportado: ${ext || 'desconhecido'}`);
            }

            this.hideLoading();
        } catch (err) {
            this.hideLoading();
            console.error(err);
            this.showError(`Falha ao carregar o modelo: ${err.message}`);
        }
    }

    async loadZipModel(url) {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            throw new Error(`Falha na requisicao do ZIP (${response.status})`);
        }

        const blob = await response.blob();
        const zip = await JSZip.loadAsync(blob);

        const fileName = Object.keys(zip.files).find((f) => /\.(glb|gltf)$/i.test(f));
        if (!fileName) {
            throw new Error('Nenhum arquivo .glb ou .gltf encontrado no ZIP.');
        }

        const fileData = await zip.file(fileName).async('arraybuffer');
        const blobUrl = URL.createObjectURL(
            new Blob([fileData], { type: 'model/gltf-binary' })
        );

        try {
            await this.loadGLTF(blobUrl);
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    async loadGLTF(url) {
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(
            'https://www.gstatic.com/draco/versioned/decoders/1.5.6/'
        );

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (gltf) => {
                    this.model = gltf.scene;
                    this.scene.add(this.model);
                    this.centerCamera();
                    resolve();
                },
                (xhr) => {
                    if (!xhr) {
                        return;
                    }

                    const total = xhr.total || xhr.loaded;
                    if (total) {
                        this.updateProgress((xhr.loaded / total) * 100);
                    }
                },
                (err) => reject(err)
            );
        });
    }

    updateProgress(percent) {
        if (!this.loading) {
            return;
        }

        const text = this.loading.querySelector('.viewer-loading-text');
        if (!text) {
            return;
        }

        if (!Number.isFinite(percent)) {
            text.textContent = 'Carregando modelo...';
            return;
        }

        text.textContent = `Carregando modelo... ${Math.round(percent)}%`;
    }

    centerCamera() {
        if (!this.model || !this.camera) {
            return;
        }

        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = (this.camera.fov * Math.PI) / 180;
        const distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

        this.camera.position.set(
            center.x,
            center.y,
            center.z + (Number.isFinite(distance) ? distance : 5)
        );
        this.camera.lookAt(center);

        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    }

    animate() {
        if (!this.renderer || !this.camera) {
            return;
        }

        this.frameId = requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.renderer || !this.canvas || !this.container) {
            return;
        }

        const width =
            this.container.clientWidth ||
            this.canvas.clientWidth ||
            this.canvas.offsetWidth;
        const height =
            this.container.clientHeight ||
            this.canvas.clientHeight ||
            this.canvas.offsetHeight;

        if (!width || !height) {
            return;
        }

        this.renderer.setSize(width, height, false);

        if (this.camera) {
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }

    showLoading() {
        if (this.loading) {
            this.loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loading) {
            this.loading.classList.add('hidden');
        }
    }

    showError(msg) {
        this.hideLoading();

        if (!this.container) {
            return;
        }

        const existing = this.container.querySelector('.viewer-error');
        if (existing) {
            existing.remove();
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'viewer-error';

        const icon = document.createElement('div');
        icon.className = 'viewer-error-icon';
        icon.textContent = '!';

        const message = document.createElement('div');
        message.className = 'viewer-error-message';
        message.textContent = msg;

        wrapper.appendChild(icon);
        wrapper.appendChild(message);
        this.container.appendChild(wrapper);
    }

    destroy() {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }

        window.removeEventListener('resize', this.handleResize);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        if (this.model) {
            this.scene.remove(this.model);
            this.disposeObject(this.model);
            this.model = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss?.();
            this.renderer = null;
        }

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }

        this.placeholderCanvas = null;

        if (this.scene) {
            this.scene.clear();
        }
    }

    disposeObject(object) {
        object.traverse?.((child) => {
            if (!child.isMesh) {
                return;
            }

            child.geometry?.dispose?.();

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            materials.forEach((material) => {
                material?.map?.dispose?.();
                material?.dispose?.();
            });
        });
    }
}

export const viewerInstances = new Map();

export function decodeHtmlEntities(value) {
    if (!value || value.indexOf('&') === -1) {
        return value;
    }

    const decoder = decodeHtmlEntities.decoderElement
        ? decodeHtmlEntities.decoderElement
        : document.createElement('div');

    decoder.innerHTML = value;
    decodeHtmlEntities.decoderElement = decoder;

    return decoder.textContent || decoder.innerText || value;
}

export function parseConfig(container) {
    const rawDataset = container?.dataset?.viewerConfig;
    const rawAttr = container?.getAttribute?.('data-viewer-config');
    const raw = rawDataset || rawAttr;

    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (err) {
        const decoded = decodeHtmlEntities(raw);
        if (decoded && decoded !== raw) {
            try {
                return JSON.parse(decoded);
            } catch (innerErr) {
                console.error(
                    'Configuracao do viewer invalida (apos decodificar HTML):',
                    innerErr,
                    decoded
                );
                return null;
            }
        }

        console.error('Configuracao do viewer invalida:', err, raw);
        return null;
    }
}

export function sanitiseConfigForAttribute(config) {
    try {
        return JSON.stringify(config);
    } catch (err) {
        console.error('Nao foi possivel serializar configuracao do viewer:', err, config);
        return null;
    }
}

export function teardownContainer(container) {
    const instance = viewerInstances.get(container);
    if (instance) {
        instance.destroy();
        viewerInstances.delete(container);
    }
}

export function initialiseContainer(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
        return null;
    }

    const { force = false } = options;
    const hasOverride = Object.prototype.hasOwnProperty.call(options, 'configOverride');
    const overrideValue = hasOverride ? options.configOverride : undefined;
    const currentInstance = viewerInstances.get(container);
    let config = hasOverride ? overrideValue : parseConfig(container);

    if (!config) {
        if (hasOverride) {
            container.removeAttribute('data-viewer-config');
            try {
                delete container.dataset.viewerConfig;
            } catch (err) {
                // ignore
            }
        }

        if (currentInstance) {
            teardownContainer(container);
        }
        return null;
    }

    if (hasOverride) {
        if (config.model_url) {
            const serialised = sanitiseConfigForAttribute(config);
            if (serialised !== null) {
                container.setAttribute('data-viewer-config', serialised);
                try {
                    container.dataset.viewerConfig = serialised;
                } catch (err) {
                    // dataset assignment may falhar
                }
            }
        } else {
            container.removeAttribute('data-viewer-config');
            try {
                delete container.dataset.viewerConfig;
            } catch (err) {
                // ignore
            }
        }
    }

    if (!force && currentInstance) {
        return currentInstance;
    }

    if (currentInstance) {
        teardownContainer(container);
    }

    config.widget_id = config.widget_id || container.id;

    if (!config.widget_id) {
        config.widget_id = `viewer-${Math.random().toString(16).slice(2)}`;
        container.id = config.widget_id;
    }

    if (!config.model_url) {
        const instance = viewerInstances.get(container);
        if (instance) {
            instance.destroy();
            viewerInstances.delete(container);
        }
        return null;
    }

    try {
        const instance = new Viewer3D(config, container);
        viewerInstances.set(container, instance);
        return instance;
    } catch (err) {
        console.error('Erro ao iniciar viewer:', err);
        return null;
    }
}

export function collectContainersFromNode(node) {
    if (!(node instanceof HTMLElement)) {
        return [];
    }

    const results = [];

    if (node.matches(VIEWER_SELECTOR)) {
        results.push(node);
    }

    node.querySelectorAll?.(VIEWER_SELECTOR).forEach((el) => results.push(el));

    return results;
}

export function initAll(root = document) {
    if (!root || !root.querySelectorAll) {
        return;
    }

    root.querySelectorAll(VIEWER_SELECTOR).forEach((container) => {
        initialiseContainer(container);
    });
}

