import * as THREE from 'three';
import "./style.css";
import bulbasaurGeo from "./models/ariados.geo.json";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector("#app").appendChild(renderer.domElement);

camera.position.z = 150;

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

function buildModel(bones) {
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

        cubes.forEach(({origin, size, uv}) => {
            const cube = buildCube({
                size,
                position: origin.map((e, i) => e + (size[i] / 2) - pivot[i])
            });
            boneCube.add(cube);
        });

        parentBoneCube.add(boneCube);
    })

    return boneCubes[bones.find(({ parent }) => !parent).name]
}

const bulbasaurModel = buildModel(bulbasaurGeo['minecraft:geometry'][0].bones);
scene.add(bulbasaurModel)

function animate() {
    requestAnimationFrame(animate);

    bulbasaurModel.rotation.y += 0.01

    renderer.render(scene, camera);
}

animate();