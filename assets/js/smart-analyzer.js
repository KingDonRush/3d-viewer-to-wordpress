/**
 * Analisador Inteligente de Conteúdo
 * Mostra análise detalhada do conteúdo do ZIP
 * 
 * @since 1.0.0
 */

(function($) {
    'use strict';
    
    /**
     * Classe do Analisador Inteligente
     */
    class ThreeJSSmartAnalyzer {
        
        constructor() {
            this.init();
        }
        
        /**
         * Inicializar
         */
        init() {
            this.bindEvents();
        }
        
        /**
         * Vincular eventos
         */
        bindEvents() {
            // Interceptar quando ZIP é carregado
            $(document).on('threejs_zip_loaded', (event, data) => {
                this.analyzeContent(data.zip_url, data.widget_id);
            });
            
            // Interceptar quando modelo é carregado
            $(document).on('threejs_model_loaded', (event, data) => {
                this.handleModelLoaded(data);
            });
        }
        
        /**
         * Handler para modelo carregado
         */
        handleModelLoaded(data) {
            const { model_url, widget_id } = data;
            
            if (!model_url) return;
            
            // Detectar tipo de arquivo
            const fileType = this.detectFileTypeFromUrl(model_url);
            
            if (fileType === 'zip') {
                // Analisar conteúdo do ZIP
                this.analyzeContent(model_url, widget_id);
            } else if (fileType === 'glb' || fileType === 'gltf') {
                // Analisar modelo direto
                this.analyzeDirectModel(model_url, widget_id, fileType);
            } else {
                // Arquivo não reconhecido
                this.showUnknownFileType(model_url, widget_id);
            }
        }
        
        /**
         * Detectar tipo de arquivo pela URL
         */
        detectFileTypeFromUrl(url) {
            const extension = url.toLowerCase().split('.').pop();
            
            if (extension === 'zip') return 'zip';
            if (extension === 'glb') return 'glb';
            if (extension === 'gltf') return 'gltf';
            
            return 'unknown';
        }
        
        /**
         * Analisar modelo direto (GLB/GLTF)
         */
        analyzeDirectModel(model_url, widget_id, fileType) {
            console.log('ThreeJS Smart Analyzer: Analisando modelo direto', model_url);
            
            // Detectar se é arquivo otimizado
            const isOptimized = this.detectOptimizedFile(model_url);
            
            // Criar análise para modelo direto
            const analysis = {
                type: '3d_model',
                files: [{
                    name: model_url.split('/').pop(),
                    size: 0, // Não conseguimos saber o tamanho sem baixar
                    type: 'model_3d'
                }],
                models: [{
                    name: model_url.split('/').pop(),
                    size: 0,
                    type: 'model_3d'
                }],
                textures: [],
                materials: [],
                animations: [],
                metadata: [],
                optimization: {
                    is_optimized: isOptimized,
                    level: isOptimized ? '1_second_render' : 'standard',
                    features: isOptimized ? [
                        'Texturas otimizadas (1024px/512px/256px)',
                        'Geometria Draco comprimida',
                        'Hierarquia simplificada',
                        'Materiais otimizados',
                        'Renderização em 1 segundo'
                    ] : []
                },
                recommendations: this.generateOptimizedRecommendations(fileType, isOptimized)
            };
            
            this.displayAnalysis(analysis, widget_id);
            this.handleRecommendations(analysis, widget_id);
        }
        
        /**
         * Detectar se arquivo foi otimizado
         */
        detectOptimizedFile(url) {
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
        }
        
        /**
         * Gerar recomendações para modelos otimizados
         */
        generateOptimizedRecommendations(fileType, isOptimized) {
            const recommendations = [];
            
            if (isOptimized) {
                recommendations.push({
                    type: 'success',
                    message: `Modelo ${fileType.toUpperCase()} otimizado detectado - processamento prioritário`
                });
            } else {
                recommendations.push({
                    type: 'success',
                    message: `Modelo ${fileType.toUpperCase()} detectado - formato otimizado para web`
                });
                recommendations.push({
                    type: 'info',
                    message: 'Modelo carregado diretamente - sem arquivos adicionais'
                });
            }
            
            return recommendations;
        }
        
        /**
         * Mostrar arquivo de tipo desconhecido
         */
        showUnknownFileType(model_url, widget_id) {
            console.log('ThreeJS Smart Analyzer: Tipo de arquivo desconhecido', model_url);
            
            const analysis = {
                type: 'unknown',
                files: [{
                    name: model_url.split('/').pop(),
                    size: 0,
                    type: 'unknown'
                }],
                recommendations: [
                    {
                        type: 'warning',
                        message: 'Tipo de arquivo não reconhecido - pode não funcionar corretamente'
                    }
                ]
            };
            
            this.displayAnalysis(analysis, widget_id);
            this.handleRecommendations(analysis, widget_id);
        }
        
        /**
         * Analisar conteúdo
         */
        analyzeContent(zip_url, widget_id) {
            console.log('ThreeJS Smart Analyzer: Analisando conteúdo do ZIP', zip_url);
            
            $.ajax({
                url: threejs_analyzer_config.ajax_url,
                type: 'POST',
                data: {
                    action: 'threejs_analyze_zip',
                    nonce: threejs_analyzer_config.nonce,
                    zip_url: zip_url
                },
                success: (response) => {
                    if (response.success) {
                        this.displayAnalysis(response.data, widget_id);
                        this.handleRecommendations(response.data, widget_id);
                    } else {
                        console.error('ThreeJS Smart Analyzer: Erro na análise', response.data);
                    }
                },
                error: (xhr, status, error) => {
                    console.error('ThreeJS Smart Analyzer: Erro na requisição', error);
                }
            });
        }
        
        /**
         * Exibir análise
         */
        displayAnalysis(analysis, widget_id) {
            const viewer = document.getElementById(widget_id);
            if (!viewer) return;
            
            // Criar painel de análise
            let analysisPanel = viewer.querySelector('.smart-analysis-panel');
            if (!analysisPanel) {
                analysisPanel = document.createElement('div');
                analysisPanel.className = 'smart-analysis-panel';
                analysisPanel.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    font-size: 12px;
                    max-width: 300px;
                    z-index: 1000;
                    backdrop-filter: blur(10px);
                `;
                viewer.style.position = 'relative';
                viewer.appendChild(analysisPanel);
            }
            
            // Verificar se é modelo otimizado
            const isOptimized = analysis.optimization && analysis.optimization.is_optimized;
            
            // Conteúdo do painel
            let content = `
                <div style="margin-bottom: 10px;">
                    <strong>📦 Análise Inteligente</strong>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="float: right; background: none; border: none; color: white; cursor: pointer;">✕</button>
                </div>
            `;
            
            // Informações de otimização (simplificadas)
            if (isOptimized) {
                content += `
                    <div style="margin-bottom: 10px; padding: 8px; background: rgba(76, 175, 80, 0.2); border-radius: 4px; border-left: 3px solid #4CAF50;">
                        <div style="font-weight: bold; color: #4CAF50;">
                            Modelo Otimizado - Processamento Prioritário
                        </div>
                    </div>
                `;
            }
            
            // Tipo de conteúdo
            content += `<div><strong>Tipo:</strong> ${this.getTypeLabel(analysis.type)}</div>`;
            
            // Estatísticas
            content += `<div><strong>Arquivos:</strong> ${analysis.files.length}</div>`;
            
            if (analysis.models && analysis.models.length > 0) {
                content += `<div><strong>Modelos:</strong> ${analysis.models.length}</div>`;
            }
            
            if (analysis.textures && analysis.textures.length > 0) {
                content += `<div><strong>Texturas:</strong> ${analysis.textures.length}</div>`;
            }
            
            if (analysis.materials && analysis.materials.length > 0) {
                content += `<div><strong>Materiais:</strong> ${analysis.materials.length}</div>`;
            }
            
            if (analysis.animations && analysis.animations.length > 0) {
                content += `<div><strong>Animações:</strong> ${analysis.animations.length}</div>`;
            }
            
            // Tamanho total
            const totalSize = analysis.files.reduce((sum, file) => sum + file.size, 0);
            content += `<div><strong>Tamanho:</strong> ${this.formatBytes(totalSize)}</div>`;
            
            analysisPanel.innerHTML = content;
            
            // Auto-remover após 10 segundos
            setTimeout(() => {
                if (analysisPanel && analysisPanel.parentNode) {
                    analysisPanel.parentNode.removeChild(analysisPanel);
                }
            }, 10000);
        }
        
        /**
         * Tratar recomendações
         */
        handleRecommendations(analysis, widget_id) {
            if (!analysis.recommendations || analysis.recommendations.length === 0) {
                return;
            }
            
            const viewer = document.getElementById(widget_id);
            if (!viewer) return;
            
            // Criar painel de recomendações
            let recommendationsPanel = viewer.querySelector('.recommendations-panel');
            if (!recommendationsPanel) {
                recommendationsPanel = document.createElement('div');
                recommendationsPanel.className = 'recommendations-panel';
                recommendationsPanel.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    font-size: 12px;
                    max-width: 300px;
                    z-index: 1000;
                    backdrop-filter: blur(10px);
                `;
                viewer.appendChild(recommendationsPanel);
            }
            
            // Filtrar recomendações importantes
            const importantRecommendations = analysis.recommendations.filter(rec => 
                rec.type === 'warning' || rec.type === 'error'
            );
            
            if (importantRecommendations.length === 0) {
                return;
            }
            
            let content = `
                <div style="margin-bottom: 10px;">
                    <strong>⚠️ Recomendações</strong>
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="float: right; background: none; border: none; color: white; cursor: pointer;">✕</button>
                </div>
            `;
            
            importantRecommendations.forEach(rec => {
                const icon = rec.type === 'warning' ? '⚠️' : '❌';
                content += `<div style="margin-bottom: 5px;">${icon} ${rec.message}</div>`;
            });
            
            recommendationsPanel.innerHTML = content;
            
            // Auto-remover após 15 segundos
            setTimeout(() => {
                if (recommendationsPanel && recommendationsPanel.parentNode) {
                    recommendationsPanel.parentNode.removeChild(recommendationsPanel);
                }
            }, 15000);
        }
        
        /**
         * Obter label do tipo
         */
        getTypeLabel(type) {
            const labels = {
                '3d_model': '🎯 Modelo 3D',
                'texture_pack': '🎨 Pack de Texturas',
                'material_library': '🔧 Biblioteca de Materiais',
                'animation_pack': '🎬 Pack de Animações',
                'unknown': '❓ Tipo Desconhecido'
            };
            
            return labels[type] || labels.unknown;
        }
        
        /**
         * Formatar bytes
         */
        formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        /**
         * Analisar conteúdo manualmente
         */
        analyzeContentManually(zip_url, widget_id) {
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: threejs_analyzer_config.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'threejs_analyze_zip',
                        nonce: threejs_analyzer_config.nonce,
                        zip_url: zip_url
                    },
                    success: (response) => {
                        if (response.success) {
                            this.displayAnalysis(response.data, widget_id);
                            this.handleRecommendations(response.data, widget_id);
                            resolve(response.data);
                        } else {
                            reject(response.data);
                        }
                    },
                    error: (xhr, status, error) => {
                        reject(error);
                    }
                });
            });
        }
    }
    
    // Inicializar quando DOM estiver pronto
    $(document).ready(() => {
        window.threejsSmartAnalyzer = new ThreeJSSmartAnalyzer();
    });
    
    // Expor métodos globais
    window.ThreeJSSmartAnalyzer = {
        analyzeContent: (zip_url, widget_id) => {
            if (window.threejsSmartAnalyzer) {
                return window.threejsSmartAnalyzer.analyzeContentManually(zip_url, widget_id);
            }
            return Promise.reject('Smart Analyzer não inicializado');
        }
    };
    
})(jQuery); 