import * as BABYLON from "babylonjs";
import geoData from "./models/ariados.geo.json";
import animData from "./animations/ariados.animation.json";
const pokemon = "ariados";

const toRadians = (degrees) => degrees * (Math.PI / 180)

const buildFaceUv = (x1, y1, x2, y2, tw, th) => {
    return new BABYLON.Vector4((x1) / tw, (th - y2) / th, (x2) / tw, (th - y1) / th)
};

const buildTexture = ({ url }) => {
    const mat = new BABYLON.StandardMaterial("mat");
    const texture = new BABYLON.Texture(url, scene, {
        noMipmap: true,
        samplingMode: BABYLON.Texture.NEAREST_SAMPLINGMODE,
        format: BABYLON.Engine.TEXTUREFORMAT_RGBA
    });
    mat.diffuseTexture = texture;
    texture.hasAlpha = true;

    return mat;
};

const buildCube = ({
    size = [0.1, 0.1, 0.1],
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    uv,
    textureSize,
    texture,
    inflate = 0,
    name
} = {}) => {
    const [sx, sy, sz] = size;
    const rsx = sx || 0.01;
    const rsy = sy || 0.01;
    const rsz = sz || 0.01;
    let faceUv;

    if (uv && textureSize) {
        const [ox, oy] = uv;
        const [tw, th] = textureSize;

        faceUv = [];
        faceUv[0] = buildFaceUv(ox + sx + 2 * sz, oy + sz, ox + 2 * sx + 2 * sz, oy + sz + sy, tw, th);
        faceUv[1] = buildFaceUv(ox + sz, oy + sz, ox + sz + sx, oy + sz + sy, tw, th);
        faceUv[2] = buildFaceUv(ox + sz + sx, oy + sz, ox + 2 * sz + sx, oy + sz + sy, tw, th);
        faceUv[3] = buildFaceUv(ox, oy + sz, ox + sz, oy + sz + sy, tw, th);
        faceUv[4] = buildFaceUv(ox + sz, oy, ox + sz + sx, oy + sz, tw, th);
        faceUv[5] = buildFaceUv(ox + sz + sx, oy + sz, ox + sz + 2 * sx, oy, tw, th);
    }
    const actualInflate = inflate + 1;
    const box = BABYLON.MeshBuilder.CreateBox(name, {
        faceUV: faceUv,
        wrap: true,
        width: rsx,
        height: rsy,
        depth: rsz
    });
    box.material = texture;
    box.position.set(...position.map((e, i) => e + ([rsx, rsy, rsz][i] / 2)));
    box.rotation.set(...rotation.map(toRadians));
    box.scaling.setAll(actualInflate);

    return box;
};

const buildModel = (geo, anims, texture) => {
    const relevantGeoData = geo['minecraft:geometry'][0];
    const bones = relevantGeoData.bones;
    const textureSize = [relevantGeoData.description.texture_width, relevantGeoData.description.texture_height];
    const boneCubes = {};

    bones.forEach(({ name, pivot, parent, rotation = [0, 0, 0], cubes = [] }) => {
        const [pX, pY, pZ] = pivot;
        const boneCube = buildCube({
            position: [pX, pY, pZ],
            rotation,
            name
        });
        boneCube.state = { pivot, rotation };

        const parentBoneCube = boneCubes[parent];
        boneCubes[name] = boneCube;
        if (!parentBoneCube) {
            return;
        }

        // const [ppX, ppY, ppZ] = parentBoneCube.state.pivot || [0, 0, 0];
        // boneCube.position.x -= ppX;
        // boneCube.position.y -= ppY;
        // boneCube.position.z -= ppZ;

        cubes.forEach(({ origin, size, uv, rotation, inflate = 0 }, index) => {
            const cube = buildCube({
                size: size.map(e => e ? e : 0.01),
                position: origin,
                rotation,
                texture,
                textureSize,
                uv,
                inflate,
                name: `${name}-${index}`
            });
            boneCube.addChild(cube);
        });

        parentBoneCube.addChild(boneCube);
    })

    const rootBone = boneCubes[bones.find(({ parent }) => !parent).name]
    return rootBone
};

const createScene = () => {
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 3, 100, BABYLON.Vector3.Zero());
    camera.attachControl(true)
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 3, -1));
    BABYLON.MeshBuilder.CreateGround("ground", {height: 50, width: 50, subdivisions: 4})

    const texture = buildTexture({ url: `/textures/${pokemon}.png` })
    const model = buildModel(geoData, animData, texture, scene);

    scene.registerBeforeRender(() => {
        model.rotation.y += 0.005;
    });

    return scene;
};

// Get the canvas DOM element
var canvas = document.getElementById('renderCanvas');
// Load the 3D engine
var engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// call the createScene function
var scene = createScene();
// run the render loop
engine.runRenderLoop(function () {
    scene.render();
});
// the canvas/window resize event handler
window.addEventListener('resize', function () {
    engine.resize();
});