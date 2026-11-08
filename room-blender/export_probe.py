# spike の .blend を読んで、三角形の数と glb の大きさを測る
import bpy, os, sys
argv = sys.argv[sys.argv.index('--') + 1:]
out = os.path.abspath(argv[0])
for ob in list(bpy.data.objects):
    if ob.type == 'CURVE':
        bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        bpy.ops.object.convert(target='MESH'); ob.select_set(False)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        me = ob.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
print('TRIS', tris)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_draco_mesh_compression_enable=True, export_materials='EXPORT')
print('SIZE', os.path.getsize(out))
