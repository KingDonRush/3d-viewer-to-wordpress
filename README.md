# 3D Viewer for WordPress and Elementor

A custom PHP/JavaScript plugin that embeds interactive 3D models in Elementor
pages. A dedicated Elementor widget and media control connect WordPress uploads
to a Three.js-based viewer for GLB/GLTF assets and supported ZIP packages.

**Independent integration prototype.** Useful evidence of custom Elementor
controls, media handling and browser rendering inside a CMS.

## Inspect the implementation

- [Plugin registration and upload policy](plugin.php).
- [Elementor widget](src/Elementor/Widget3DViewer.php) and [media control](src/Elementor/Controls/ViewerMediaControl.php).
- [Viewer core](assets/js/viewer-core.js) and [frontend lifecycle](assets/js/viewer-frontend.js).
- [Upload validation smoke scenario](tests/upload-validation-smoke.php) and
  [capacity-policy scenario](tests/upload-capacity-policy-smoke.php).

## Run in a development site

1. Copy this directory to `wp-content/plugins/3d-viewer-to-wordpress`.
2. Ensure Elementor is installed, then activate the plugin.
3. Add the 3D viewer widget to a page and choose a small test model.
4. Validate both the Elementor editor and the published page in your environment.

The smoke scripts require WordPress to be loaded (for example through `wp eval-file`).
They cannot be run as standalone PHP unit tests. This portfolio review checked PHP
syntax; it did not establish a WordPress/Elementor compatibility matrix or run those
integration scenarios. Hosting upload limits still apply. Treat uploaded archives
and third-party models as untrusted input and validate in an isolated development site.

## Development method and authorship

This is an independent project, not evidence of an employer or a client engagement.
The source was produced primarily or entirely by AI coding agents under Guilherme
Manoel da Silva's direction. His contribution includes product intent, requirements,
constraints, decomposition, product and architectural decisions through the agent
interface, iteration, validation and documentation. The repository demonstrates
the resulting system and process; it does not imply that he manually wrote every
component or can reproduce it unaided from memory.

## Em português

Integração de visualização 3D com WordPress e Elementor, incluindo widget, controle
de mídia, tratamento de uploads e renderização no navegador. Projeto independente;
não representa um serviço comercial comprovado nem uma auditoria de segurança.
