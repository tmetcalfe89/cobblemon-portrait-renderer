import * as THREE from 'three';
import "./style.css";
import geoData from "./models/bulbasaur.geo.json";
import animData from "./animations/bulbasaur.animation.json";
import { Molang } from 'molang';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector("#app").appendChild(renderer.domElement);

camera.position.z = 100;

const toRadians = (degrees) => degrees * (Math.PI / 180)

const buildCube = ({
    size: [sX, sY, sZ] = [0, 0, 0],
    position: [pX, pY, pZ] = [0, 0, 0],
    rotation: [rX, rY, rZ] = [0, 0, 0]
} = {}) => {
    const geometry = new THREE.BoxGeometry(sX, sY, sZ);
    const material = new THREE.MeshBasicMaterial({ color: 0x00FFDD });
    const cube = new THREE.Mesh(geometry, material);

    cube.position.x = pX;
    cube.position.y = pY;
    cube.position.z = pZ;

    cube.rotation.x = toRadians(rX);
    cube.rotation.y = toRadians(rY);
    cube.rotation.z = toRadians(rZ);

    return cube;
}

function buildModel(geo, anims) {
    const bones = geo['minecraft:geometry'][0].bones;
    const boneCubes = {};

    bones.slice(0).forEach(({ name, pivot, parent, rotation = [0, 0, 0], cubes = [] }) => {
        const [pX, pY, pZ] = pivot;
        const boneCube = buildCube({
            position: [pX, pY, pZ]
        });
        const parentBoneCube = boneCubes[parent];
        boneCubes[name] = boneCube;
        boneCube.userData.pivot = pivot;
        if (!parentBoneCube) {
            return;
        }

        const [ppX, ppY, ppZ] = parentBoneCube.userData.pivot || [0, 0, 0];
        boneCube.position.x -= ppX;
        boneCube.position.y -= ppY;
        boneCube.position.z -= ppZ;

        const [rX, rY, rZ] = rotation;
        boneCube.rotation.x = -toRadians(rX);
        boneCube.rotation.y = toRadians(rY);
        boneCube.rotation.z = -toRadians(rZ);

        cubes.forEach(({ origin, size, uv }) => {
            const cube = buildCube({
                size,
                position: origin.map((e, i) => e + (size[i] / 2) - pivot[i])
            });
            boneCube.add(cube);
        });

        parentBoneCube.add(boneCube);
    })

    const rootBone = boneCubes[bones.find(({ parent }) => !parent).name]
    rootBone.userData.boneCubes = boneCubes;
    rootBone.userData.anims = anims;
    return rootBone;
}

function maybeMolang(v, molang) {
    return typeof v === "number" ? v : molang.execute(v)
}

function evalAnimPart(rotation, molang) {
    const maybeMolangO = (v) => maybeMolang(v, molang);
    const maybeMolangA = (...vs) => vs.map((v) => maybeMolangO(v))
    let frx = 0
    let fry = 0
    let frz = 0
    if (Array.isArray(rotation)) {
        const [rx, ry, rz] = rotation;
        frx = maybeMolangO(rx);
        fry = maybeMolangO(ry);
        frz = maybeMolangO(rz);
    } else {
        // const keys = Object.keys(rotation);
        // const values = Object.values(rotation);
        // const interval = +keys[keys.length - 1];
        // const cip = time % interval
        // const targetIndex = keys.findIndex((v) => +v > cip) - 1;
        // const betweenTime = +keys[targetIndex + 1] - +keys[targetIndex];
        // const [tx, ty, tz] = values[targetIndex];
        // const [nx, ny, nz] = values[targetIndex + 1];
        // const [utx, uty, utz, unx, uny, unz] = maybeMolangA(tx, ty, tz, nx, ny, nz)
        // frx = utx + (unx - utx) * ((cip-betweenTime) / betweenTime);
        // fry = uty + (uny - uty) * ((cip-betweenTime) / betweenTime);
        // frz = utz + (unz - utz) * ((cip-betweenTime) / betweenTime);
    }
    return [frx, fry, frz]
}

function applyAnimation(model, animName, molang) {
    const anims = model.userData.anims;
    const anim = Object.entries(anims.animations).find(([k]) => k.split(".").pop() === animName)[1];
    Object.entries(anim.bones).forEach(([boneName, { rotation, position }]) => {
        if (rotation) {
            const rot = model.userData.boneCubes[boneName].rotation;
            const [frx, fry, frz] = evalAnimPart(rotation, molang);
            rot.x = -toRadians(frx);
            rot.y = toRadians(fry);
            rot.z = -toRadians(frz);
        }
        if (position) {
            const pos = model.userData.boneCubes[boneName].position;
            const [frx, fry, frz] = evalAnimPart(position, molang);
            pos.x = frx;
            pos.y = fry;
            pos.z = frz;
        }
    });
}

const model = buildModel(geoData, animData);
scene.add(model);

let time = 0;
function animate() {
    requestAnimationFrame(animate);

    model.rotation.y = time

    const molang = new Molang({ query: { anim_time: time } }, { useCache: true });
    // applyAnimation(model, "render", molang);
    time += 0.01;

    renderer.render(scene, camera);
}

animate();