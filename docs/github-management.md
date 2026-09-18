# Maintenance map

The public branch is the focused Elementor viewer integration. Changes should
preserve model loading, camera interaction and Elementor mount/unmount behavior.

Server verification covers uploads, archive rejection and upload-capacity policy.
Browser verification should exercise editor rerenders, undo/redo, model replacement
and the published page. Test actual model resources, including a GLB and a glTF
with external assets, before widening compatibility claims.

Broader asset/studio workflows need their own coherent persistence, activation,
packaging and editor integration before becoming part of this branch.
