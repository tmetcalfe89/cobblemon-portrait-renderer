import * as THREE from 'three';
import "./style.css";
import geoData from "./models/ariados.geo.json";
import animData from "./animations/ariados.animation.json";
import { Molang } from 'molang';

const animName = "ground_walk";
const doPosAnim = true;
const doRotAnim = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const texture = new THREE.TextureLoader().load('textures/bulbasaur.png');

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector("#app").appendChild(renderer.domElement);

camera.position.z = 50;

const toRadians = (degrees) => degrees * (Math.PI / 180)

const buildCube = ({
    size: [sx, sy, sz] = [0, 0, 0],
    position: [px, py, pz] = [0, 0, 0],
    rotation: [rx, ry, rz] = [0, 0, 0],
    texture,
    uv,
    color = 0x00FFDD
} = {}) => {
    const geometry = new THREE.BoxGeometry(sx, sy, sz);
    let material = new THREE.MeshBasicMaterial({ color });

    // if (texture && uv) {
    //     const [xo, yo] = uv;
    //     material = new THREE.MeshLambertMaterial({ map: texture });

    //     const imgW = 64;
    //     const imgH = 64;

    //     console.log(geometry)
    //     const uvVertices = new THREE.BufferAttribute(new Float32Array([
    //         xo + sz,
    //         yo + sy + sz,
    //         xo + sz + sx,
    //         yo + sy + sz,

    //         0,
    //         0,
    //         1,
    //         0,

    //         0,
    //         1,
    //         1,
    //         1,

    //         0,
    //         0,
    //         1,
    //         0,

    //         0,
    //         1,
    //         1,
    //         1,

    //         0,
    //         0,
    //         1,
    //         0,

    //         0,
    //         1,
    //         1,
    //         1,

    //         0,
    //         0,
    //         1,
    //         0,

    //         0,
    //         1,
    //         1,
    //         1,

    //         0,
    //         0,
    //         1,
    //         0,

    //         0,
    //         1,
    //         1,
    //         1,

    //         0,
    //         0,
    //         1,
    //         0
    //     ]), 4)
    //     // geometry.setAttribute("uv", uvVertices)
    // }

    const cube = new THREE.Mesh(geometry, material);

    cube.position.x = px;
    cube.position.y = py;
    cube.position.z = pz;

    cube.rotation.x = toRadians(rx);
    cube.rotation.y = toRadians(ry);
    cube.rotation.z = toRadians(rz);

    return cube;
}

function buildModel(geo, anims, texture) {
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
                position: origin.map((e, i) => e + (size[i] / 2) - pivot[i]),
                texture,
                uv
            });
            boneCube.add(cube);
        });

        boneCube.userData.basePos = pivot;
        boneCube.userData.baseRot = rotation;

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

function evalAnimPart(animPart, molang) {
    const maybeMolangO = (v) => maybeMolang(v, molang);
    const maybeMolangA = (...vs) => vs.map((v) => maybeMolangO(v))
    let frx = 0
    let fry = 0
    let frz = 0
    if (Array.isArray(animPart)) {
        const [rx, ry, rz] = animPart;
        frx = maybeMolangO(rx);
        fry = maybeMolangO(ry);
        frz = maybeMolangO(rz);
    } else {
        const keys = Object.keys(animPart);
        const values = Object.values(animPart);
        const interval = +keys[keys.length - 1];
        const cip = time % interval
        const targetIndex = keys.findIndex((v) => +v > cip) - 1;
        const betweenTime = +keys[targetIndex + 1] - +keys[targetIndex];
        const [tx, ty, tz] = values[targetIndex];
        const [nx, ny, nz] = values[targetIndex + 1];
        const [utx, uty, utz, unx, uny, unz] = maybeMolangA(tx, ty, tz, nx, ny, nz)
        frx = linearTween(utx, unx, betweenTime, cip - keys[targetIndex]);
        fry = linearTween(uty, uny, betweenTime, cip - keys[targetIndex]);
        frz = linearTween(utz, unz, betweenTime, cip - keys[targetIndex]);
    }
    return [frx, fry, frz]
}

function linearTween(startValue, endValue, duration, currentTime) {
    // Ensure currentTime is within the bounds of the duration
    currentTime = Math.max(0, Math.min(currentTime, duration));

    // Calculate the progress ratio
    const progress = currentTime / duration;

    // Linear interpolation formula
    const interpolatedValue = startValue + (endValue - startValue) * progress;

    return interpolatedValue;
}

function applyAnimation(model, animName, molang) {
    const anims = model.userData.anims;
    const anim = Object.entries(anims.animations).find(([k]) => k.split(".").pop() === animName)[1];
    Object.entries(anim.bones).forEach(([boneName, { rotation, position }]) => {
        const targetBone = model.userData.boneCubes[boneName];
        if (rotation && doRotAnim) {
            const rot = targetBone.rotation;
            const [frx, fry, frz] = evalAnimPart(rotation, molang);
            const [brx, bry, brz] = targetBone.userData.baseRot;
            rot.x = -toRadians(brx + frx);
            rot.y = toRadians(bry + fry);
            rot.z = -toRadians(brz + frz);
        }
        if (position && doPosAnim) {
            console.log(boneName)
            const pos = targetBone.position;
            const [frx, fry, frz] = evalAnimPart(position, molang);
            const [brx, bry, brz] = targetBone.userData.basePos;
            pos.x = brx + frx;
            pos.y = bry + fry;
            pos.z = brz + frz;
        }
    });
}

const model = buildModel(geoData, animData, texture);
scene.add(model);

let time = 0;
function animate() {
    requestAnimationFrame(animate);

    model.rotation.y = time

    const molang = new Molang({ query: { anim_time: time } }, { useCache: true });
    applyAnimation(model, animName, molang);
    time += 0.01;

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', onWindowResize, false)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.render(scene, camera);
}