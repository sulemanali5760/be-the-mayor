"""Shared helpers for our Blender scripts: Blender 4.2 on CI (kits.py), 5.2 on the laptop (make_own.py).

Colours come from assets/palette.json. Models use one material, "palette", that reads the vertex
colour attribute "Color", so a model is one draw call and exports as COLOR_0 in glTF.
"""
import bpy, json, math, pathlib
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "models"
PALETTE = json.loads((ROOT / "assets" / "palette.json").read_text())
# flat {key: hex}: "grass", "roof.0", "wall.3", ...; the sky is for the world shader, not for models
PAL = {}
for _k, _v in PALETTE.items():
    if _k == "sky":
        continue
    if isinstance(_v, list):
        PAL.update({f"{_k}.{i}": c for i, c in enumerate(_v)})
    else:
        PAL[_k] = _v


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def pc(key):
    """Linear RGB of a palette key ("roof.0") or a raw hex ("#ff0000")."""
    return lin(PAL.get(key, key))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _nodes(m):
    try:
        m.use_nodes = True  # deprecated (always on) in Blender 5
    except Exception:
        pass
    return m.node_tree


def flat_material(name, hexcol, rough=0.9):
    m = bpy.data.materials.new(name)
    b = _nodes(m).nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*lin(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    return m


def palette_material(name="palette"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt = _nodes(m)
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = 0.65
    a = nt.nodes.new("ShaderNodeVertexColor")
    a.layer_name = "Color"
    nt.links.new(a.outputs["Color"], b.inputs["Base Color"])
    return m


def paint(o, rgb):
    """Give every face corner of o the linear colour rgb (the attribute is created if missing)."""
    me = o.data
    at = me.color_attributes.get("Color") or me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    at.data.foreach_set("color", [*rgb, 1.0] * len(at.data))
    return o


def use_palette(o):
    me = o.data
    me.materials.clear()
    me.materials.append(palette_material())
    for p in me.polygons:
        p.material_index = 0
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])


def meshes_of(roots):
    out = []
    for r in roots:
        for o in [r, *r.children_recursive]:
            if o.type == "MESH" and o not in out:
                out.append(o)
    return out


def bounds(meshes):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def tris(meshes):
    return sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)


def export_gltf(path, objs):
    """Self-contained .gltf with one embedded buffer (LESSONS H1)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.context.preferences.addons["io_scene_gltf2"].preferences.allow_embedded_format = True
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLTF_EMBEDDED", use_selection=True,
                              export_apply=True, export_yup=True, export_texcoords=False)


def import_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def label(text, loc, size, rot_x):
    cu = bpy.data.curves.new("label", "FONT")
    cu.body, cu.size, cu.align_x = text, size, "CENTER"
    o = bpy.data.objects.new("label", cu)
    bpy.context.scene.collection.objects.link(o)
    # the lines run down the tilted text plane; lift the block so the last line stays above the ground
    drop = (text.count("\n") + 0.3) * size * 1.2
    o.location = Vector(loc) + Vector((0, math.cos(rot_x), math.sin(rot_x))) * drop
    o.rotation_euler = (rot_x, 0, 0)
    ink = bpy.data.materials.get("ink") or flat_material("ink", "#2e3440")
    cu.materials.append(ink)
    return o


def grid_render(items, path, cols=10, cell=1.0, px=180, turn=-30, normalise=True, samples=16, el=35, k=2.4):
    """Lay items [(label, root objects)] out in a labelled grid, seen from the front (Blender -Y, which is
    +z in three.js) and above, each turned by `turn` degrees, and render one PNG with Cycles on the CPU."""
    sc = bpy.context.scene
    rows = max(1, math.ceil(len(items) / cols))
    # k: row spacing on the ground (in cells), so the rows don't overlap on screen
    e = math.radians(el)
    for i, (text, roots) in enumerate(items):
        c, r = i % cols, i // cols
        x, y = c * cell, (rows - 1 - r) * cell * k
        meshes = meshes_of(roots)
        if meshes:
            lo, hi = bounds(meshes)
            size = hi - lo
            s = 0.7 * cell / (max(size) or 1) if normalise else 1.0
            piv = bpy.data.objects.new(f"cell{i}", None)
            sc.collection.objects.link(piv)
            for o in roots:
                o.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
                o.parent = piv
            piv.scale = (s, s, s)
            piv.rotation_euler.z = math.radians(turn)
            piv.location = (x, y, 0)
        label(text, (x, y - 0.62 * cell, 0.0), 0.075 * cell, math.pi / 2 - e)

    w = cols * cell
    v_lo = -0.62 * cell * math.sin(e) - 0.3 * cell
    v_hi = (rows - 1) * k * cell * math.sin(e) + 1.1 * cell
    h = v_hi - v_lo
    u = Vector((0, math.sin(e), math.cos(e)))
    d = Vector((0, math.cos(e), -math.sin(e)))
    target = Vector(((cols - 1) * cell / 2, 0, 0)) + u * ((v_lo + v_hi) / 2)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type, cam_data.ortho_scale, cam_data.sensor_fit = "ORTHO", w, "HORIZONTAL"
    cam_data.clip_end = 1000
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    cam.location = target - d * 200
    cam.rotation_euler = (math.pi / 2 - e, 0, 0)
    sc.camera = cam

    bpy.ops.mesh.primitive_plane_add(size=1, location=((cols - 1) * cell / 2, (rows - 1) * cell * k / 2, 0))
    g = bpy.context.active_object
    g.scale = (w * 3, rows * cell * k * 3 + 10, 1)
    g.data.materials.append(flat_material("ground", "#eef0e8", 1.0))
    world = bpy.data.worlds.new("sheet")
    sc.world = world
    bg = _nodes(world).nodes["Background"]
    bg.inputs["Color"].default_value = (0.8, 0.82, 0.85, 1)
    bg.inputs["Strength"].default_value = 0.65
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy, sun.angle = 2.6, math.radians(8)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(30), 0, math.radians(-35))

    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "Standard"
    sc.render.resolution_x = int(cols * px)
    sc.render.resolution_y = int(cols * px * h / w)
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    jpg = str(path).endswith(".jpg")
    sc.render.image_settings.file_format = "JPEG" if jpg else "PNG"
    if jpg:
        sc.render.image_settings.quality = 85
    sc.render.filepath = str(path)
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


# ---------- the character sheet: every rank outfit, hair, face, extra and animation ----------
def show(roots, visible, colours):
    """Render only the meshes named in `visible`; recolour materials by name ({"Shirt": "#hex"})."""
    for o in [x for r in roots for x in [r, *r.children_recursive]]:
        if o.type != "MESH":
            continue
        o.hide_render = o.name.split(".")[0] not in visible
        for s in o.material_slots:
            n = s.material.name.split(".")[0] if s.material else ""
            if colours.get(n):
                s.material = s.material.copy()
                s.material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lin(colours[n]), 1)


def pose(roots, anim):
    for a in [o for o in roots if o.type == "ARMATURE" and o.animation_data]:
        ad = a.animation_data
        acts = [s.action for t in ad.nla_tracks for s in t.strips] + [ad.action]
        for t in ad.nla_tracks:
            t.mute = True
        hit = [x for x in acts if x and x.name.split("_")[0].split(".")[0] == anim]
        ad.action = hit[0] if hit else None


def character_sheet(ch, path, frame=10):
    f = OUT / f"{ch['base']}.gltf"
    hairs, faces, skins, outfits = ch["hairs"], ch["faces"], ch["skins"], ch["outfits"]

    def cell(text, nodes, outfit, skin, hair, anim="idle"):
        roots = [x for x in import_gltf(f) if x.parent is None]
        show(roots, ch["body"] + ([hair["model"]] if hair.get("model") else []) + nodes + outfit["show"],
             {**outfit["colors"], "Skin": skin, "Hair": hair.get("color")})
        pose(roots, anim)
        return text, roots

    items = [cell(f"{o['rank']} {o['title']}", [faces[0]], o, skins[i % len(skins)], hairs[0]) for i, o in enumerate(outfits)]
    items += [cell(f"hair {h['id']}", [faces[i % len(faces)]], outfits[(i + 1) % len(outfits)], skins[-1 - i % len(skins)], h)
              for i, h in enumerate(hairs)]
    items += [cell(x, [x], outfits[1], skins[i], hairs[1]) for i, x in enumerate(faces)]
    none = {"show": [], "colors": outfits[2]["colors"]}
    items += [cell(f"extra {x['id']}", [faces[0], x["model"]], none, skins[2], hairs[i % len(hairs)])
              for i, x in enumerate(ch["extras"])]
    items += [cell(a, [faces[1]], outfits[4], skins[3], hairs[0], a) for a in ch["animations"].values()]
    bird = OUT / "bird.gltf"
    if bird.exists():
        roots = [x for x in import_gltf(bird) if x.parent is None]
        pose(roots, "fly")
        items.append(("bird", roots))
    bpy.context.scene.frame_set(frame)
    grid_render(items, path, cols=8, cell=2.2, px=220, normalise=False, samples=16, k=3.2)
