/**
 * ThreeJS Elementor 3D Viewer
 * JavaScript principal com Three.js, JSZip, GLTFLoader e DRACOLoader
 */

(function($) {
    'use strict';
    
    // Namespace global
    window.ThreeJSViewer = {
        instances: {},
        
        init: function(config) {
            console.log('ThreeJS Viewer: Inicializando...', config);
            
            // Verificar dependências
            if (typeof THREE === 'undefined') {
                console.error('ThreeJS Viewer: THREE.js não encontrado');
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                console.error('ThreeJS Viewer: JSZip não encontrado');
                return;
            }
            
            if (!config.widget_id || !config.model_url) {
                console.error('ThreeJS Viewer: Configuração inválida', config);
                return;
            }
            
            console.log('ThreeJS Viewer: Criando instância...');
            // Criar nova instância
            this.instances[config.widget_id] = new ThreeJSViewerInstance(config);
        },
        
        // Inicializar todos os widgets na página
        initAll: function() {
            const containers = document.querySelectorAll('.threejs-viewer-container[data-viewer-config]');
            
            containers.forEach(container => {
                try {
                    const config = JSON.parse(container.getAttribute('data-viewer-config'));
                    if (config && config.widget_id) {
                        this.init(config);
                    }
                } catch (error) {
                    console.error('ThreeJS Viewer: Erro ao parsear configuração:', error);
                }
            });
        }
    };
    
    /**
     * Classe principal do viewer
     */
    function ThreeJSViewerInstance(config) {
        this.config = config;
        this.container = document.getElementById(config.widget_id);
        this.canvas = this.container.querySelector('.threejs-canvas');
        this.loading = this.container.querySelector('.threejs-loading');
        
        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.controls = null;
        
        // Loaders
        this.gltfLoader = null;
        this.dracoLoader = null;
        
        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
        
        // Initialize
        this.init();
    }
    
    ThreeJSViewerInstance.prototype.init = function() {
        this.setupThreeJS();
        this.setupLoaders();
        this.loadModel();
    };
    
    /**
     * Configurar Three.js
     */
    ThreeJSViewerInstance.prototype.setupThreeJS = function() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.background_color || '#f0f0f0');
        
        // Camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);
        
        // Renderer com otimizações de performance
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.config.antialias !== false, // Configurável
            alpha: true,
            powerPreference: "high-performance", // Forçar GPU
            stencil: false, // Desabilitar se não necessário
            depth: true,
            logarithmicDepthBuffer: false // Melhor performance
        });
        
        // Otimizações de renderização
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar pixel ratio
        this.renderer.shadowMap.enabled = this.config.shadows !== false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false; // Otimização
        this.renderer.shadowMap.needsUpdate = true;
        
        // Configurar colorSpace para compatibilidade com Three.js r158+
        if (this.renderer.outputColorSpace !== undefined) {
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else if (this.renderer.outputEncoding !== undefined) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }
        
        // Configurar tone mapping
        if (this.renderer.toneMapping !== undefined) {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.0;
        }
        
        // Frustum culling para otimização
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        
        // Lighting otimizado
        this.setupLighting();
        
        // Controls
        if (this.config.mouse_controls) {
            this.setupControls();
        }
        
        // Start render loop otimizado
        this.animate();
        
        // Handle resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Performance monitoring
        this.setupPerformanceMonitoring();
    };
    
    /**
     * Configurar loaders
     */
    ThreeJSViewerInstance.prototype.setupLoaders = function() {
        // Configurar DRACOLoader
        this.dracoLoader = new THREE.DRACOLoader();
        // Usar CDN confiável ou fallback
        const dracoPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
        this.dracoLoader.setDecoderPath(dracoPath);
        this.dracoLoader.setDecoderConfig({ type: 'js' });
        
        // Fallback para caso o CDN falhe
        this.dracoLoader.setWorkerLimit(1);
        
        // Configurar GLTFLoader com DRACOLoader
        this.gltfLoader = new THREE.GLTFLoader();
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
        
        // Configurar callbacks de progresso
        this.gltfLoader.setPath('');
        this.gltfLoader.setResourcePath('');
        
        // Configurar para usar URLs relativas
        this.gltfLoader.setCrossOrigin('anonymous');
        
        console.log('Loaders configurados:', {
            dracoLoader: !!this.dracoLoader,
            gltfLoader: !!this.gltfLoader
        });
    };
    
    /**
     * Configurar iluminação otimizada
     */
    ThreeJSViewerInstance.prototype.setupLighting = function() {
        // Ambient light otimizado
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light com sombras otimizadas
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        
        // Configurar sombras apenas se habilitadas
        if (this.config.shadows !== false) {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 1024;
            directionalLight.shadow.mapSize.height = 1024;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -10;
            directionalLight.shadow.camera.right = 10;
            directionalLight.shadow.camera.top = 10;
            directionalLight.shadow.camera.bottom = -10;
            directionalLight.shadow.bias = -0.0001;
        }
        
        this.scene.add(directionalLight);
        
        // Point light otimizado (apenas se necessário)
        if (this.config.additional_lighting !== false) {
            const pointLight = new THREE.PointLight(0xffffff, 0.5);
            pointLight.position.set(-1, 1, 1);
            this.scene.add(pointLight);
        }
    };
    
    /**
     * Configurar monitoramento de performance
     */
    ThreeJSViewerInstance.prototype.setupPerformanceMonitoring = function() {
        // Stats.js para monitoramento de FPS
        if (typeof Stats !== 'undefined' && this.config.show_stats) {
            this.stats = new Stats();
            this.stats.dom.style.position = 'absolute';
            this.stats.dom.style.top = '0px';
            this.stats.dom.style.left = '0px';
            this.container.appendChild(this.stats.dom);
        }
        
        // Performance counters
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        
        // LOD system
        this.lodLevels = [];
        this.currentLODLevel = 0;
    };
    
    /**
     * Configurar controles
     */
    ThreeJSViewerInstance.prototype.setupControls = function() {
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = this.config.mouse_zoom;
            this.controls.enablePan = false;
            this.controls.autoRotate = this.config.auto_rotation;
            this.controls.autoRotateSpeed = 2.0;
        }
    };
    
    /**
     * Carregar modelo inteligentemente
     */
    ThreeJSViewerInstance.prototype.loadModel = function() {
        if (!this.config.model_url) {
            this.showError('URL do modelo não fornecida');
            return;
        }
        
        // Validar URL
        try {
            new URL(this.config.model_url);
        } catch (e) {
            this.showError('URL do modelo inválida');
            return;
        }
        
        console.log('Iniciando carregamento inteligente do modelo:', this.config.model_url);
        this.showLoading();
        
        // Detectar tipo de arquivo pela URL
        const fileType = this.detectFileTypeFromUrl(this.config.model_url);
        console.log('Tipo de arquivo detectado:', fileType);
        
        if (fileType === 'zip') {
            this.loadModelFromZip();
        } else if (fileType === 'glb' || fileType === 'gltf') {
            this.loadModelDirect();
        } else {
            this.showError('Formato de arquivo não suportado. Use .zip, .glb ou .gltf');
        }
    };
    
    /**
     * Detectar tipo de arquivo pela URL
     */
    ThreeJSViewerInstance.prototype.detectFileTypeFromUrl = function(url) {
        const extension = url.toLowerCase().split('.').pop();
        
        if (extension === 'zip') return 'zip';
        if (extension === 'glb') return 'glb';
        if (extension === 'gltf') return 'gltf';
        
        // Se não conseguir detectar pela extensão, tentar pelo cabeçalho
        return 'unknown';
    };
    
    /**
     * Carregar modelo direto (GLB/GLTF)
     */
    ThreeJSViewerInstance.prototype.loadModelDirect = function() {
        console.log('Carregando modelo direto:', this.config.model_url);
        
        // Detectar se é arquivo otimizado
        const isOptimized = this.detectOptimizedFile(this.config.model_url);
        
        if (isOptimized) {
            console.log('Arquivo otimizado detectado - priorizando processamento principal');
            this.loadOptimizedModel();
        } else {
            console.log('Arquivo padrão - usando carregamento normal');
            this.loadStandardModel();
        }
    };
    
    /**
     * Detectar se arquivo foi otimizado
     */
    ThreeJSViewerInstance.prototype.detectOptimizedFile = function(url) {
        // Verificar se URL contém indicadores de otimização
        const optimizedIndicators = [
            'optimized',
            'optimized_',
            'opt_',
            'fast_',
            'web_',
            'threejs_',
            '1sec_',
            'render_'
        ];
        
        const filename = url.toLowerCase().split('/').pop();
        
        // Verificar se filename contém indicadores
        for (const indicator of optimizedIndicators) {
            if (filename.includes(indicator)) {
                return true;
            }
        }
        
        // Verificar se URL contém indicadores
        for (const indicator of optimizedIndicators) {
            if (url.toLowerCase().includes(indicator)) {
                return true;
            }
        }
        
        return false;
    };
    
    /**
     * Carregar modelo otimizado (prioridade máxima)
     */
    ThreeJSViewerInstance.prototype.loadOptimizedModel = function() {
        console.log('Carregando modelo otimizado - prioridade máxima');
        
        // Configurar loader otimizado
        const optimizedLoader = new THREE.GLTFLoader();
        
        // Configurar DRACOLoader para compressão otimizada
        if (this.dracoLoader) {
            optimizedLoader.setDRACOLoader(this.dracoLoader);
        }
        
        // Carregar com prioridade máxima
        optimizedLoader.load(
            this.config.model_url,
            (model) => {
                console.log('Modelo otimizado carregado com sucesso');
                this.model = model.scene;
                
                // Aplicar otimizações para processamento principal
                this.applyOptimizationSettings(model);
                
                this.setupModel();
                this.hideLoading();
                
                // Disparar evento para modelos otimizados
                $(document).trigger('threejs_optimized_model_loaded', {
                    widget_id: this.config.widget_id,
                    model_url: this.config.model_url,
                    optimization_level: 'priority'
                });
            },
            (progress) => {
                const percent = (progress.loaded / progress.total * 100).toFixed(1);
                console.log(`Carregamento prioritário: ${percent}%`);
            },
            (error) => {
                console.error('Erro ao carregar modelo otimizado:', error);
                
                // Fallback para carregamento padrão se otimizado falhar
                console.log('Tentando carregamento padrão como fallback...');
                this.loadStandardModel();
            }
        );
    };
    
    /**
     * Carregar modelo padrão
     */
    ThreeJSViewerInstance.prototype.loadStandardModel = function() {
        console.log('Carregando modelo com configurações padrão');
        
        // Usar GLTFLoader padrão
        this.gltfLoader.load(
            this.config.model_url,
            (model) => {
                console.log('Modelo GLTF carregado com sucesso');
                this.model = model.scene;
                this.setupModel();
                this.hideLoading();
            },
            (progress) => {
                console.log('Progresso:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('Erro ao carregar modelo GLTF:', error);
                this.showError('Erro ao carregar modelo 3D: ' + error.message);
            }
        );
    };
    
    /**
     * Aplicar configurações de otimização para processamento principal
     */
    ThreeJSViewerInstance.prototype.applyOptimizationSettings = function(model) {
        console.log('Aplicando otimizações para processamento principal');
        
        // Otimizar texturas
        this.optimizeTextures(model);
        
        // Otimizar geometria
        this.optimizeGeometry(model);
        
        // Otimizar materiais
        this.optimizeMaterials(model);
        
        // Otimizar hierarquia de cena
        this.optimizeSceneHierarchy(model);
        
        console.log('Otimizações aplicadas para prioridade máxima');
    };
    
    /**
     * Otimizar texturas para carregamento rápido
     */
    ThreeJSViewerInstance.prototype.optimizeTextures = function(model) {
        model.scene.traverse((child) => {
            if (child.material) {
                if (child.material.map) {
                    // Configurar texturas para carregamento rápido
                    child.material.map.minFilter = THREE.LinearFilter;
                    child.material.map.magFilter = THREE.LinearFilter;
                    child.material.map.generateMipmaps = false; // Economizar memória
                    
                    // Reduzir qualidade para carregamento mais rápido
                    child.material.map.anisotropy = 1; // Reduzir anisotropia
                }
                
                // Desabilitar sombras para performance
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
    };
    
    /**
     * Otimizar geometria para renderização rápida
     */
    ThreeJSViewerInstance.prototype.optimizeGeometry = function(model) {
        model.scene.traverse((child) => {
            if (child.geometry) {
                // Configurar geometria para renderização rápida
                child.geometry.computeBoundingSphere();
                child.geometry.computeBoundingBox();
                
                // Otimizar buffers
                if (child.geometry.attributes.position) {
                    child.geometry.attributes.position.needsUpdate = false;
                }
            }
        });
    };
    
    /**
     * Otimizar materiais para performance
     */
    ThreeJSViewerInstance.prototype.optimizeMaterials = function(model) {
        model.scene.traverse((child) => {
            if (child.material) {
                // Configurar materiais para renderização rápida
                child.material.side = THREE.FrontSide; // Renderizar apenas frente
                child.material.transparent = false; // Desabilitar transparência se não necessário
                child.material.depthWrite = true;
                child.material.depthTest = true;
                
                // Desabilitar recursos pesados
                child.material.wireframe = false;
                child.material.flatShading = false;
            }
        });
    };
    
    /**
     * Otimizar hierarquia de cena para menos draw calls
     */
    ThreeJSViewerInstance.prototype.optimizeSceneHierarchy = function(model) {
        // Simplificar hierarquia para menos draw calls
        const meshes = [];
        
        model.scene.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });
        
        console.log(`Modelo otimizado: ${meshes.length} meshes para processamento prioritário`);
    };
    
    /**
     * Atualizar mensagem de carregamento
     */
    ThreeJSViewerInstance.prototype.updateLoadingMessage = function(message) {
        if (this.loadingElement) {
            this.loadingElement.textContent = message;
        }
    };
    
    /**
     * Carregar modelo do arquivo ZIP
     */
    ThreeJSViewerInstance.prototype.loadModelFromZip = function() {
        console.log('Carregando modelo do ZIP:', this.config.model_url);
        
        // Download do arquivo ZIP
        fetch(this.config.model_url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao baixar arquivo');
                }
                console.log('ZIP baixado com sucesso');
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                console.log('Extraindo modelo do ZIP...');
                return this.extractModelFromZip(arrayBuffer);
            })
            .then(extractedData => {
                console.log('Modelo extraído, carregando GLTF...');
                return this.loadGLTFModel(extractedData);
            })
            .then(model => {
                console.log('Modelo GLTF carregado com sucesso');
                this.model = model;
                this.setupModel();
                this.hideLoading();
            })
            .catch(error => {
                console.error('Erro ao carregar modelo:', error);
                this.showError('Erro ao carregar modelo 3D: ' + error.message);
            });
    };
    
    /**
     * Extrair modelo do arquivo ZIP
     */
    ThreeJSViewerInstance.prototype.extractModelFromZip = function(arrayBuffer) {
        return new Promise((resolve, reject) => {
            const zip = new JSZip();
            
            zip.loadAsync(arrayBuffer)
                .then(zip => {
                    // Procurar por arquivos .glb ou .gltf
                    const modelFiles = [];
                    const allFiles = {};
                    
                    zip.forEach((relativePath, zipEntry) => {
                        const extension = relativePath.toLowerCase().split('.').pop();
                        if (extension === 'glb' || extension === 'gltf') {
                            modelFiles.push({
                                path: relativePath,
                                entry: zipEntry
                            });
                        }
                        
                        // Armazenar todos os arquivos para acesso posterior
                        allFiles[relativePath] = zipEntry;
                    });
                    
                    console.log('Arquivos encontrados no ZIP:', Object.keys(allFiles));
                    
                    if (modelFiles.length === 0) {
                        reject(new Error('Nenhum arquivo .glb ou .gltf encontrado no ZIP'));
                        return;
                    }
                    
                    // Usar o primeiro arquivo encontrado
                    const firstModel = modelFiles[0];
                    console.log('Modelo principal:', firstModel.path);
                    
                    // Extrair todos os arquivos necessários
                    const extractionPromises = [];
                    const extractedFiles = {};
                    
                    // Extrair o arquivo principal
                    extractionPromises.push(
                        firstModel.entry.async('blob').then(blob => {
                            extractedFiles[firstModel.path] = blob;
                            console.log('Arquivo principal extraído:', firstModel.path);
                        })
                    );
                    
                    // Extrair todos os outros arquivos que podem ser referenciados
                    Object.keys(allFiles).forEach(filePath => {
                        if (filePath !== firstModel.path) {
                            extractionPromises.push(
                                allFiles[filePath].async('blob').then(blob => {
                                    extractedFiles[filePath] = blob;
                                    console.log('Arquivo extraído:', filePath);
                                }).catch(error => {
                                    console.warn('Erro ao extrair arquivo:', filePath, error);
                                })
                            );
                        }
                    });
                    
                    return Promise.all(extractionPromises).then(() => {
                        console.log('Todos os arquivos extraídos:', Object.keys(extractedFiles));
                        return {
                            mainFile: extractedFiles[firstModel.path],
                            allFiles: extractedFiles,
                            basePath: firstModel.path.split('/').slice(0, -1).join('/')
                        };
                    });
                })
                .then(result => {
                    resolve(result);
                })
                .catch(reject);
        });
    };
    
    /**
     * Carregar modelo GLTF real
     */
    ThreeJSViewerInstance.prototype.loadGLTFModel = function(extractedData) {
        return new Promise((resolve, reject) => {
            const { mainFile, allFiles } = extractedData;
            
            // Criar URLs para todos os arquivos extraídos
            const fileUrls = {};
            Object.keys(allFiles).forEach(filePath => {
                fileUrls[filePath] = URL.createObjectURL(allFiles[filePath]);
            });
            
            // Store the main URL that GLTFLoader will initially load
            this.mainUrlForLoader = fileUrls[Object.keys(fileUrls).find(path => path.endsWith('.glb') || path.endsWith('.gltf'))];
            
            // Configurar o GLTFLoader para interceptar requisições
            const originalFetch = window.fetch;
            console.log('Arquivos disponíveis para interceptação:', Object.keys(allFiles));
            
            window.fetch = (url) => {
                console.log('Type of url:', typeof url, 'instanceof Request:', url instanceof Request);
                let actualUrl = url;
                if (url instanceof Request) {
                    actualUrl = url.url;
                }
                
                // Verificar se a URL é undefined ou null
                if (!actualUrl) {
                    console.error('URL undefined ou null detectada:', url);
                    return Promise.reject(new Error('URL inválida'));
                }
                
                const urlString = actualUrl.toString();
                console.log('Interceptando requisição para:', urlString);
                
                // Se a URL é um blob URL do nosso arquivo principal, usar diretamente
                if (actualUrl === this.mainUrlForLoader) {
                    console.log('Interceptando arquivo principal (loader):', urlString);
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        statusText: 'OK',
                        headers: new Headers({
                            'Content-Type': this.getContentType('scene.gltf'),
                            'Content-Length': mainFile.size.toString()
                        }),
                        arrayBuffer: () => mainFile.arrayBuffer(),
                        blob: () => Promise.resolve(mainFile),
                        json: () => {
                            return mainFile.text().then(text => {
                                console.log('Parseando conteúdo GLTF:', text.substring(0, 200) + '...');
                                return JSON.parse(text);
                            });
                        },
                        text: () => mainFile.text()
                    });
                }
                
                // First, try to match by checking if the requested URL string ends with any of our file paths
                for (const [filePath, fileBlob] of Object.entries(allFiles)) {
                    if (urlString.endsWith(filePath)) {
                        console.log('Interceptando requisição (por sufixo de caminho):', urlString, '->', filePath);
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            headers: new Headers({
                                'Content-Type': this.getContentType(filePath),
                                'Content-Length': fileBlob.size.toString()
                            }),
                            arrayBuffer: () => fileBlob.arrayBuffer(),
                            blob: () => Promise.resolve(fileBlob),
                            json: () => {
                                if (filePath.endsWith('.gltf') || filePath.endsWith('.json')) {
                                    return fileBlob.text().then(text => JSON.parse(text));
                                }
                                throw new Error('Não é um arquivo JSON');
                            },
                            text: () => fileBlob.text()
                        });
                    }
                }
                
                // If not matched by suffix, try to extract filename/path and match by that.
                let requestedPath = '';
                try {
                    const parsedUrl = new URL(urlString);
                    requestedPath = parsedUrl.pathname.substring(1); // Remove leading slash
                } catch (e) {
                    requestedPath = urlString;
                }
                
                // Now, try to match the extracted requestedPath (which could be just a filename or a full path)
                // against the keys in allFiles.
                for (const [filePath, fileBlob] of Object.entries(allFiles)) {
                    const pathFileName = filePath.split('/').pop();
                    
                    if (filePath === requestedPath || pathFileName === requestedPath) {
                        console.log('Interceptando requisição (por nome/caminho exato):', urlString, '->', filePath);
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            headers: new Headers({
                                'Content-Type': this.getContentType(filePath),
                                'Content-Length': fileBlob.size.toString()
                            }),
                            arrayBuffer: () => fileBlob.arrayBuffer(),
                            blob: () => Promise.resolve(fileBlob),
                            json: () => {
                                if (filePath.endsWith('.gltf') || filePath.endsWith('.json')) {
                                    return fileBlob.text().then(text => JSON.parse(text));
                                }
                                throw new Error('Não é um arquivo JSON');
                            },
                            text: () => fileBlob.text()
                        });
                    }
                }
                
                console.log('Requisição não interceptada:', urlString);
                
                // Log adicional para URLs suspeitas
                if (urlString.includes('undefined') || urlString === 'undefined') {
                    console.error('URL undefined detectada:', urlString);
                    console.error('Stack trace:', new Error().stack);
                }
                
                // Fallback for base name (less specific, but might catch some cases)
                const baseFileName = requestedPath.split('.')[0];
                for (const [filePath, fileBlob] of Object.entries(allFiles)) {
                    const pathBaseName = filePath.split('/').pop().split('.')[0];
                    if (pathBaseName === baseFileName) {
                        console.log('Interceptando por nome base:', urlString, '->', filePath);
                        return Promise.resolve({
                            ok: true,
                            status: 200,
                            statusText: 'OK',
                            headers: new Headers({
                                'Content-Type': this.getContentType(filePath),
                                'Content-Length': fileBlob.size.toString()
                            }),
                            arrayBuffer: () => fileBlob.arrayBuffer(),
                            blob: () => Promise.resolve(fileBlob),
                            json: () => {
                                if (filePath.endsWith('.gltf') || filePath.endsWith('.json')) {
                                    return fileBlob.text().then(text => JSON.parse(text));
                                }
                                throw new Error('Não é um arquivo JSON');
                            },
                            text: () => fileBlob.text()
                        });
                    }
                }
                
                // Final fallback to original fetch
                return originalFetch(url);
            };
            
            // Configurar o GLTFLoader para usar o sistema de interceptação
            this.gltfLoader.setPath('');
            this.gltfLoader.setResourcePath('');
            
            // Configurar para usar URLs relativas
            this.gltfLoader.setCrossOrigin('anonymous');
            
            console.log('Iniciando carregamento GLTF com URL:', this.mainUrlForLoader);
            this.gltfLoader.load(
                this.mainUrlForLoader, // Load using the mainUrlForLoader
                (gltf) => {
                    console.log('GLTF carregado com sucesso:', gltf);
                    // Limpar URLs criadas
                    Object.values(fileUrls).forEach(url => URL.revokeObjectURL(url));
                    // Restaurar fetch original
                    window.fetch = originalFetch;
                    
                    // Processar o modelo carregado
                    const model = gltf.scene;
                    
                    // Otimizações de performance para o modelo
                    this.optimizeModel(model);
                    
                    // Configurar materiais para compatibilidade com Three.js r158+
                    model.traverse((child) => {
                        if (child.isMesh) {
                            // Habilitar sombras apenas se configurado
                            if (this.config.shadows !== false) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                            
                            // Configurar materiais PBR
                            if (child.material) {
                                // Remover propriedades descontinuadas
                                if (child.material.alphaWrite !== undefined) {
                                    delete child.material.alphaWrite;
                                }
                                
                                // Configurar colorSpace para compatibilidade
                                if (child.material.map) {
                                    if (child.material.map.colorSpace !== undefined) {
                                        child.material.map.colorSpace = THREE.SRGBColorSpace;
                                    } else if (child.material.map.encoding !== undefined) {
                                        child.material.map.encoding = THREE.sRGBEncoding;
                                    }
                                }
                                
                                // Otimizações de material
                                child.material.needsUpdate = true;
                                child.material.side = THREE.FrontSide; // Melhor performance
                                
                                // Desabilitar transparência se não necessário
                                if (!child.material.transparent) {
                                    child.material.transparent = false;
                                    child.material.opacity = 1.0;
                                }
                            }
                            
                            // Otimizações de geometria
                            if (child.geometry) {
                                child.geometry.computeBoundingSphere();
                                child.geometry.computeBoundingBox();
                            }
                        }
                    });
                    
                    resolve(model);
                },
                (progress) => {
                    // Callback de progresso
                    const percentComplete = (progress.loaded / progress.total) * 100;
                    this.updateLoadingProgress(percentComplete);
                },
                (error) => {
                    // Limpar URLs criadas
                    Object.values(fileUrls).forEach(url => URL.revokeObjectURL(url));
                    // Restaurar fetch original
                    window.fetch = originalFetch;
                    
                    reject(new Error('Erro ao carregar modelo GLTF: ' + error.message));
                }
            );
        });
    };
    
    /**
     * Determinar o tipo de conteúdo baseado na extensão do arquivo
     */
    ThreeJSViewerInstance.prototype.getContentType = function(filePath) {
        const extension = filePath.toLowerCase().split('.').pop();
        switch (extension) {
            case 'gltf':
                return 'model/gltf+json';
            case 'glb':
                return 'model/gltf-binary';
            case 'bin':
                return 'application/octet-stream';
            case 'png':
                return 'image/png';
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'json':
                return 'application/json';
            default:
                return 'application/octet-stream';
        }
    };
    
    /**
     * Atualizar progresso do loading
     */
    ThreeJSViewerInstance.prototype.updateLoadingProgress = function(percent) {
        if (this.loading) {
            const progressText = this.loading.querySelector('.threejs-loading-text');
            if (progressText) {
                progressText.textContent = `Carregando modelo... ${Math.round(percent)}%`;
            }
        }
    };
    
    /**
     * Configurar modelo carregado
     */
    ThreeJSViewerInstance.prototype.setupModel = function() {
        if (!this.model) return;
        
        // Adicionar modelo à cena
        this.scene.add(this.model);
        
        // Centralizar câmera
        this.centerCamera();
        
        // Aplicar animação idle
        this.applyIdleAnimation();
        
        // Configurar animações do modelo se existirem
        this.setupModelAnimations();
        
        // Disparar eventos para análise inteligente
        this.triggerAnalysisEvents();
    };
    
    /**
     * Disparar eventos para análise inteligente
     */
    ThreeJSViewerInstance.prototype.triggerAnalysisEvents = function() {
        // Disparar evento de modelo carregado
        $(document).trigger('threejs_model_loaded', {
            widget_id: this.config.widget_id,
            model_url: this.config.model_url
        });
        
        // Se for um arquivo ZIP, disparar evento específico
        if (this.config.model_url && this.config.model_url.includes('.zip')) {
            $(document).trigger('threejs_zip_loaded', {
                widget_id: this.config.widget_id,
                zip_url: this.config.model_url
            });
        }
        
        console.log('ThreeJS Viewer: Eventos de análise disparados');
    };
    
    /**
     * Configurar animações do modelo
     */
    ThreeJSViewerInstance.prototype.setupModelAnimations = function() {
        if (!this.model || !this.model.animations || this.model.animations.length === 0) {
            return;
        }
        
        // Criar mixer de animação
        this.mixer = new THREE.AnimationMixer(this.model);
        
        // Adicionar todas as animações
        this.model.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.play();
        });
    };
    
    /**
     * Centralizar câmera no modelo
     */
    ThreeJSViewerInstance.prototype.centerCamera = function() {
        if (!this.model) return;
        
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        cameraZ *= 1.5; // Ajuste para melhor visualização
        
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        // Ajustar controles se existirem
        if (this.controls && this.controls.target) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    };
    
    /**
     * Aplicar animação idle
     */
    ThreeJSViewerInstance.prototype.applyIdleAnimation = function() {
        if (!this.model) return;
        
        const animationType = this.config.idle_animation || 'idle1';
        
        switch (animationType) {
            case 'idle1':
                this.startRotationAnimation();
                break;
            case 'idle2':
                this.startFloatingAnimation();
                break;
            case 'idle3':
                this.startRotationAndPulseAnimation();
                break;
        }
    };
    
    /**
     * Animação de rotação suave
     */
    ThreeJSViewerInstance.prototype.startRotationAnimation = function() {
        const animate = () => {
            if (this.model) {
                this.model.rotation.y += 0.01;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    };
    
    /**
     * Animação de flutuação
     */
    ThreeJSViewerInstance.prototype.startFloatingAnimation = function() {
        const startY = this.model.position.y;
        const animate = () => {
            if (this.model) {
                this.model.position.y = startY + Math.sin(Date.now() * 0.002) * 0.2;
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    };
    
    /**
     * Animação de rotação + pulsação
     */
    ThreeJSViewerInstance.prototype.startRotationAndPulseAnimation = function() {
        const startScale = 1;
        const animate = () => {
            if (this.model) {
                this.model.rotation.y += 0.008;
                const scale = startScale + Math.sin(Date.now() * 0.003) * 0.1;
                this.model.scale.setScalar(scale);
            }
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    };
    
    /**
     * Loop de renderização otimizado
     */
    ThreeJSViewerInstance.prototype.animate = function() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Performance monitoring
        this.updatePerformanceStats();
        
        // Frustum culling
        this.updateFrustumCulling();
        
        // Atualizar mixer de animação
        if (this.mixer) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
        }
        
        // Atualizar controles
        if (this.controls) {
            this.controls.update();
        }
        
        // Atualizar LOD dinâmico
        if (this.updateLODQuality) {
            this.updateLODQuality();
        }
        
        // Renderizar apenas se visível
        if (this.renderer && this.scene && this.camera && this.isVisible()) {
            this.renderer.render(this.scene, this.camera);
        }
        
        // Atualizar stats
        if (this.stats) {
            this.stats.update();
        }
    };
    
    /**
     * Atualizar estatísticas de performance
     */
    ThreeJSViewerInstance.prototype.updatePerformanceStats = function() {
        this.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
            
            // Log de performance (apenas em debug)
            if (this.config.debug_performance) {
                console.log(`FPS: ${this.fps}, Draw calls: ${this.renderer.info.render.calls}`);
            }
        }
    };
    
    /**
     * Atualizar frustum culling
     */
    ThreeJSViewerInstance.prototype.updateFrustumCulling = function() {
        if (!this.model) return;
        
        // Atualizar matriz de projeção
        this.projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
        
        // Verificar se o modelo está no frustum
        const box = new THREE.Box3().setFromObject(this.model);
        const inFrustum = this.frustum.intersectsBox(box);
        
        // Atualizar visibilidade
        if (inFrustum !== this.model.userData.inFrustum) {
            this.model.userData.inFrustum = inFrustum;
            this.model.visible = inFrustum && this.model.userData.originalVisible;
        }
    };
    
    /**
     * Verificar se o elemento está visível
     */
    ThreeJSViewerInstance.prototype.isVisible = function() {
        if (!this.container) return false;
        
        const rect = this.container.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    };
    
    /**
     * Redimensionar canvas otimizado
     */
    ThreeJSViewerInstance.prototype.onWindowResize = function() {
        if (this.camera && this.renderer) {
            const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            this.camera.aspect = aspect;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
            
            // Atualizar frustum após redimensionamento
            this.updateFrustumCulling();
        }
    };
    
    /**
     * Mostrar loading
     */
    ThreeJSViewerInstance.prototype.showLoading = function() {
        if (this.loading) {
            this.loading.classList.remove('hidden');
            this.updateLoadingProgress(0);
        }
    };
    
    /**
     * Esconder loading
     */
    ThreeJSViewerInstance.prototype.hideLoading = function() {
        if (this.loading) {
            this.loading.classList.add('hidden');
        }
    };
    
    /**
     * Mostrar erro
     */
    ThreeJSViewerInstance.prototype.showError = function(message) {
        this.hideLoading();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'threejs-error';
        errorDiv.innerHTML = `
            <div class="threejs-error-icon">⚠</div>
            <div class="threejs-error-message">${message}</div>
        `;
        
        this.container.appendChild(errorDiv);
    };
    
    /**
     * Limpar recursos otimizado
     */
    ThreeJSViewerInstance.prototype.destroy = function() {
        // Parar animações
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Parar mixer
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
        
        // Limpar renderer
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        // Limpar Three.js objects com otimizações
        if (this.scene) {
            this.scene.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            if (material.roughnessMap) material.roughnessMap.dispose();
                            if (material.metalnessMap) material.metalnessMap.dispose();
                            material.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        if (object.material.normalMap) object.material.normalMap.dispose();
                        if (object.material.roughnessMap) object.material.roughnessMap.dispose();
                        if (object.material.metalnessMap) object.material.metalnessMap.dispose();
                        object.material.dispose();
                    }
                }
            });
        }
        
        // Limpar loaders
        if (this.dracoLoader) {
            this.dracoLoader.dispose();
        }
        
        // Limpar LOD levels
        this.lodLevels.forEach(lod => {
            if (lod && lod.dispose) {
                lod.dispose();
            }
        });
        
        // Limpar stats
        if (this.stats && this.stats.dom && this.stats.dom.parentNode) {
            this.stats.dom.parentNode.removeChild(this.stats.dom);
        }
        
        // Limpar referências
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.controls = null;
        this.mixer = null;
        this.gltfLoader = null;
        this.dracoLoader = null;
        this.lodLevels = [];
        
        console.log('ThreeJS Viewer: Recursos limpos com sucesso');
    };
    
    /**
     * Otimizar modelo para performance
     */
    ThreeJSViewerInstance.prototype.optimizeModel = function(model) {
        // LOD system
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Criar diferentes níveis de LOD baseado na complexidade
        if (maxDim > 10) {
            // Modelo grande - aplicar LOD
            this.createLODLevels(model);
        }
        
        // Frustum culling setup
        model.userData.originalVisible = model.visible;
        model.userData.inFrustum = true;
        
        // Instancing para objetos repetitivos
        this.setupInstancing(model);
        
        // Level of Detail dinâmico
        this.setupDynamicLOD(model);
    };
    
    /**
     * Criar níveis de LOD
     */
    ThreeJSViewerInstance.prototype.createLODLevels = function(model) {
        const lod = new THREE.LOD();
        
        // LOD alto (original)
        lod.addLevel(model.clone(), 0);
        
        // LOD médio (simplificado)
        const mediumLOD = model.clone();
        mediumLOD.traverse((child) => {
            if (child.isMesh && child.geometry) {
                // Simplificar geometria
                const modifier = new THREE.SimplifyModifier();
                const simplified = modifier.modify(child.geometry, Math.floor(child.geometry.attributes.position.count * 0.5));
                child.geometry.dispose();
                child.geometry = simplified;
            }
        });
        lod.addLevel(mediumLOD, 50);
        
        // LOD baixo (muito simplificado)
        const lowLOD = model.clone();
        lowLOD.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const modifier = new THREE.SimplifyModifier();
                const simplified = modifier.modify(child.geometry, Math.floor(child.geometry.attributes.position.count * 0.1));
                child.geometry.dispose();
                child.geometry = simplified;
            }
        });
        lod.addLevel(lowLOD, 100);
        
        this.lodLevels.push(lod);
    };
    
    /**
     * Configurar instancing
     */
    ThreeJSViewerInstance.prototype.setupInstancing = function(model) {
        // Identificar objetos repetitivos para instancing
        const meshes = [];
        model.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });
        
        // Agrupar meshes similares
        const meshGroups = {};
        meshes.forEach(mesh => {
            const key = mesh.geometry.uuid + '_' + (mesh.material ? mesh.material.uuid : 'no-material');
            if (!meshGroups[key]) {
                meshGroups[key] = [];
            }
            meshGroups[key].push(mesh);
        });
        
        // Aplicar instancing para grupos grandes
        Object.values(meshGroups).forEach(group => {
            if (group.length > 5) {
                this.createInstancedMesh(group);
            }
        });
    };
    
    /**
     * Criar mesh instanciado
     */
    ThreeJSViewerInstance.prototype.createInstancedMesh = function(meshes) {
        if (meshes.length === 0) return;
        
        const firstMesh = meshes[0];
        const instancedMesh = new THREE.InstancedMesh(
            firstMesh.geometry,
            firstMesh.material,
            meshes.length
        );
        
        // Configurar matrizes de transformação
        meshes.forEach((mesh, index) => {
            const matrix = new THREE.Matrix4();
            matrix.compose(mesh.position, mesh.quaternion, mesh.scale);
            instancedMesh.setMatrixAt(index, matrix);
        });
        
        // Remover meshes originais e adicionar instanciado
        meshes.forEach(mesh => {
            mesh.parent.remove(mesh);
        });
        
        firstMesh.parent.add(instancedMesh);
    };
    
    /**
     * Configurar LOD dinâmico
     */
    ThreeJSViewerInstance.prototype.setupDynamicLOD = function(model) {
        // Ajustar qualidade baseado na performance
        this.updateLODQuality = () => {
            if (this.fps < 30 && this.currentLODLevel < this.lodLevels.length - 1) {
                this.currentLODLevel++;
                console.log('Reduzindo qualidade LOD para melhorar performance');
            } else if (this.fps > 55 && this.currentLODLevel > 0) {
                this.currentLODLevel--;
                console.log('Aumentando qualidade LOD');
            }
        };
    };
    
    // Inicializar widgets quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            ThreeJSViewer.initAll();
        });
    } else {
        ThreeJSViewer.initAll();
    }
    
})(jQuery); 