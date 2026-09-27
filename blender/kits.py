"""CI only (GitHub Actions, .github/workflows/kits.yml): convert the downloaded CC0 kits, then write
assets/manifest.json and the contact sheets in docs/art/.

Never run on the dev laptop: downloaded files are opened only on GitHub runners (docs/LESSONS.md A1).
  blender --background --factory-startup --python-exit-code 1 --python blender/kits.py

1. catalog (when tools/kits/kits.json has "catalog": true): every model of every kit, unconverted, in
   docs/art/catalog-<kit>.jpg, to choose parts and check which way they face.
2. convert: each recipe in "models" is imported, turned so its front faces +z (three.js), scaled to real
   metres, recoloured face by face to the nearest assets/palette.json colour (vertex colours, one material),
   joined into one mesh, re-origined to its bottom centre and exported as self-contained .gltf.
3. orphans: a model file with no recipe and no own_meta.json entry (a renamed recipe) is removed.
4. manifest and contact sheets: every assets/models/*.gltf, kits and own.
"""
import sys, json, math, pathlib, collections
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy
import numpy as np
from mathutils import Matrix, Vector
from common import (ROOT, OUT, PAL, lin, reset, use_palette, meshes_of, bounds, tris, export_gltf, import_gltf,
                    grid_render, character_sheet)

KITS = ROOT / "kits"  # unzipped by the workflow, never committed
CFG = json.loads((ROOT / "tools" / "kits" / "kits.json").read_text())
OWN_META = ROOT / "blender" / "own_meta.json"
OWN = json.loads(OWN_META.read_text()) if OWN_META.exists() else {"models": {}, "character": None}
REPO = "https://github.com/sulemanali5760/be-the-mayor"


def kit_files(kit):
    """{stem: path} of a kit's models, one per name: .glb before .gltf, then the shortest path."""
    ps = sorted((p for p in (KITS / kit).rglob("*") if p.suffix.lower() in (".glb", ".gltf")),
                key=lambda p: (p.suffix.lower() != ".glb", len(str(p)), str(p)))
    out = {}
    for p in ps:
        out.setdefault(p.stem, p)
    return dict(sorted(out.items()))


def find(kit, stem):
    hit = kit_files(kit).get(stem)
    if not hit:
        raise SystemExit(f"{kit}: no model named {stem}")
    return hit


def flatten(new):
    """Keep only the meshes, unparented, with their transforms applied to their own mesh data."""
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.data = o.data.copy()
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    return meshes


def join(meshes, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    use_palette(o)
    return o


# ---------- colour: nearest palette colour in CIELAB ----------
def to_lab(rgb):
    r, g, b = rgb
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return np.array([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


PAL_KEYS = list(PAL)
PAL_LAB = np.array([to_lab(lin(PAL[k])) for k in PAL_KEYS])


def srgb_hex(rgb_lin, step=16):
    """Linear RGB -> sRGB hex rounded to `step`, the key used for recolour overrides and logs."""
    out = []
    for c in rgb_lin:
        s = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        out.append(min(255, int(round(s * 255 / step) * step)))
    return "#" + "".join(f"{c:02x}" for c in out)


def material_source(m, cache):
    """(linear base colour, image pixels as an (h, w, 4) sRGB array or None) of a material."""
    if m is None:
        return np.ones(3), None
    if m.name in cache:
        return cache[m.name]
    base, img = np.ones(3), None
    if m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED" and not n.inputs["Base Color"].is_linked:
                base = np.array(n.inputs["Base Color"].default_value[:3])
            if n.type == "TEX_IMAGE" and n.image and img is None and not any(
                    l.to_socket.name == "Normal" or l.to_node.type == "NORMAL_MAP" for l in n.outputs["Color"].links):
                im = n.image
                w, h = im.size
                if w and h:
                    px = np.empty(w * h * 4, np.float32)
                    im.pixels.foreach_get(px)
                    img = px.reshape(h, w, 4)
    cache[m.name] = (base, img)
    return base, img


def recolour(o, overrides, log):
    me = o.data
    uv = me.uv_layers.active.data if me.uv_layers.active else None
    cache, cols = {}, []
    for p in me.polygons:
        m = o.material_slots[p.material_index].material if o.material_slots else None
        base, img = material_source(m, cache)
        c = base
        if img is not None and uv is not None:
            h, w = img.shape[:2]
            u = sum(uv[i].uv.x for i in p.loop_indices) / p.loop_total
            v = sum(uv[i].uv.y for i in p.loop_indices) / p.loop_total
            s = img[int((v % 1) * h) % h, int((u % 1) * w) % w, :3]
            c = np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4) * base
        q = srgb_hex(c)
        key = overrides.get(q) or PAL_KEYS[int(np.argmin(((PAL_LAB - to_lab(c)) ** 2).sum(1)))]
        log[(q, key)] += 1
        cols.append(lin(PAL[key]))
    at = me.color_attributes.get("Color") or me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    data = np.zeros((len(me.loops), 4), np.float32)
    data[:, 3] = 1
    for p, c in zip(me.polygons, cols):
        data[list(p.loop_indices), :3] = c
    at.data.foreach_set("color", data.ravel())


def place(o, rot=0.0, fit=None, length=None, height=None, scale=None):
    """Turn about the vertical, scale to real metres, then put the bottom centre at the origin."""
    o.data.transform(Matrix.Rotation(math.radians(rot), 4, "Z"))
    lo, hi = bounds([o])
    size = hi - lo
    s = scale or 1.0
    if fit:
        s = min(fit[0] / size.x, fit[1] / size.y)
    elif length:
        s = length / max(size.x, size.y)
    elif height:
        s = height / size.z
    o.data.transform(Matrix.Scale(s, 4))
    lo, hi = bounds([o])
    o.data.transform(Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))


# ---------- 1. catalog ----------
def catalog():
    for kit in CFG["kits"]:
        reset()
        items = []
        for p in kit_files(kit).values():
            try:
                new = import_gltf(p)
            except Exception as e:  # a broken file in a kit must not stop the catalog
                print(f"catalog: {kit}/{p.name}: {e}")
                continue
            roots = [o for o in new if o.parent is None]
            if meshes_of(roots):
                items.append((p.stem, roots))
        print(f"catalog {kit}: {len(items)} models")
        grid_render(items, ROOT / "docs" / "art" / f"catalog-{kit}.jpg", cols=14, px=150, turn=0, samples=8)


# ---------- 2. convert ----------
def convert(mid, r):
    reset()
    kit = CFG["kits"][r["kit"]]
    meshes = flatten(import_gltf(find(r["kit"], r["file"])))
    log = collections.Counter()
    overrides = {**kit.get("recolor", {}), **r.get("recolor", {})}
    for o in meshes:
        recolour(o, overrides, log)
    o = join(meshes, mid)
    place(o, r.get("rot", 0), r.get("fit"), r.get("len"), r.get("h"), r.get("scale"))
    export_gltf(OUT / f"{mid}.gltf", [o])
    top = ", ".join(f"{q}->{k} {n}" for (q, k), n in log.most_common(10))
    print(f"convert {mid} <- {r['kit']}/{r['file']}: {tris([o])} tris; colours {top}")


# ---------- 3. manifest and contact sheets ----------
def info(mid):
    if mid in CFG["models"]:
        kit = CFG["kits"][CFG["models"][mid]["kit"]]
        return {"source": kit["source"], "license": kit["license"], "url": kit["page"], "kind": CFG["models"][mid]["kind"]}
    m = OWN["models"][mid]
    return {"source": "own", "license": "own", "url": m.get("url", f"{REPO}/blob/main/blender/make_own.py"), "kind": m["kind"]}


def drop_orphans():
    """A model file that is neither a kit recipe nor listed by make_own.py (a renamed recipe) is removed."""
    for f in OUT.glob("*.gltf"):
        if f.stem not in CFG["models"] and f.stem not in OWN["models"]:
            print(f"removing {f.name}: no recipe and not an own model")
            f.unlink()


def manifest():
    models = {}
    for f in sorted(OUT.glob("*.gltf")):
        mid = f.stem
        g = json.loads(f.read_text())  # our own output
        reset()
        ms = meshes_of([o for o in import_gltf(f) if o.parent is None])
        lo, hi = bounds(ms)
        models[mid] = {"file": f"assets/models/{mid}.gltf", **info(mid), "tris": tris(ms),
                       "size": [round(hi.x - lo.x, 2), round(hi.z - lo.z, 2), round(hi.y - lo.y, 2)],
                       "footprint": [round(hi.x - lo.x, 2), round(hi.y - lo.y, 2)],
                       "nodes": [n.get("name", "") for n in g.get("nodes", [])],
                       "animations": [a.get("name", "") for a in g.get("animations", [])],
                       "draws": sum(len(m["primitives"]) for m in g.get("meshes", [])),
                       "kb": round(f.stat().st_size / 1024)}
    # rough budget: the 0.1 town's buildings (each id or type as a model, "_broken" when broken)
    town = json.loads((ROOT / "data" / "town.json").read_text())
    t = d = 0
    for b in town:
        mid = b["id"] if b["id"] in models else b["type"]
        if b.get("state") == "broken" and f"{mid}_broken" in models:
            mid = f"{mid}_broken"
        if mid in models:
            t, d = t + models[mid]["tris"], d + models[mid]["draws"]
    total = sum(f.stat().st_size for f in OUT.glob("*.gltf"))
    ch = OWN.get("character")
    out = {"palette": "assets/palette.json", "models": models, "character": ch,
           "budget": {"mb": round(total / 1048576, 2), "characterTris": models.get(ch["base"], {}).get("tris") if ch else None,
                      "townBuildings": {"tris": t, "draws": d}}}
    (ROOT / "assets" / "manifest.json").write_text(json.dumps(out, indent=1))
    print("budget", json.dumps(out["budget"]))
    return out


def sheet_town(man):
    reset()
    items = []
    for mid, m in man["models"].items():
        if m["kind"] in ("task", "character", "accessory"):
            continue
        roots = [o for o in import_gltf(OUT / m["file"].split("/")[-1]) if o.parent is None]
        w, h, dd = m["size"]
        items.append((f"{mid}\n{m['tris']} tris  {w}x{dd}x{h} m", roots))
    grid_render(items, ROOT / "docs" / "art" / "contact-town.png", cols=8, px=240, samples=16)


if CFG.get("catalog"):
    catalog()
for mid, r in CFG["models"].items():
    convert(mid, r)
drop_orphans()
man = manifest()
sheet_town(man)
if man["character"]:
    reset()
    character_sheet(man["character"], ROOT / "docs" / "art" / "contact-character.png")
