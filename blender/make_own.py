"""Be the Mayor's own models: the signature buildings (town hall with its clock, the bridge, Frau Keller's
house), the other town buildings, the broken prop set, a bird, and the rigged character with its hairs,
faces, rank outfits and wardrobe extras.

Procedural geometry in assets/palette.json colours only; this script never opens a downloaded file.
Run headless on the laptop (LESSONS A3):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python blender/make_own.py -- [preview_dir]
Writes assets/models/<id>.gltf and blender/own_meta.json; with a directory, also renders own-town.png and
own-character.png there (the same sheets CI renders into docs/art/).

Conventions: metres, Blender Z up, the front faces -Y (= +z in three.js), origin at the bottom centre.
Buildings use the vertex-colour "palette" material (one draw call); the character uses named materials
(Skin, Hair, Shirt, Pants, Shoes, Jacket) so outfits are material swaps.
"""
import sys, json, math, pathlib, random
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bpy, bmesh
from mathutils import Euler, Matrix, Vector
from common import (ROOT, OUT, pc, reset, paint, use_palette, flat_material, export_gltf, import_gltf, grid_render,
                    character_sheet)

META = {}
random.seed(3)


# ---------- geometry helpers ----------
def xf(at=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
    return (Matrix.Translation(at) @ Euler([math.radians(a) for a in r]).to_matrix().to_4x4()
            @ Matrix.Diagonal((*s, 1)))


def mk(bm, name="part"):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def prim(build, col, m):
    bm = bmesh.new()
    build(bm)
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    o = mk(bm)
    return paint(o, pc(col)) if col else o


def box(size, at, col, r=(0, 0, 0)):
    return prim(lambda bm: bmesh.ops.create_cube(bm, size=1.0), col, xf(at, r, size))


def cyl(rad, h, at, col, n=12, r2=None, r=(0, 0, 0), s=(1, 1, 1)):
    """Cylinder (or frustum) standing on `at`, along its local Z."""
    def f(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=rad, radius2=rad if r2 is None else r2, depth=h)
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    return prim(f, col, xf(at, r, s))


def cone(rad, h, at, col, n=8, r=(0, 0, 0), s=(1, 1, 1)):
    def f(bm):
        ring = [bm.verts.new((rad * math.cos(2 * math.pi * i / n), rad * math.sin(2 * math.pi * i / n), 0)) for i in range(n)]
        tip = bm.verts.new((0, 0, h))
        for i in range(n):
            bm.faces.new((ring[i], ring[(i + 1) % n], tip))
        bm.faces.new(list(reversed(ring)))
    return prim(f, col, xf(at, r, s))


def ball(rad, at, col, n=10, rings=7, s=(1, 1, 1), r=(0, 0, 0)):
    return prim(lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=n, v_segments=rings, radius=rad), col, xf(at, r, s))


def blob(rad, at, col, sub=1, s=(1, 1, 1), jitter=0.12):
    """Lumpy icosphere: tree canopies, bushes, rubbish bags."""
    def f(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=rad)
        for v in bm.verts:
            v.co *= 1 + random.uniform(-jitter, jitter)
    return prim(f, col, xf(at, (0, 0, random.uniform(0, 360)), s))


def torus(R, rr, at, col, n=12, m=6, r=(0, 0, 0), s=(1, 1, 1)):
    def f(bm):
        rings = []
        for i in range(n):
            a = 2 * math.pi * i / n
            c, d = Vector((math.cos(a), math.sin(a), 0)), Vector((0, 0, 1))
            rings.append([bm.verts.new(c * (R + rr * math.cos(2 * math.pi * j / m)) + d * rr * math.sin(2 * math.pi * j / m))
                          for j in range(m)])
        for i in range(n):
            a, b = rings[i], rings[(i + 1) % n]
            for j in range(m):
                bm.faces.new((a[j], b[j], b[(j + 1) % m], a[(j + 1) % m]))
    return prim(f, col, xf(at, r, s))


def extrude_profile(pts, x0, x1, col):
    """A 2D profile in the Y-Z plane, extruded along X from x0 to x1 (the bridge)."""
    def f(bm):
        a = [bm.verts.new((x0, y, z)) for y, z in pts]
        b = [bm.verts.new((x1, y, z)) for y, z in pts]
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        k = len(pts)
        for i in range(k):
            bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return prim(f, col, Matrix.Identity(4))


def move(objs, at=(0, 0, 0), rz=0.0):
    m = Matrix.Translation(at) @ Matrix.Rotation(math.radians(rz), 4, "Z")
    for o in objs:
        o.data.transform(m)
    return objs


def join(parts, name, smooth=True):
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    if smooth:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return o


def model(mid, parts, kind, extra=None):
    """Join parts into one palette mesh called mid (plus named extra nodes {name: (parts, pivot)}) and export."""
    o = join(parts, mid)
    use_palette(o)
    objs = [o]
    for name, (ps, pivot) in (extra or {}).items():
        e = join(ps, name)
        use_palette(e)
        e.data.transform(Matrix.Translation(-Vector(pivot)))
        e.location = pivot
        objs.append(e)
    export_gltf(OUT / f"{mid}.gltf", objs)
    META[mid] = {"kind": kind}
    print(f"own {mid}: {sum(len(p.vertices) - 2 for x in objs for p in x.data.polygons)} tris")
    reset()


# ---------- building parts (made facing -Y at the origin, then moved) ----------
def gable(w, d, rise, z0, col, over=0.35, thick=0.2, fill="wall.0", y=0.0):
    """Gable roof, ridge along X; the triangular ends are filled in the wall colour."""
    a = math.atan2(rise, d / 2)
    run = (d / 2 + over) / math.cos(a)
    parts = []
    for s in (-1, 1):
        ridge = Vector((0, y, z0 + rise))
        eave = Vector((0, y + s * (d / 2 + over), z0 + rise - (d / 2 + over) * math.tan(a)))
        n = Vector((0, s * math.sin(a), math.cos(a)))
        parts.append(box((w + 2 * over * 0.6, run, thick), (ridge + eave) / 2 + n * thick / 2, col, (-s * math.degrees(a), 0, 0)))

    def f(bm):
        v = [bm.verts.new(p) for p in ((-w / 2, y - d / 2, z0), (-w / 2, y + d / 2, z0), (-w / 2, y, z0 + rise),
                                        (w / 2, y - d / 2, z0), (w / 2, y + d / 2, z0), (w / 2, y, z0 + rise))]
        for q in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (0, 2, 5, 3), (1, 4, 5, 2)):
            bm.faces.new([v[i] for i in q])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(prim(f, fill, Matrix.Identity(4)))
    return parts


def window(w, h, frame="accent.4", shutters=None, flowers=None, cross=True):
    """A window on a wall at y=0, centred at the origin, facing -Y."""
    t = 0.08
    p = [box((w, 0.06, h), (0, -0.01, 0), "glass"),
         box((w + 2 * t, t, t), (0, -0.05, h / 2 + t / 2), frame), box((w + 2 * t, t, t), (0, -0.05, -h / 2 - t / 2), frame),
         box((t, t, h), (-w / 2 - t / 2, -0.05, 0), frame), box((t, t, h), (w / 2 + t / 2, -0.05, 0), frame),
         box((w + 0.3, 0.22, 0.07), (0, -0.1, -h / 2 - t - 0.035), frame)]
    if cross:
        p += [box((0.05, 0.05, h), (0, -0.05, 0), frame), box((w, 0.05, 0.05), (0, -0.05, 0), frame)]
    if shutters:
        p += [box((w / 2, 0.05, h + 0.1), (sx * (w * 0.75 + t + 0.04), -0.04, 0), shutters) for sx in (-1, 1)]
    if flowers:
        z = -h / 2 - t - 0.2
        p.append(box((w + 0.1, 0.24, 0.18), (0, -0.14, z), "wood.0"))
        p += [ball(0.09, (x, -0.14, z + 0.12), flowers[i % len(flowers)], 6, 4)
              for i, x in enumerate([w * (k / 4 - 0.5) + w / 8 for k in range(4)])]
    return p


def door(w, h, col, knob="gold", frame="accent.4"):
    """A door standing on z=0 at y=0, facing -Y."""
    return [box((w, 0.1, h), (0, -0.03, h / 2), col), box((w + 0.24, 0.08, 0.12), (0, -0.06, h + 0.06), frame),
            box((0.12, 0.08, h), (-w / 2 - 0.06, -0.06, h / 2), frame), box((0.12, 0.08, h), (w / 2 + 0.06, -0.06, h / 2), frame),
            ball(0.05, (w * 0.32, -0.1, h * 0.48), knob, 6, 4)]


def awning(w, depth, z, cols, stripes=7, drop=0.3):
    """A striped awning on a wall at y=0, top edge at height z, sloping out to -Y."""
    a = math.atan2(drop, depth)
    run = math.hypot(depth, drop)
    sw = w / stripes
    p = []
    for i in range(stripes):
        x = -w / 2 + sw * (i + 0.5)
        c = cols[i % len(cols)]
        p.append(box((sw, run, 0.06), (x, -depth / 2, z - drop / 2), c, (-math.degrees(a), 0, 0)))
        p.append(box((sw, 0.04, 0.22), (x, -depth - 0.01, z - drop - 0.1), c))
    return p


def tree(at, h=3.2, col="leaf.0", r=1.1):
    x, y, z = at
    return [cyl(0.14, h * 0.45, (x, y, z), "wood.1", 7, r2=0.1),
            blob(r, (x, y, z + h * 0.62), col, 1, (1, 1, 0.9)),
            blob(r * 0.7, (x + r * 0.45, y - r * 0.2, z + h * 0.5), col, 1),
            blob(r * 0.65, (x - r * 0.4, y + r * 0.25, z + h * 0.78), col, 1)]


def bench(at, rz=0, broken=False):
    p = [box((1.6, 0.14, 0.06), (0, -0.12 + 0.16 * i, 0.45), "wood.0") for i in range(3) if not (broken and i == 1)]
    p += [box((1.6, 0.06, 0.14), (0, 0.24, 0.62 + 0.18 * i), "wood.0") for i in range(2)]
    p += [box((0.08, 0.5, 0.45), (sx * 0.65, 0.05, 0.225), "metal.1") for sx in (-1, 1)]
    p += [box((0.08, 0.06, 0.42), (sx * 0.65, 0.27, 0.66), "metal.1") for sx in (-1, 1)]
    return move(p, at, rz)


def flowers(at, n, cols, spread=0.5, z=0.0):
    x, y = at
    return [ball(0.1, (x + random.uniform(-spread, spread), y + random.uniform(-spread * 0.5, spread * 0.5), z + 0.12),
                 cols[i % len(cols)], 6, 4) for i in range(n)]


BRIGHT = ["accent.1", "accent.0", "accent.3", "roof.3", "accent.4"]


# ---------- signature buildings ----------
def make_townhall():
    p = [box((12, 7.4, 0.4), (0, 0.3, 0.2), "stone.0"),
         box((11, 6.2, 5.4), (0, 0.5, 3.1), "wall.0"),
         box((11.3, 6.5, 0.25), (0, 0.5, 3.1), "wall.4"), box((11.3, 6.5, 0.3), (0, 0.5, 5.85), "wall.4")]
    p += gable(11, 6.2, 2.4, 6.0, "roof.0", over=0.45, fill="wall.0", y=0.5)
    p += [box((3.6, 3.0, 8.8), (0, -1.9, 4.8), "wall.1"), box((4.0, 3.4, 0.3), (0, -1.9, 9.2), "wall.4"),
          box((4.0, 3.4, 0.25), (0, -1.9, 6.0), "wall.4"),
          cone(2.75, 1.9, (0, -1.9, 9.35), "roof.2", 4, (0, 0, 45), (1, 0.85, 1)),
          cyl(0.04, 1.3, (0, -1.9, 11.1), "metal.1", 6),
          box((0.8, 0.04, 0.5), (0.42, -1.9, 12.1), "accent.3")]
    for i, (d, z) in enumerate(((0.6, 0.065), (0.4, 0.195), (0.2, 0.325))):  # steps up to the plinth
        p.append(box((3.8, d, 0.13), (0, -3.4 - d / 2, z), "stone.0"))
    p += [cyl(0.2, 3.25, (sx * 1.25, -3.75, 0.13), "accent.4", 10) for sx in (-1, 1)]
    p += [box((3.2, 0.8, 0.22), (0, -3.6, 3.5), "wall.4")]
    p += move(door(1.5, 2.5, "wood.1"), (0, -3.4, 0.4))
    p += move(window(0.9, 1.1), (0, -3.4, 5.1))
    for x in (-4.4, -2.9, 2.9, 4.4):
        p += move(window(0.95, 1.4, flowers=BRIGHT[:3]), (x, -2.6, 1.9))
        p += move(window(0.95, 1.3), (x, -2.6, 4.4))
    for sx in (-1, 1):
        for z in (1.9, 4.4):
            p += move(window(1.0, 1.3), (sx * 5.5, 0.5, z), 90 * sx)
    # the clock, 1.05 m across, on the front of the tower; the hands turn about the front axis (+z in three.js)
    cz, cy = 7.5, -3.4
    p += [cyl(1.05, 0.12, (0, cy, cz), "accent.4", 20, r=(90, 0, 0)), torus(1.05, 0.08, (0, cy - 0.12, cz), "gold", 20, 5, (90, 0, 0))]
    for i in range(12):  # hour ticks, pointing out from the centre
        a = math.radians(i * 30)
        p.append(box((0.08, 0.04, 0.2 if i % 3 else 0.3), (0.82 * math.sin(a), cy - 0.14, cz + 0.82 * math.cos(a)), "accent.5", (0, i * 30, 0)))
    hour = [box((0.12, 0.04, 0.55), (0, cy - 0.17, cz + 0.22), "accent.5"), ball(0.09, (0, cy - 0.18, cz), "gold", 8, 5)]
    minute = [box((0.08, 0.04, 0.82), (0, cy - 0.21, cz + 0.36), "accent.5")]
    model("townhall", p, "building", {"clock_hour": (hour, (0, cy, cz)), "clock_minute": (minute, (0, cy, cz))})


def make_keller_house():
    p = [box((5.5, 4.5, 0.3), (0, 0, 0.15), "stone.1"), box((5.2, 4.2, 2.7), (0, 0, 1.65), "wall.1")]
    p += gable(5.2, 4.2, 1.8, 3.0, "roof.0", over=0.4, fill="wall.1")
    p += [box((0.55, 0.55, 1.5), (1.5, 0.9, 4.2), "stone.0"), box((0.7, 0.7, 0.15), (1.5, 0.9, 5.0), "stone.1")]
    p += move(door(0.95, 1.95, "accent.2"), (-1.2, -2.1, 0.3))
    p += [box((1.5, 0.8, 0.12), (-1.2, -2.45, 2.55), "roof.0", (-8, 0, 0))]
    p += [cyl(0.05, 2.25, (sx, -2.75, 0.3), "wood.0", 6) for sx in (-1.85, -0.55)]
    p += move(window(1.1, 1.0, shutters="accent.2", flowers=["accent.1", "accent.3", "accent.0"]), (1.1, -2.1, 1.8))
    for sx in (-1, 1):
        p += move(window(0.8, 0.9, shutters="accent.2"), (sx * 2.6, 0.2, 1.8), 90 * sx)
        p += [cyl(0.35, 0.1, (sx * 2.62, 0, 3.75), "accent.4", 12, r=(0, 90 * sx, 0)),
              cyl(0.27, 0.1, (sx * 2.66, 0, 3.75), "glass", 12, r=(0, 90 * sx, 0))]
    p += [cyl(0.04, 1.0, (-2.45, -2.75, 0), "wood.1", 6), box((0.3, 0.4, 0.25), (-2.45, -2.75, 1.1), "accent.3")]
    p += flowers((0.6, -2.55), 6, ["accent.1", "roof.3", "accent.3"], 0.9)
    p += [blob(0.4, (2.3, -2.5, 0.35), "leaf.1", 1, (1, 1, 0.8))]
    model("keller_house", p, "building")


def bridge_profile(y0, y1, n=6):
    """Top of the deck from y0 to y1 on the arch z = 0.3 + 1.0 cos(pi y / 12)."""
    ys = [y0 + (y1 - y0) * i / n for i in range(n + 1)]
    return [(y, 0.3 + 1.0 * math.cos(math.pi * y / 12)) for y in ys]


def bridge_span(y0, y1, broken_end=None):
    top = bridge_profile(y0, y1)
    arch = lambda y: max(0.0, 0.85 * math.cos(math.pi * y / 7)) if abs(y) < 3.5 else 0.0
    bottom = [(y, arch(y)) for y, _ in reversed(top)]
    if broken_end is not None:  # a ragged edge where the deck fell in
        e = top[-1] if broken_end > 0 else top[0]
        rag = [(e[0] - 0.25 * broken_end, e[1] - 0.35), (e[0], e[1] - 0.6)]
        pts = top + rag + bottom if broken_end > 0 else [(e[0], e[1] - 0.6), (e[0] + 0.25, e[1] - 0.35)] + top + bottom
    else:
        pts = top + bottom
    p = [extrude_profile(pts, -1.7, 1.7, "stone.0")]
    for sx in (-1, 1):  # parapets follow the deck, capped
        wall = [(y, z + 0.55) for y, z in top] + [(y, z - 0.05) for y, z in reversed(top)]
        p.append(extrude_profile(wall, sx * 1.95 - 0.25, sx * 1.95 + 0.25, "stone.1"))
        cap = [(y, z + 0.64) for y, z in top] + [(y, z + 0.52) for y, z in reversed(top)]
        p.append(extrude_profile(cap, sx * 1.95 - 0.3, sx * 1.95 + 0.3, "stone.0"))
    for (ya, za), (yb, zb) in zip(top, top[1:]):  # plank deck
        a = math.degrees(math.atan2(zb - za, yb - ya))
        p.append(box((3.3, math.hypot(yb - ya, zb - za) - 0.06, 0.08), (0, (ya + yb) / 2, (za + zb) / 2 + 0.04), "wood.0", (a, 0, 0)))
    return p


def make_bridge():
    p = bridge_span(-6, 6)
    p += [cyl(0.12, 0.7, (sx * 1.95, sy * 5.8, 0.85), "stone.1", 8) for sx in (-1, 1) for sy in (-1, 1)]
    p += [ball(0.2, (sx * 1.95, sy * 5.8, 1.6), "stone.0", 8, 5) for sx in (-1, 1) for sy in (-1, 1)]
    model("bridge", p, "building")
    p = bridge_span(-6, -1.0, 1) + bridge_span(1.2, 6, -1)
    p += [box((0.5, 0.4, 0.3), (random.uniform(-1.5, 1.5), random.uniform(-0.8, 0.8), 0.15), "stone.0",
              (random.uniform(0, 30), 0, random.uniform(0, 90))) for _ in range(5)]
    p += [box((2.6, 0.25, 0.08), (0.4, 0.1, 0.4), "wood.0", (15, 0, 30))]
    model("bridge_broken", p, "building")


# ---------- other town buildings ----------
def shopfront(w, d, h, wall, roof, stripes, sign="accent.4"):
    """Body, flat roof with a parapet, two windows, a door, a striped awning and a sign board."""
    p = [box((w + 0.3, d + 0.3, 0.2), (0, 0.2, 0.1), "stone.1"), box((w, d, h), (0, 0.2, 0.2 + h / 2), wall),
         box((w + 0.3, d + 0.3, 0.3), (0, 0.2, h + 0.35), roof), box((w + 0.3, 0.2, 0.5), (0, 0.2 - d / 2 - 0.05, h + 0.6), roof)]
    yf = 0.2 - d / 2
    p += move(door(1.0, 2.1, "glass", frame=sign), (0, yf, 0.2))
    for sx in (-1, 1):
        p += move(window(1.5, 1.3, frame=sign, cross=False), (sx * (w / 4 + 0.35), yf, 1.35))
    p += move(awning(w - 0.3, 0.75, h - 0.2, stripes), (0, yf, 0.2))
    p += [box((w * 0.55, 0.14, 0.7), (0, yf - 0.08, h + 0.55), sign)]
    return p, yf


def make_cafe():
    p, yf = shopfront(6.4, 4.0, 3.1, "wall.2", "roof.1", ["accent.3", "accent.4"])
    p += [cyl(0.42, 0.55, (0, yf + 0.3, 3.75), "accent.4", 12), cyl(0.36, 0.04, (0, yf + 0.3, 4.28), "wood.1", 12),
          torus(0.17, 0.06, (0.46, yf + 0.3, 4.02), "accent.4", 8, 4, (90, 0, 0)), cyl(0.6, 0.06, (0, yf + 0.3, 3.7), "accent.4", 12),
          box((0.5, 0.35, 0.9), (2.6, yf - 0.45, 0.45), "accent.5", (0, 0, 10)), box((0.42, 0.02, 0.6), (2.6, yf - 0.64, 0.55), "accent.4", (0, 0, 10))]
    p += [cyl(0.2, 0.35, (sx * 0.9, yf - 0.25, 0), "roof.5", 8, r2=0.25) for sx in (-1, 1)]
    p += [blob(0.28, (sx * 0.9, yf - 0.25, 0.55), "leaf.0", 1) for sx in (-1, 1)]
    model("cafe", p, "building")


def make_shop():
    p, yf = shopfront(6.4, 4.0, 3.1, "wall.3", "roof.2", ["roof.2", "accent.4"])
    for i, x in enumerate((-2.2, -1.4, 1.4, 2.2)):
        p += [box((0.7, 0.5, 0.35), (x, yf - 0.4, 0.3), "wood.0", (8, 0, 0))]
        p += [ball(0.1, (x + dx, yf - 0.42, 0.52), ["accent.3", "roof.1", "leaf.2", "accent.0"][i], 6, 4) for dx in (-0.2, 0, 0.2)]
        p += [box((0.08, 0.08, 0.3), (x + sx * 0.3, yf - 0.4, 0.1), "wood.1") for sx in (-1, 1)]
    model("shop", p, "building")


def make_pharmacy():
    p, yf = shopfront(6.0, 4.0, 3.3, "wall.0", "roof.4", ["roof.4", "accent.4"])
    for c in [(0, yf - 0.2, 4.35), (3.45, yf + 0.9, 2.6)]:  # green crosses: over the door, and hanging off the side
        p += [box((0.9, 0.12, 0.9), c, "accent.4"), box((0.7, 0.16, 0.22), c, "roof.4"), box((0.22, 0.16, 0.7), c, "roof.4")]
    p += [box((0.6, 0.08, 0.08), (3.3, yf + 0.9, 3.1), "metal.1")]
    model("pharmacy", p, "building")


def make_kiosk():
    p = [box((3.8, 2.8, 0.2), (0, 0.4, 0.1), "stone.1"), box((3.4, 2.4, 2.4), (0, 0.4, 1.4), "wall.1"),
         box((3.9, 2.9, 0.22), (0, 0.4, 2.71), "roof.1"), box((2.4, 0.14, 0.55), (0, -0.85, 3.1), "accent.0"),
         box((2.2, 0.1, 1.0), (0, -0.82, 1.55), "accent.5"), box((2.4, 0.5, 0.1), (0, -1.05, 1.0), "wood.0")]
    p += move(awning(3.2, 0.7, 2.5, ["accent.0", "accent.4"], 6), (0, -0.8, 0))
    p += [box((0.6, 0.4, 1.1), (2.3, -0.6, 0.55), "roof.2")]
    p += [box((0.5, 0.04, 0.3), (2.3, -0.82, 0.35 + 0.25 * i), ["accent.4", "accent.0", "accent.1"][i], (-10, 0, 0)) for i in range(3)]
    p += [box((0.5, 0.5, 0.6), (-2.3, -0.5, 0.3), "wood.0"), cyl(0.3, 0.8, (-2.3, -0.5, 0.6), "accent.3", 8, r2=0.02)]
    model("kiosk", p, "building")


def make_school():
    p = [box((11.8, 5.8, 0.3), (0, 0, 0.15), "stone.1"), box((11.4, 5.2, 5.6), (0, 0, 3.1), "wall.5"),
         box((11.6, 5.4, 0.2), (0, 0, 3.1), "wall.0"), box((11.6, 5.4, 0.25), (0, 0, 5.9), "wall.0")]
    p += gable(11.4, 5.2, 1.7, 6.0, "roof.2", over=0.4, fill="wall.5")
    p += [box((1.3, 1.3, 1.0), (0, 0, 7.9), "wall.0"), cone(1.1, 1.0, (0, 0, 8.4), "roof.2", 4, (0, 0, 45)),
          cone(0.25, 0.35, (0, -0.1, 7.55), "gold", 8, (180, 0, 0))]
    p += move(door(1.7, 2.3, "wood.1"), (0, -2.6, 0.3))
    p += [box((2.6, 1.0, 0.14), (0, -3.0, 2.85), "roof.2"), box((2.4, 0.12, 0.5), (0, -2.66, 3.5), "accent.0")]
    p += [box((3.0, 0.4, 0.14), (0, -2.8 - 0.2 * i, 0.07 + 0.14 * (1 - i)), "stone.0") for i in range(2)]
    for x in (-4.6, -3.1, -1.6, 1.6, 3.1, 4.6):
        if abs(x) > 1.6:
            p += move(window(0.9, 1.5), (x, -2.6, 1.8))
        p += move(window(0.9, 1.5), (x, -2.6, 4.5))
    p += [box((0.16, 0.16, 5.6), (sx * 5.7, -2.6, 3.1), "wall.0") for sx in (-1, 1)]
    model("school", p, "building")


def make_busstop(broken=False):
    p = [cyl(0.05, 2.5, (sx * 1.6, 0.6, 0), "metal.1", 6) for sx in (-1, 1)]
    p += [cyl(0.05, 2.45, (-1.6, -0.5, 0), "metal.1", 6)]
    p += [box((3.2, 0.04, 1.7), (0, 0.6, 1.3), "glass"), box((3.3, 0.08, 0.08), (0, 0.6, 2.2), "metal.1"),
          box((3.3, 0.08, 0.08), (0, 0.6, 0.45), "metal.1")]
    if broken:
        p += [box((0.04, 0.5, 0.6), (-1.6, 0.2, 0.7), "glass")]
        p += [box((0.3, 0.2, 0.02), (random.uniform(-1.4, 0), random.uniform(-0.6, 0.3), 0.01), "glass", (0, 0, random.uniform(0, 90)))
              for _ in range(5)]
        p += [box((3.7, 1.6, 0.12), (0.2, 0.05, 2.2), "roof.2", (0, 14, 4))]
        p += [box((2.4, 0.14, 0.07), (0, 0.15 + 0.16 * i, 0.46), "wood.0") for i in (0, 2)]
    else:
        p += [box((0.04, 1.0, 1.7), (-1.6, 0.05, 1.3), "glass"), box((3.7, 1.6, 0.12), (0, 0.05, 2.55), "roof.2", (-4, 0, 0))]
        p += [box((2.4, 0.14, 0.07), (0, 0.15 + 0.16 * i, 0.46), "wood.0") for i in range(3)]
    p += [box((0.08, 0.4, 0.45), (sx * 1.0, 0.3, 0.22), "metal.1") for sx in (-1, 1)]
    p += [cyl(0.04, 2.4, (1.65, -0.65, 0), "metal.1", 6), cyl(0.3, 0.05, (1.65, -0.67, 2.4), "accent.0", 14, r=(90, 0, 0)),
          torus(0.3, 0.035, (1.65, -0.72, 2.4), "roof.4", 14, 4, (90, 0, 0))]
    p += [box((0.05, 0.03, 0.3), (1.65 + sx * 0.09, -0.74, 2.4), "roof.4") for sx in (-1, 1)]
    p += [box((0.18, 0.03, 0.05), (1.65, -0.74, 2.4), "roof.4")]
    model("busstop_broken" if broken else "busstop", p, "building")


def make_streetlight():
    p = [cyl(0.2, 0.4, (0, 0, 0), "metal.1", 10), cyl(0.07, 4.1, (0, 0, 0.4), "metal.1", 8),
         cyl(0.22, 0.1, (0, 0, 4.4), "metal.1", 8), cone(0.34, 0.3, (0, 0, 4.9), "metal.1", 6)]
    p += [box((0.04, 0.04, 0.45), (0.2 * math.cos(a), 0.2 * math.sin(a), 4.72), "metal.1")
          for a in (math.pi / 6 + i * math.pi / 3 for i in range(6))]
    lamp = [cyl(0.19, 0.45, (0, 0, 4.5), "accent.0", 6)]
    model("streetlight", p, "building", {"lamp": (lamp, (0, 0, 4.72))})


def make_statue():
    p = [box((1.9, 1.9, 0.3), (0, 0, 0.15), "stone.1"), box((1.4, 1.4, 1.6), (0, 0, 1.1), "stone.0"),
         box((1.6, 1.6, 0.15), (0, 0, 1.97), "stone.1"), box((0.8, 0.05, 0.3), (0, -0.71, 1.1), "gold")]
    g = "roof.4"
    p += [box((0.16, 0.2, 0.7), (sx * 0.12, 0, 2.4), g) for sx in (-1, 1)]
    p += [cyl(0.38, 1.0, (0, 0, 2.7), g, 10, r2=0.26), ball(0.22, (0, 0, 3.95), g, 10, 7), box((0.5, 0.5, 0.12), (0, 0, 4.2), g),
          cyl(0.07, 0.7, (0.3, 0, 3.45), g, 6, r=(0, 35, 0)), cyl(0.08, 0.5, (0.52, -0.05, 4.05), "accent.4", 8, r=(90, 0, 0)),
          cyl(0.07, 0.65, (-0.3, 0, 3.0), g, 6, r=(0, -160, 0))]
    model("statue", p, "building")


def make_playground(broken=False):
    p = [box((7.6, 7.6, 0.05), (0, 0, 0.025), "path")]
    for x in (-3.3, -0.5):  # swing frame
        p += [cyl(0.07, 2.6, (x, -1.5 + sy * 0.7, 0), "accent.3", 6, r=(sy * 15, 0, 0)) for sy in (-1, 1)]
    p += [cyl(0.08, 2.9, (-3.35, -1.5, 2.5), "accent.3", 8, r=(0, 90, 0))]
    for x in (-2.6, -1.2):
        if broken:
            p += [box((0.03, 0.03, 0.7), (x - 0.2, -1.5, 2.15), "metal.1", (0, 10, 0))]
        else:
            p += [box((0.03, 0.03, 1.95), (x + sx * 0.22, -1.5, 1.5), "metal.1") for sx in (-1, 1)]
            p += [box((0.55, 0.25, 0.06), (x, -1.5, 0.52), "accent.0")]
    p += [cyl(0.06, 1.7, (x, y, 0), "wood.0", 6) for x in (1.3, 2.2) for y in (0.9, 1.8)]
    p += [box((1.1, 1.1, 0.1), (1.75, 1.35, 1.7), "wood.0"), cone(0.85, 0.6, (1.75, 1.35, 2.5), "accent.3", 4, (0, 0, 45))]
    p += [cyl(0.04, 0.8, (x, y, 1.75), "wood.0", 5) for x in (1.3, 2.2) for y in (0.9, 1.8)]
    p += [box((0.8, 0.05, 0.05), (1.75, 2.0, 0.3 + 0.3 * i), "wood.1") for i in range(5)]
    if broken:
        p += [box((0.7, 2.6, 0.08), (3.0, -0.8, 0.1), "accent.0", (0, 8, 70))]
    else:
        p += [box((0.7, 2.9, 0.08), (1.75, -0.35, 0.95), "accent.0", (35, 0, 0))]
        p += [box((0.06, 2.9, 0.18), (1.75 + sx * 0.37, -0.35, 1.05), "accent.0", (35, 0, 0)) for sx in (-1, 1)]
    p += [box((1.9, 0.14, 0.25), (-2.2, 2.3 + sy * 0.9, 0.12), "wood.0") for sy in (-1, 1)]
    p += [box((0.14, 1.9, 0.25), (-2.2 + sx * 0.9, 2.3, 0.12), "wood.0") for sx in (-1, 1)]
    p += [box((1.7, 1.7, 0.12), (-2.2, 2.3, 0.08), "wall.1"), cone(0.15, 0.2, (-2.0, 2.1, 0.14), "roof.2", 8)]
    if broken:
        p += [blob(0.2, (-2.5, 2.5, 0.2), "accent.5", 1), box((0.3, 0.3, 0.2), (0.5, -2.5, 0.1), "wood.0", (0, 20, 30))]
    model("playground_broken" if broken else "playground", p, "building")


def make_park(broken=False):
    p = [box((12, 1.4, 0.05), (0, 0, 0.025), "path"), box((1.4, 10, 0.05), (0, 0, 0.026), "path"),
         cyl(2.4, 0.06, (0, 0, 0), "path", 20)]
    p += [cyl(1.5, 0.5, (0, 0, 0), "stone.0", 16), cyl(0.25, 1.2, (0, 0, 0.3), "stone.0", 8),
          cyl(0.6, 0.2, (0, 0, 1.3), "stone.0", 12, r2=0.7)]
    if broken:
        p += [cyl(1.32, 0.46, (0, 0, 0.05), "soil", 16), box((0.9, 0.05, 0.03), (0.5, 0.3, 0.51), "stone.1", (0, 0, 30))]
        p += [cyl(1.1, 0.03, (sx * 3.6, sy * 3.0, 0), "soil", 10, s=(1.3, 1, 1)) for sx, sy in ((-1, 1), (1, -1))]
        for sx, sy in ((-1, -1), (1, 1)):
            p += tree((sx * 4.2, sy * 3.2, 0), 2.8, "leaf.2", 0.8)
        p += bench((-3.0, -1.4, 0), 0, broken=True) + bench((3.0, 1.4, 0), 180)
        p += [blob(0.25, (2.2, -1.2, 0.2), "accent.5", 1, (1, 1, 0.8))]
    else:
        p += [cyl(1.36, 0.46, (0, 0, 0.05), "water", 16), cone(0.18, 0.5, (0, 0, 1.45), "water", 8),
              cyl(0.5, 0.05, (0, 0, 1.47), "water", 12)]
        for sx in (-1, 1):
            for sy in (-1, 1):
                p += tree((sx * 4.2, sy * 3.2, 0), 3.4, "leaf.0" if sx * sy > 0 else "leaf.1", 1.1)
                p += [box((1.6, 0.8, 0.12), (sx * 2.2, sy * 1.9, 0.06), "soil")]
                p += flowers((sx * 2.2, sy * 1.9), 5, BRIGHT, 0.6, 0.06)
        p += bench((-3.0, -1.4, 0), 0) + bench((3.0, 1.4, 0), 180)
    model("park_broken" if broken else "park", p, "building")


def make_garden(broken=False):
    brick = "wall.5"
    if broken:
        p = [box((1.4, 0.35, 0.4), (-2.6, -2.2, 0.2), brick), box((1.5, 0.45, 0.07), (-2.6, -2.2, 0.43), "stone.0")]
        for cx, cy in ((-0.5, -1.4), (1.4, -1.8), (2.4, 0.4)):
            for i in range(9):
                p.append(box((0.24, 0.115, 0.071), (cx + random.uniform(-0.35, 0.35), cy + random.uniform(-0.3, 0.3),
                                                     0.04 + 0.07 * (i // 4)), brick, (0, 0, random.uniform(0, 180))))
        p += [box((2.8, 0.9, 0.08), (x, 1.2, 0.04), "soil") for x in (-1.8, 1.4)]
        p += [cone(0.12, 0.3, (random.uniform(-3, 3), random.uniform(-1.5, 2), 0), "leaf.2", 4) for _ in range(8)]
    else:
        p = [box((6.8, 0.35, 0.9), (0, -2.2, 0.45), brick), box((6.95, 0.45, 0.08), (0, -2.2, 0.94), "stone.0")]
        p += [box((0.4, 0.4, 1.1), (sx * 3.3, -2.2, 0.55), brick) for sx in (-1, 1)]
        p += [ball(0.16, (sx * 3.3, -2.2, 1.25), "stone.0", 8, 5) for sx in (-1, 1)]
        for x in (-1.8, 1.4):
            p += [box((2.8, 0.9, 0.12), (x, 1.2, 0.06), "soil")] + flowers((x, 1.2), 8, BRIGHT, 1.2, 0.06)
        p += [blob(0.5, (2.6, -1.1, 0.45), "leaf.0", 1), blob(0.4, (-2.8, -1.2, 0.35), "leaf.1", 1)]
        p += [cyl(0.25, 0.04, (x, -1.1 + 0.25 * i, 0), "stone.0", 8) for i, x in enumerate((-0.4, 0.1, -0.3, 0.2))]
    model("garden_broken" if broken else "garden", p, "building")


def make_dump_pile(broken=False):
    if broken:
        p = [cyl(2.0, 0.35, (0, 0.2, 0), "stone.1", 12, r2=1.4, s=(1.1, 0.9, 1))]
        bags = ["accent.5", "roof.2", "metal.1", "accent.5", "leaf.1", "accent.5"]
        p += [blob(0.45, (random.uniform(-1.8, 1.8), random.uniform(-1.2, 1.4), 0.55), bags[i], 1, (1, 1, 0.8)) for i in range(6)]
        p += [box((1.9, 0.95, 0.22), (-1.0, -0.6, 0.55), "accent.4", (0, 25, 20)), box((1.9, 0.1, 0.23), (-1.0, -0.62, 0.55), "roof.2", (0, 25, 20))]
        p += [torus(0.33, 0.13, (1.6 + 0.3 * i, -1.3, 0.15 + 0.25 * i), "accent.5", 10, 5, (20 * i, 0, 0)) for i in range(2)]
        p += [box((0.75, 0.7, 1.5), (0.9, 0.9, 0.9), "accent.4", (12, -8, 15)), box((0.05, 0.05, 0.5), (0.55, 0.6, 1.2), "metal.1", (12, -8, 15))]
        p += [box((0.6, 0.5, 0.45), (random.uniform(-2, 2), random.uniform(-1.6, -0.8), 0.22), "wood.0", (0, 0, random.uniform(0, 60)))
              for _ in range(3)]
        p += [box((0.5, 0.06, 0.8), (-2.2, 1.3, 0.5), "wood.1", (30, 0, 40))]
    else:
        p = [box((5.6, 4.6, 0.06), (0, 0, 0.03), "stone.1")]
        p += [box((5.8, 0.12, 0.15), (0, sy * 2.35, 0.08), "wood.1") for sy in (-1, 1)]
        p += [box((0.12, 4.6, 0.15), (sx * 2.85, 0, 0.08), "wood.1") for sx in (-1, 1)]
        p += bench((0, 0.9, 0), 0)
        for sx in (-1, 1):
            p += [box((1.2, 0.6, 0.4), (sx * 1.8, -1.3, 0.2), "wood.0")] + flowers((sx * 1.8, -1.3), 5, BRIGHT, 0.5, 0.4)
        p += tree((2.0, 1.4, 0), 2.8, "leaf.0", 0.8)
        p += [cyl(0.3, 0.9, (-2.2, 1.5, 0), "roof.4", 10, r2=0.34), cyl(0.36, 0.08, (-2.2, 1.5, 0.9), "roof.4", 10)]
    model("dump_pile_broken" if broken else "dump_pile", p, "building")


def make_yard():
    p = [box((9.6, 7.6, 0.05), (0, 0, 0.025), "stone.1")]
    for x in [-4.7 + 0.94 * i for i in range(11)]:
        p.append(cyl(0.07, 1.4, (x, 3.7, 0), "wood.1", 5))
    for y in [-3.7 + 0.92 * i for i in range(9)]:
        p += [cyl(0.07, 1.4, (sx * 4.7, y, 0), "wood.1", 5) for sx in (-1, 1)]
    p += [box((9.4, 0.06, 0.1), (0, 3.7, z), "wood.0") for z in (0.5, 1.1)]
    p += [box((0.06, 7.4, 0.1), (sx * 4.7, 0, z), "wood.0") for sx in (-1, 1) for z in (0.5, 1.1)]
    p += [box((3.6, 2.6, 2.4), (-2.6, 2.1, 1.2), "wood.0")] + gable(3.6, 2.6, 0.8, 2.4, "metal.1", 0.3, 0.1, "wood.0", 2.1)
    p += move(door(1.0, 1.9, "wood.1"), (-2.9, 0.8, 0)) + move(window(0.7, 0.6, cross=False), (-1.6, 0.8, 1.5))
    for x in (1.2, 2.8):
        p += [box((1.2, 0.8, 0.14), (x, -2.2, 0.07), "wood.0"), box((1.1, 0.7, 0.6), (x, -2.2, 0.44), "wall.5")]
    p += [box((2.4, 1.4, 1.0), (2.8, 1.8, 0.5), "accent.0"), box((2.6, 0.12, 0.12), (2.8, 1.1, 1.0), "accent.0")]
    p += [cone(1.0, 0.8, (-0.6, -2.0, 0), "path", 10)]
    p += [cyl(0.06, 2.2, (sx * 1.2, -3.8, 0), "wood.1", 6) for sx in (-1, 1)] + [box((2.8, 0.1, 0.7), (0, -3.8, 1.9), "accent.0"),
                                                                                   box((2.5, 0.12, 0.45), (0, -3.83, 1.9), "roof.2")]
    model("yard", p, "building")


# ---------- the broken prop set: dropped around broken buildings ----------
def make_broken_props():
    model("broken_rubble", [box((random.uniform(0.2, 0.45), random.uniform(0.2, 0.4), random.uniform(0.12, 0.3)),
                                (random.uniform(-0.5, 0.5), random.uniform(-0.4, 0.4), 0.1 + 0.1 * (i // 5)),
                                ["stone.0", "stone.1", "wall.5"][i % 3], (random.uniform(-20, 20), random.uniform(-20, 20), random.uniform(0, 90)))
                            for i in range(12)], "broken")
    model("broken_boards", [box((1.3, 0.05, 0.16), (0, -0.03 * i, 0.6), "wood.0", (0, a, 0)) for i, a in enumerate((35, -35, 5))], "broken")
    model("broken_cone", [box((0.45, 0.45, 0.05), (0, 0, 0.025), "accent.5"), cyl(0.18, 0.6, (0, 0, 0.05), "accent.6", 10, r2=0.04),
                          cyl(0.13, 0.12, (0, 0, 0.3), "accent.4", 10, r2=0.1)], "broken")
    p = [box((0.08, 0.6, 0.08), (sx * 0.85, 0, 0.04), "accent.5") for sx in (-1, 1)]
    p += [box((0.06, 0.06, 1.0), (sx * 0.85, 0, 0.5), "metal.1") for sx in (-1, 1)]
    p += [box((0.25, 0.08, 0.22), (-0.75 + 0.25 * i, 0, 0.8), ["accent.3", "accent.4"][i % 2]) for i in range(7)]
    model("broken_barrier", p, "broken")


# ---------- rigs and clips: poses are rotations about armature axes, relative to the rest pose ----------
def armature(name, bones):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bn, head, tail, parent in bones:
        eb = data.edit_bones.new(bn)
        eb.head, eb.tail = head, tail
        if parent:
            eb.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def animate(arm, name, keys, root="hips"):
    """keys = {frame: {bone: [(axis, degrees), ...], "_z": lift of the root bone in metres}}. Every bone is keyed
    on every key frame, so switching clips in three.js never leaves a bone in another clip's pose."""
    ad = arm.animation_data or arm.animation_data_create()
    act = bpy.data.actions.new(name)
    ad.action = act
    prev = {}
    for f, pose in sorted(keys.items()):
        for pb in arm.pose.bones:
            b = pb.bone.matrix_local.to_3x3()
            r = Matrix.Identity(3)
            for axis, deg in pose.get(pb.name, []):
                r = Matrix.Rotation(math.radians(deg), 3, axis) @ r
            q = (b.inverted() @ r @ b).to_quaternion()
            if pb.name in prev and prev[pb.name].dot(q) < 0:
                q.negate()  # neighbouring keys in the same hemisphere blend the short way round
            prev[pb.name] = q
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
        rb = arm.pose.bones[root]
        rb.location = rb.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, pose.get("_z", 0.0)))
        rb.keyframe_insert("location", frame=f)
    track = ad.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    ad.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion, pb.location = (1, 0, 0, 0), (0, 0, 0)


def rigid(o, bone):
    o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
    return o


def by_ring(o, n, table):
    """Weights per ring of a tube(): table[i] = [(bone, weight), ...] for its i-th ring of n vertices."""
    for v in o.data.vertices:
        for bone, w in table[min(v.index // n, len(table) - 1)]:
            (o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)).add([v.index], w, "REPLACE")
    return o


def tube(pts, radii, col=None, n=8, caps=True, drop=()):
    """Rings of n vertices through pts (a radius or (rx, ry) each), joined into a tube. `drop` lists (ring, vertex)
    pairs to delete, to open a jacket or a V neck; on an upright tube, vertex 3n/4 faces the front (-Y)."""
    def f(bm):
        rings = []
        for i, p in enumerate(pts):
            p = Vector(p)
            d = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
            ref = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
            a = (ref - d * ref.dot(d)).normalized()
            b = d.cross(a)
            rx, ry = radii[i] if isinstance(radii[i], tuple) else (radii[i], radii[i])
            rings.append([bm.verts.new(p + b * rx * math.cos(2 * math.pi * j / n) + a * ry * math.sin(2 * math.pi * j / n))
                          for j in range(n)])
        for r0, r1 in zip(rings, rings[1:]):
            for j in range(n):
                bm.faces.new((r0[j], r0[(j + 1) % n], r1[(j + 1) % n], r1[j]))
        if caps:
            bm.faces.new(rings[0])
            bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if drop:
            bmesh.ops.delete(bm, geom=[rings[i][j] for i, j in drop], context="VERTS")
    return prim(f, col, Matrix.Identity(4))


def shell(r, centre, keep, col=None, seg=14, rings=9, s=(1, 1, 1), ico=0, jitter=0.0):
    """Part of a sphere (hair, hats): only the vertices where keep(local position) is true."""
    def f(bm):
        if ico:
            bmesh.ops.create_icosphere(bm, subdivisions=ico, radius=r)
        else:
            bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
        for v in bm.verts:
            v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2])) * (1 + random.uniform(-jitter, jitter))
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context="VERTS")
    return prim(f, col, Matrix.Translation(centre))


# ---------- the character: 1.8 m with a big head, facing -Y; its left is +X ----------
HEAD = Vector((0, 0, 1.45))
HR = 0.3
SKINS = ["#f9dcc4", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#5c3a21"]
TORSO = [(0.64, (0.205, 0.16)), (0.74, (0.2, 0.155)), (0.98, (0.235, 0.17)), (1.08, (0.2, 0.15)), (1.13, (0.1, 0.09))]


def bones():
    b = [("hips", (0, 0, 0.62), (0, 0, 0.75), None), ("spine", (0, 0, 0.75), (0, 0, 1.12), "hips"),
         ("head", (0, 0, 1.16), (0, 0, 1.75), "spine")]
    for s, side in ((1, "L"), (-1, "R")):
        b += [(f"arm{side}", (s * 0.27, 0, 1.07), (s * 0.33, 0, 0.84), "spine"),
              (f"forearm{side}", (s * 0.33, 0, 0.84), (s * 0.36, -0.02, 0.63), f"arm{side}"),
              (f"hand{side}", (s * 0.36, -0.02, 0.63), (s * 0.37, -0.02, 0.52), f"forearm{side}"),
              (f"leg{side}", (s * 0.1, 0, 0.62), (s * 0.1, -0.01, 0.34), "hips"),
              (f"shin{side}", (s * 0.1, -0.01, 0.34), (s * 0.1, 0, 0.1), f"leg{side}")]
    return b


def arm_path(s, grow=0.0):
    pts = [(s * 0.27, 0, 1.07), (s * 0.3, 0, 0.955), (s * 0.33, 0, 0.84), (s * 0.345, -0.01, 0.735), (s * 0.36, -0.02, 0.63)]
    return pts, [r + grow for r in (0.068, 0.064, 0.06, 0.056, 0.052)]


def arm_weights(side):
    a, f = f"arm{side}", f"forearm{side}"
    return [[(a, 1)], [(a, 1)], [(a, 0.5), (f, 0.5)], [(f, 1)], [(f, 1)]]


def torso_shell(grow, z0, col=None, drop=()):
    """A garment around the torso from z0 up to the shoulders, `grow` metres outside the shirt."""
    rings = [(z0, (0.205, 0.16))] + [(z, r) for z, r in TORSO if z0 < z <= 1.08]
    return tube([(0, 0, z) for z, _ in rings], [(rx + grow, ry + grow) for _, (rx, ry) in rings], col, 12, False, drop)


def feature(kind, u, v, col, size, lift=0.0, roll=0.0):
    """A face part on the head at angle u from the front (+ = the character's left) and elevation v (radians),
    its -Y turned along the head's outward normal there."""
    n = Vector((math.sin(u) * math.cos(v), -math.cos(u) * math.cos(v), math.sin(v)))
    m = (Matrix.Translation(HEAD + n * (HR + lift)) @ n.to_track_quat("-Y", "Z").to_matrix().to_4x4()
         @ Matrix.Rotation(math.radians(roll), 4, "Y") @ Matrix.Diagonal((*size, 1)))
    build = (lambda bm: bmesh.ops.create_cube(bm, size=1.0)) if kind == "box" else \
        (lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=1.0))
    return prim(build, col, m)


def make_character():
    arm = armature("character", bones())
    mats = {n: flat_material(n, h) for n, h in (("Skin", SKINS[1]), ("Hair", "#5b3a29"), ("Shirt", "#8a9aa8"),
                                                 ("Pants", "#4a5d7a"), ("Shoes", "#7a5233"), ("Jacket", "#7d8794"))}
    meshes = []

    def rigged(o, mat=None):
        """Material (a named one, or the palette), parent to the rig, armature modifier."""
        o.data.materials.clear()
        if mat:
            o.data.materials.append(mats[mat])
        else:
            use_palette(o)
        o.parent = arm
        o.modifiers.new("rig", "ARMATURE").object = arm
        meshes.append(o)
        return o

    def part(o, mat, bone=None, table=None):
        o.data.materials.append(mats[mat])
        return by_ring(o, 8, table) if table else rigid(o, bone)

    # the body: one mesh, four materials (Skin, Shirt, Pants, Shoes)
    b = [part(prim(lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=9, radius=HR), None,
                   xf(HEAD, s=(1, 0.97, 0.95))), "Skin", "head"),
         part(ball(0.045, HEAD + Vector((0, -HR + 0.005, -0.03)), None, 6, 4), "Skin", "head"),
         part(cyl(0.075, 0.14, (0, 0, 1.07), None, 8), "Skin", "spine"),
         part(tube([(0, 0, z) for z, _ in TORSO], [r for _, r in TORSO], n=12), "Shirt", "spine"),
         part(tube([(0, 0, 0.5), (0, 0, 0.6), (0, 0, 0.69)], [(0.195, 0.15)] * 3, n=12), "Pants", "hips")]
    for s, side in ((1, "L"), (-1, "R")):
        pts, rad = arm_path(s)
        leg = [(s * 0.1, 0, 0.6), (s * 0.1, -0.005, 0.47), (s * 0.1, -0.01, 0.34), (s * 0.1, -0.005, 0.22), (s * 0.1, 0, 0.1)]
        b += [part(ball(0.07, HEAD + Vector((s * 0.29, 0.02, -0.02)), None, 6, 4, (0.6, 1, 1)), "Skin", "head"),
              part(tube(pts, rad), "Shirt", table=arm_weights(side)),
              part(ball(0.062, (s * 0.365, -0.02, 0.585), None, 8, 5, (0.9, 0.8, 1.1)), "Skin", f"hand{side}"),
              part(tube(leg, [0.085, 0.082, 0.075, 0.07, 0.065]), "Pants",
                   table=[[(f"leg{side}", 1)], [(f"leg{side}", 1)], [(f"leg{side}", 0.5), (f"shin{side}", 0.5)],
                          [(f"shin{side}", 1)], [(f"shin{side}", 1)]]),
              part(ball(0.1, (s * 0.1, -0.04, 0.06), None, 8, 5, (0.85, 1.4, 0.6)), "Shoes", f"shin{side}")]
    body = join(b, "body")
    body.parent = arm
    body.modifiers.new("rig", "ARMATURE").object = arm
    meshes.append(body)

    # hairs (material Hair, head bone); shell() tests positions relative to its centre
    face = lambda c, zmax: c.y < -0.13 and c.z < zmax
    cap = lambda r, dz=0.02: shell(r, HEAD + Vector((0, 0.015, dz)), lambda c: c.z > -0.1 and not face(c, 0.12))
    hairs = {"short": [cap(0.32)],
             "long": [cap(0.32), shell(0.325, HEAD + Vector((0, 0.03, -0.06)), lambda c: c.y > -0.08 and c.z > -0.42, s=(1, 1, 1.35))],
             "bun": [cap(0.315, 0.03), ball(0.12, HEAD + Vector((0, 0.13, 0.3)), None, 8, 6)],
             "curly": [shell(0.35, HEAD + Vector((0, 0.03, 0.06)), lambda c: c.z > -0.2 and not face(c, 0.1), ico=3, jitter=0.07)]}
    for hid, parts in hairs.items():
        rigged(join([rigid(p, "head") for p in parts], f"hair_{hid}"), "Hair")

    # faces (palette colours, head bone): eyes, brows, mouth, cheeks
    ink, white, pink = "accent.5", "accent.4", "accent.1"

    def eyes(r=0.05, v=0.05):
        return [x for s in (1, -1) for x in (feature("ball", s * 0.33, v, ink, (r, r * 0.35, r * 1.25), -0.01),
                                             feature("ball", s * 0.33 - 0.04, v + 0.06, white, (0.014, 0.01, 0.014), 0.005))]

    def cheeks():
        return [feature("ball", s * 0.56, -0.1, pink, (0.05, 0.012, 0.035), -0.004) for s in (1, -1)]

    def mouth(w, dz, tilt):
        return [feature("box", u, -0.2 - (dz if u == 0 else 0), ink, (w, 0.02, 0.018), 0, -tilt * u) for u in (-0.13, 0, 0.13)]

    faces = {
        "smile": eyes() + cheeks() + mouth(0.06, 0.02, 60) + [feature("box", s * 0.33, 0.22, ink, (0.09, 0.02, 0.022), 0, s * 8) for s in (1, -1)],
        "grin": eyes(0.056, 0.07) + cheeks() + [feature("box", s * 0.33, 0.28, ink, (0.09, 0.02, 0.022), 0, -s * 10) for s in (1, -1)]
                + [feature("ball", 0, -0.22, "accent.3", (0.075, 0.02, 0.045), -0.005), feature("box", 0, -0.175, white, (0.1, 0.02, 0.02))],
        "calm": [feature("box", s * 0.33 + d * 0.035, 0.06, ink, (0.045, 0.02, 0.016), 0, d * 25) for s in (1, -1) for d in (1, -1)]
                + [feature("box", s * 0.33, 0.2, ink, (0.09, 0.02, 0.02)) for s in (1, -1)] + mouth(0.045, 0.012, 45)}
    for fid, parts in faces.items():
        o = join([rigid(p, "head") for p in parts], f"face_{fid}", smooth=False)
        rigged(o)

    # rank accessories and wardrobe extras
    def acc(name, parts, bone=None, mat=None):
        return rigged(join([rigid(p, bone) if bone else p for p in parts], name), mat)

    top = HEAD + Vector((0, 0, 0.06))
    acc("acc_hardhat", [shell(0.34, top, lambda c: c.z > 0.0, "accent.0", s=(1, 1.05, 0.95)),
                        cyl(0.4, 0.035, top, "accent.0", 16, s=(1, 1.12, 1)), box((0.05, 0.36, 0.04), top + Vector((0, 0, 0.3)), "accent.0")], "head")
    acc("acc_vest", [torso_shell(0.022, 0.7, "accent.0", ((3, 9),)),
                     tube([(0, 0, 0.78), (0, 0, 0.81)], [(0.235, 0.187)] * 2, "metal.0", 12, False),
                     tube([(0, 0, 0.9), (0, 0, 0.93)], [(0.252, 0.194)] * 2, "metal.0", 12, False)], "spine")
    acc("acc_toolbelt", [tube([(0, 0, 0.64), (0, 0, 0.7)], [(0.215, 0.17)] * 2, "wood.1", 12, False),
                         box((0.1, 0.07, 0.12), (0.17, -0.12, 0.6), "wood.0"), box((0.1, 0.07, 0.12), (-0.17, -0.12, 0.6), "wood.0"),
                         box((0.03, 0.03, 0.2), (-0.21, -0.05, 0.54), "wood.0"), box((0.1, 0.04, 0.04), (-0.21, -0.05, 0.64), "metal.1")], "hips")
    acc("acc_tester", [cyl(0.022, 0.12, (-0.36, 0.02, 0.585), "accent.0", 8, r=(90, 0, 0)),
                       cyl(0.008, 0.07, (-0.36, -0.1, 0.585), "metal.0", 6, r=(90, 0, 0)),
                       cyl(0.024, 0.02, (-0.36, 0.03, 0.585), "accent.3", 8, r=(90, 0, 0))], "handR")
    for name, z0, drop, extra in (("acc_jacket", 0.62, [(i, 9) for i in range(1, 5)], "collar"),
                                  ("acc_blazer", 0.56, [(3, 9), (4, 9)], "lapels")):
        parts = [rigid(torso_shell(0.018, z0, drop=drop), "spine")]
        for s, side in ((1, "L"), (-1, "R")):
            pts, rad = arm_path(s, 0.014)
            parts.append(by_ring(tube(pts[:4], rad[:4], caps=False), 8, arm_weights(side)[:4]))
        if extra == "collar":
            parts.append(rigid(tube([(0, 0, 1.08), (0, 0, 1.16)], [(0.13, 0.11), (0.15, 0.13)], n=10, caps=False), "spine"))
        else:
            parts += [rigid(box((0.07, 0.016, 0.3), (s * 0.075, -0.19, 0.97), None, (0, -s * 18, 0)), "spine") for s in (1, -1)]
        acc(name, parts, mat="Jacket")
    acc("acc_tie", [box((0.05, 0.02, 0.05), (0, -0.178, 1.07), "accent.3"),
                    box((0.055, 0.015, 0.22), (0, -0.183, 0.93), "accent.3", (-4, 0, 0))], "spine")
    links = []
    for i in range(14):  # the chain of office: gold links over the shoulders, dipping to a medallion on the chest
        a = 2 * math.pi * i / 14
        front = max(0.0, math.cos(a))
        links.append(box((0.04, 0.035, 0.022), (0.21 * math.sin(a), -0.19 * math.cos(a) - 0.03 * front, 1.1 - 0.16 * front ** 2),
                         "gold", (0, 0, math.degrees(a))))
    links += [cyl(0.055, 0.02, (0, -0.215, 0.9), "gold", 12, r=(90, 0, 0)), cyl(0.03, 0.02, (0, -0.23, 0.9), "accent.3", 8, r=(90, 0, 0))]
    acc("acc_chain", links, "spine")
    acc("acc_briefcase", [box((0.4, 0.11, 0.3), (0.39, -0.02, 0.36), "wood.1"), box((0.12, 0.03, 0.05), (0.39, -0.02, 0.53), "accent.5"),
                          box((0.04, 0.12, 0.02), (0.3, -0.02, 0.45), "gold"), box((0.04, 0.12, 0.02), (0.48, -0.02, 0.45), "gold")], "handL")
    acc("acc_clipboard", [box((0.22, 0.02, 0.3), (0.36, -0.1, 0.62), "wood.0", (0, 0, 20)),
                          box((0.18, 0.022, 0.24), (0.36, -0.105, 0.6), "accent.4", (0, 0, 20)),
                          box((0.08, 0.03, 0.03), (0.36, -0.105, 0.76), "metal.1", (0, 0, 20))], "handL")
    acc("acc_flagpin", [box((0.045, 0.012, 0.03), (0.1, -0.18, 1.0), "roof.2"), box((0.045, 0.014, 0.01), (0.1, -0.18, 1.0), "accent.0")], "spine")
    extras = {  # id: (parts, bone, slot); a slot holds one item, so Lane W can hide what an extra replaces
        "cap": ([shell(0.325, top - Vector((0, 0, 0.02)), lambda c: c.z > 0.02, "roof.2"),
                 box((0.3, 0.2, 0.025), top + Vector((0, -0.34, 0.0)), "roof.2", (-8, 0, 0)),
                 ball(0.03, top + Vector((0, 0, 0.31)), "accent.4", 6, 4)], "head", "hat"),
        "beanie": ([shell(0.33, top, lambda c: c.z > -0.02, "accent.3", s=(1, 1, 1.12)),
                    tube([top + Vector((0, 0, -0.02)), top + Vector((0, 0, 0.05))], [0.345, 0.345], "accent.4", 14, False),
                    ball(0.07, top + Vector((0, 0, 0.38)), "accent.4", 6, 4)], "head", "hat"),
        "sunglasses": ([feature("ball", s * 0.33, 0.05, "accent.5", (0.075, 0.02, 0.055), 0.02) for s in (1, -1)]
                       + [feature("box", 0, 0.08, "accent.5", (0.08, 0.015, 0.015), 0.03)], "head", "face"),
        "flower": ([ball(0.045, HEAD + Vector((-0.27 + 0.04 * math.cos(a), -0.05, 0.18 + 0.04 * math.sin(a))), "accent.1", 6, 4)
                    for a in (2 * math.pi * k / 5 for k in range(5))] + [ball(0.03, HEAD + Vector((-0.28, -0.07, 0.18)), "accent.0", 6, 4)],
                   "head", "hair"),
        "scarf": ([torus(0.13, 0.045, (0, 0, 1.12), "accent.3", 12, 5, s=(1, 0.85, 1))]
                  + [box((0.07, 0.03, 0.08), (0.08, -0.16, 1.03 - 0.08 * i), ["accent.4", "accent.3"][i % 2], (0, 0, 10)) for i in range(4)],
                  "spine", "neck"),
        "bowtie": ([box((0.07, 0.02, 0.06), (s * 0.045, -0.165, 1.08), "accent.2", (0, s * 10, 0)) for s in (1, -1)]
                   + [box((0.025, 0.025, 0.03), (0, -0.172, 1.08), "accent.2")], "spine", "neck"),
    }
    for xid, (parts, bone, _) in extras.items():
        acc(f"extra_{xid}", parts, bone)

    # clips at 24 fps. X swings forward (-) and back (+); Y lifts an arm out to the side (R +, L -)
    def walk(s):
        return {"legL": [("X", -26 * s)], "legR": [("X", 26 * s)], "shinL": [("X", 8 if s > 0 else 32)],
                "shinR": [("X", 32 if s > 0 else 8)], "armL": [("X", 22 * s), ("Y", -4)], "armR": [("X", -22 * s), ("Y", 4)],
                "forearmL": [("X", -18)], "forearmR": [("X", -18)], "spine": [("Z", 4 * s)]}

    def passing(side):
        return {f"shin{side}": [("X", 48)], "armL": [("Y", -4)], "armR": [("Y", 4)], "forearmL": [("X", -18)],
                "forearmR": [("X", -18)], "_z": 0.03}

    rest = {"armL": [("Y", -5)], "armR": [("Y", 5)], "forearmL": [("X", -10)], "forearmR": [("X", -10)]}
    animate(arm, "idle", {0: rest, 24: {**rest, "armL": [("Y", -8)], "armR": [("Y", 8)], "spine": [("X", -3)],
                                        "head": [("Z", 6), ("X", -3)], "_z": -0.008}, 48: rest})
    animate(arm, "walk", {0: walk(1), 5: passing("R"), 10: walk(-1), 15: passing("L"), 20: walk(1)})

    def wave(w):
        return {"armR": [("Y", 150)], "forearmR": [("Y", w)], "armL": [("Y", -5)], "forearmL": [("X", -10)], "head": [("Y", -6)]}
    animate(arm, "wave", {f: wave(15 if (f // 6) % 2 == 0 else -25) for f in range(0, 37, 6)})

    def up(a, z, leg, shin):
        return {"armR": [("Y", a)], "armL": [("Y", -a)], "forearmR": [("Y", -10)], "forearmL": [("Y", 10)],
                "legL": [("X", leg)], "legR": [("X", leg)], "shinL": [("X", shin)], "shinR": [("X", shin)], "_z": z}
    animate(arm, "cheer", {0: up(135, -0.05, -20, 40), 8: up(165, 0.16, 0, 5), 14: up(160, 0.12, -5, 10),
                           20: up(145, -0.03, -10, 20), 24: up(135, -0.05, -20, 40)})

    export_gltf(OUT / "character.gltf", [arm] + meshes)
    META["character"] = {"kind": "character"}
    t = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes}
    print("own character:", sum(t.values()), "tris", json.dumps(t))
    reset()
    return {
        "base": "character",
        "animations": {"idle": "idle", "walk": "walk", "wave": "wave", "cheer": "cheer"},
        "attach": {"head": "head", "spine": "spine", "handR": "handR"},
        "body": ["body"],
        "materials": ["Skin", "Hair", "Shirt", "Pants", "Shoes", "Jacket"],
        "skins": SKINS,
        "hairs": [{"id": "short", "model": "hair_short", "color": "#5b3a29"}, {"id": "long", "model": "hair_long", "color": "#2e2a28"},
                  {"id": "bun", "model": "hair_bun", "color": "#c9a15b"}, {"id": "curly", "model": "hair_curly", "color": "#3a2a22"},
                  {"id": "none", "model": None, "color": None}],
        "faces": ["face_smile", "face_grin", "face_calm"],
        "outfits": [
            {"rank": 0, "title": "Labourer", "colors": {"Shirt": "#8a9aa8", "Pants": "#4a5d7a", "Shoes": "#7a5233"},
             "sleeve": "#8a9aa8", "show": ["acc_vest", "acc_hardhat"]},
            {"rank": 1, "title": "Skilled", "colors": {"Shirt": "#3e6fb0", "Pants": "#3b4a5e", "Shoes": "#5a4030"},
             "sleeve": "#3e6fb0", "show": ["acc_toolbelt", "acc_tester"]},
            {"rank": 2, "title": "Community helper", "colors": {"Shirt": "#f2e6c9", "Pants": "#4a5d7a", "Shoes": "#e8e8e8", "Jacket": "#39a58a"},
             "sleeve": "#39a58a", "show": ["acc_jacket", "acc_clipboard"]},
            {"rank": 3, "title": "Councillor", "colors": {"Shirt": "#ffffff", "Pants": "#4b4f58", "Shoes": "#3a2a20", "Jacket": "#8a93a0"},
             "sleeve": "#8a93a0", "show": ["acc_blazer"]},
            {"rank": 4, "title": "Mayor", "colors": {"Shirt": "#ffffff", "Pants": "#2f4a7a", "Shoes": "#2a2a2a", "Jacket": "#2f4a7a"},
             "sleeve": "#2f4a7a", "show": ["acc_blazer", "acc_tie", "acc_chain"]},
            {"rank": 5, "title": "Governor", "colors": {"Shirt": "#e8eef5", "Pants": "#2b2d33", "Shoes": "#1e1e1e", "Jacket": "#2b2d33"},
             "sleeve": "#2b2d33", "show": ["acc_blazer", "acc_tie", "acc_briefcase"]},
            {"rank": 6, "title": "President", "colors": {"Shirt": "#ffffff", "Pants": "#151c2e", "Shoes": "#141414", "Jacket": "#151c2e"},
             "sleeve": "#151c2e", "show": ["acc_blazer", "acc_tie", "acc_flagpin"]}],
        "extras": [{"id": xid, "model": f"extra_{xid}", "slot": slot} for xid, (_, _, slot) in extras.items()],
    }


# ---------- a bird: its wings on their own bones; clips fly and idle ----------
def make_bird():
    arm = armature("bird", [("body", (0, 0.08, 0.1), (0, -0.08, 0.1), None),
                            ("wingL", (0.05, 0, 0.13), (0.2, 0, 0.13), "body"), ("wingR", (-0.05, 0, 0.13), (-0.2, 0, 0.13), "body")])
    body = [ball(0.08, (0, 0.01, 0.1), "roof.2", 10, 7, (0.85, 1.3, 0.85)), ball(0.06, (0, -0.02, 0.085), "accent.4", 8, 5, (0.8, 1.1, 0.7)),
            ball(0.055, (0, -0.1, 0.16), "roof.2", 8, 6), cone(0.022, 0.05, (0, -0.15, 0.155), "accent.6", 6, (90, 0, 0)),
            box((0.07, 0.1, 0.015), (0, 0.13, 0.13), "roof.2", (-20, 0, 0))]
    body += [ball(0.012, (s * 0.035, -0.13, 0.175), "accent.5", 6, 4) for s in (1, -1)]
    o = join([rigid(p, "body") for p in body], "bird_body")
    w = join([rigid(box((0.15, 0.09, 0.012), (s * 0.12, 0.0, 0.13), "roof.2", (0, s * 8, 0)), f"wing{side}")
              for s, side in ((1, "L"), (-1, "R"))], "bird_wings")
    for m in (o, w):
        use_palette(m)
        m.parent = arm
        m.modifiers.new("rig", "ARMATURE").object = arm

    def flap(a, z, tilt=0):
        return {"wingL": [("Y", -a)], "wingR": [("Y", a)], "body": [("X", tilt)], "_z": z}
    animate(arm, "fly", {0: flap(-45, 0.0), 3: flap(50, 0.02), 6: flap(-45, 0.0)}, root="body")
    animate(arm, "idle", {0: flap(-70, 0), 12: flap(-70, 0, 12), 24: flap(-70, 0)}, root="body")
    export_gltf(OUT / "bird.gltf", [arm, o, w])
    META["bird"] = {"kind": "life"}
    reset()


# ---------- main ----------
LEGACY = ["brick_nf", "brick_half", "trowel", "fp_arms", "mortar_tub", "pallet_euro", "line_pin", "spirit_level"]
BBB = "https://github.com/sulemanali5760/brick-by-brick/blob/main/blender/make_assets.py"


def preview(folder, character):
    reset()
    items = [(mid, [o for o in import_gltf(OUT / f"{mid}.gltf") if o.parent is None])
             for mid, m in META.items() if m["kind"] in ("building", "broken")]
    grid_render(items, pathlib.Path(folder) / "own-town.png", cols=7, px=220, samples=12)
    reset()
    character_sheet(character, pathlib.Path(folder) / "own-character.png")


reset()
for make in (make_townhall, make_keller_house, make_bridge, make_cafe, make_shop, make_pharmacy, make_kiosk, make_school,
             make_busstop, lambda: make_busstop(True), make_streetlight, make_statue, make_playground, lambda: make_playground(True),
             make_park, lambda: make_park(True), make_garden, lambda: make_garden(True), make_dump_pile, lambda: make_dump_pile(True),
             make_yard, make_broken_props, make_bird):
    make()
character = make_character()
(ROOT / "blender" / "own_meta.json").write_text(json.dumps(
    {"models": {**{m: {"kind": "task", "url": BBB} for m in LEGACY}, **META}, "character": character}, indent=1))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if args:
    preview(args[0], character)
