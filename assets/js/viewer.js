(function ($) {
    'use strict';

    window.ThreeJSViewer = {
        instances: {},
        init: function (config) {
            if (!config.widget_id || !config.model_url) return;
            this.instances[config.widget_id] = new ThreeJSViewerInstance(config);
        },
        initAll: function () {
            document.querySelectorAll('.threejs-viewer-container[data-viewer-config]').forEach(container => {
                try {
                    const config = JSON.parse(container.getAttribute('data-viewer-config'));
                    if (config && config.widget_id) this.init(config);
                } catch (e) {
                    console.error('Erro ao parsear config:', e);
                }
            });
        }
    };

    function ThreeJSViewerInstance(config) {
        this.config = config;
        this.container = document.getElementById(config.widget_id);
        this.canvas = this.container.querySelector('.threejs-canvas');
        this.loading = this.container.querySelector('.threejs-loading');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.controls = null;
        this.gltfLoader = null;
        this.dracoLoader = null;
        this.stats = null;
        this.clock = new THREE.Clock();
        this.animationId = null;
        this.init();
    }

    ThreeJSViewerInstance.prototype.init = function () {
        this.setupThreeJS();
        this.setupLoaders();
        this.loadModel();
    };

    ThreeJSViewerInstance.prototype.setupThreeJS = function () {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.background_color || '#f0f0f0');

        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.config.antialias !== false,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });

        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = this.config.shadows !== false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (this.renderer.outputColorSpace !== undefined)
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        else if (this.renderer.outputEncoding !== undefined)
            this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.setupLighting();
        if (this.config.mouse_controls) this.setupControls();
        if (window.Stats && this.config.debug) this.setupStats();

        this.animate();
        window.addEventListener('resize', this.onWindowResize.bind(this));
    };

    ThreeJSViewerInstance.prototype.setupStats = function () {
        this.stats = new Stats();
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.top = '0';
        this.stats.dom.style.left = '0';
        this.container.appendChild(this.stats.dom);
    };

    ThreeJSViewerInstance.prototype.setupLoaders = function () {
        this.dracoLoader = new THREE.DRACOLoader();
        const dracoPath =
            (window.threejs_viewer_config && window.threejs_viewer_config.draco_cdn)
                ? window.threejs_viewer_config.draco_cdn
                : 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
        this.dracoLoader.setDecoderPath(dracoPath);

        this.gltfLoader = new THREE.GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
    };

    ThreeJSViewerInstance.prototype.setupLighting = function () {
        this.scene.add(new THREE.AmbientLight(0x404040, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(1, 1, 1);
        if (this.config.shadows !== false) {
            dir.castShadow = true;
            dir.shadow.mapSize.width = dir.shadow.mapSize.height = 1024;
        }
        this.scene.add(dir);
    };

    ThreeJSViewerInstance.prototype.setupControls = function () {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = this.config.mouse_zoom;
            this.controls.autoRotate = this.config.auto_rotation;
        }
    };

    ThreeJSViewerInstance.prototype.loadModel = function () {
        if (!this.config.model_url) return;
        const ext = this.config.model_url.toLowerCase().split('.').pop();
        this.showLoading();
        if (ext === 'zip') this.loadModelFromZip();
        else if (['glb', 'gltf'].includes(ext)) this.loadStandardModel();
        else this.showError('Formato não suportado');
    };

    ThreeJSViewerInstance.prototype.loadStandardModel = function () {
        this.gltfLoader.load(
            this.config.model_url,
            gltf => {
                this.model = gltf.scene;
                this.setupModel();
                this.hideLoading();
            },
            xhr => this.updateLoadingProgress(xhr.loaded / xhr.total * 100),
            err => this.showError('Erro ao carregar modelo: ' + err.message)
        );
    };

    ThreeJSViewerInstance.prototype.updateLoadingProgress = function (percent) {
        if (this.loading) {
            const t = this.loading.querySelector('.threejs-loading-text');
            if (t) t.textContent = `Carregando modelo... ${Math.round(percent)}%`;
        }
    };

    ThreeJSViewerInstance.prototype.setupModel = function () {
        if (!this.model) return;
        this.scene.add(this.model);
        this.centerCamera();
    };

    ThreeJSViewerInstance.prototype.centerCamera = function () {
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * Math.PI / 180;
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    };

    ThreeJSViewerInstance.prototype.animate = function () {
        requestAnimationFrame(this.animate.bind(this));
        if (this.controls) this.controls.update();
        if (this.stats) this.stats.update();
        if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    };

    ThreeJSViewerInstance.prototype.onWindowResize = function () {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    };

    ThreeJSViewerInstance.prototype.showLoading = function () {
        if (this.loading) this.loading.classList.remove('hidden');
    };

    ThreeJSViewerInstance.prototype.hideLoading = function () {
        if (this.loading) this.loading.classList.add('hidden');
    };

    ThreeJSViewerInstance.prototype.showError = function (msg) {
        this.hideLoading();
        const e = document.createElement('div');
        e.className = 'threejs-error';
        e.innerHTML = `<div class="threejs-error-icon">⚠</div><div class="threejs-error-message">${msg}</div>`;
        this.container.appendChild(e);
    };

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', () => ThreeJSViewer.initAll());
    else ThreeJSViewer.initAll();

})(jQuery);
