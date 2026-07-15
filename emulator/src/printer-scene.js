import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MM = 0.01;

function box(width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radius, height, material, segments = 32) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class PrinterScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171a1b);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(9, 6.8, 12);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 2.8, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 18;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.axisTargets = { x: 117.5, y: 117.5, z: 10 };
    this.axisShown = { ...this.axisTargets };
    this.fanAngle = 0;
    this.buildPrinter();
    this.addLighting();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildPrinter() {
    const black = new THREE.MeshStandardMaterial({ color: 0x202426, roughness: 0.48, metalness: 0.62 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x4b5153, roughness: 0.37, metalness: 0.82 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf26a2e, roughness: 0.46, metalness: 0.18 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4b5, roughness: 0.27, metalness: 0.9 });
    const bedTop = new THREE.MeshStandardMaterial({ color: 0x313638, roughness: 0.86, metalness: 0.1 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x090a0b, roughness: 0.95, metalness: 0 });

    const printer = new THREE.Group();
    printer.rotation.y = -0.08;
    this.printer = printer;
    this.scene.add(printer);

    const baseLeft = box(0.42, 0.36, 4.9, black);
    baseLeft.position.set(-1.7, 0.27, 0);
    printer.add(baseLeft);
    const baseRight = baseLeft.clone();
    baseRight.position.x = 1.7;
    printer.add(baseRight);
    const baseFront = box(3.8, 0.36, 0.46, black);
    baseFront.position.set(0, 0.27, 2.23);
    printer.add(baseFront);
    const baseRear = baseFront.clone();
    baseRear.position.z = -2.23;
    printer.add(baseRear);

    const centerRail = box(0.38, 0.28, 4.45, edge);
    centerRail.position.set(0, 0.47, 0);
    printer.add(centerRail);

    const leftPost = box(0.42, 4.85, 0.42, black);
    leftPost.position.set(-1.7, 2.82, -1.86);
    printer.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = 1.7;
    printer.add(rightPost);
    const topBeam = box(3.82, 0.42, 0.42, black);
    topBeam.position.set(0, 5.15, -1.86);
    printer.add(topBeam);

    const zRodLeft = cylinder(0.045, 4.42, steel, 18);
    zRodLeft.position.set(-1.39, 2.83, -1.58);
    printer.add(zRodLeft);
    const zRodRight = zRodLeft.clone();
    zRodRight.position.x = 1.39;
    printer.add(zRodRight);

    this.bedGroup = new THREE.Group();
    const bedBase = box(2.85, 0.16, 2.85, edge);
    bedBase.position.y = 0.7;
    this.bedGroup.add(bedBase);
    const printSurface = box(2.72, 0.055, 2.72, bedTop);
    printSurface.position.y = 0.81;
    this.bedGroup.add(printSurface);
    const logo = box(0.72, 0.008, 0.12, orange);
    logo.position.set(0, 0.844, 1.05);
    this.bedGroup.add(logo);
    printer.add(this.bedGroup);

    this.gantryGroup = new THREE.Group();
    const xBeam = box(3.45, 0.38, 0.42, black);
    this.gantryGroup.add(xBeam);
    const leftBracket = box(0.55, 0.65, 0.54, orange);
    leftBracket.position.x = -1.66;
    this.gantryGroup.add(leftBracket);
    const rightBracket = leftBracket.clone();
    rightBracket.position.x = 1.66;
    this.gantryGroup.add(rightBracket);
    printer.add(this.gantryGroup);

    this.carriageGroup = new THREE.Group();
    const carriage = box(0.74, 0.76, 0.54, edge);
    this.carriageGroup.add(carriage);
    const shroud = box(0.6, 0.52, 0.62, orange);
    shroud.position.set(0, -0.24, 0.2);
    this.carriageGroup.add(shroud);
    const hotend = cylinder(0.12, 0.52, steel, 20);
    hotend.position.set(0, -0.66, 0.02);
    this.carriageGroup.add(hotend);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 20), steel);
    nozzle.position.set(0, -1.01, 0.02);
    nozzle.rotation.x = Math.PI;
    this.carriageGroup.add(nozzle);
    this.fan = cylinder(0.2, 0.035, rubber, 20);
    this.fan.rotation.x = Math.PI / 2;
    this.fan.position.set(0.14, -0.24, 0.53);
    this.carriageGroup.add(this.fan);
    this.gantryGroup.add(this.carriageGroup);

    const controlBox = box(1.28, 0.66, 1.62, black);
    controlBox.position.set(2.25, 0.42, 0.86);
    printer.add(controlBox);
    const controlTrim = box(1.3, 0.08, 1.64, orange);
    controlTrim.position.set(2.25, 0.78, 0.86);
    printer.add(controlTrim);

    const spoolArm = box(0.26, 1.3, 0.26, black);
    spoolArm.position.set(1.46, 5.76, -1.86);
    printer.add(spoolArm);
    const spoolAxle = cylinder(0.08, 1.0, steel, 18);
    spoolAxle.rotation.z = Math.PI / 2;
    spoolAxle.position.set(1.05, 6.12, -1.86);
    printer.add(spoolAxle);
    const spool = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.19, 18, 42), orange);
    spool.rotation.y = Math.PI / 2;
    spool.position.set(0.82, 6.12, -1.86);
    spool.castShadow = true;
    printer.add(spool);

    for (const x of [-1.7, 1.7]) {
      for (const z of [-2.05, 2.05]) {
        const foot = cylinder(0.16, 0.16, rubber, 20);
        foot.position.set(x, 0.03, z);
        printer.add(foot);
      }
    }

    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 80), new THREE.MeshStandardMaterial({ color: 0x101213, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(12, 24, 0x3a4041, 0x252a2b);
    grid.position.y = -0.045;
    this.scene.add(grid);
    this.updateAxisTransforms();
  }

  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0xe7f7f4, 0x191514, 1.55));
    const key = new THREE.DirectionalLight(0xfff2df, 3.1);
    key.position.set(4.5, 8, 5.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -3;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x7cdce5, 1.1);
    fill.position.set(-4, 4, 2);
    this.scene.add(fill);
  }

  setAxes(axes) {
    this.axisTargets.x = THREE.MathUtils.clamp(axes.x, -10, 245);
    this.axisTargets.y = THREE.MathUtils.clamp(axes.y, -10, 245);
    this.axisTargets.z = THREE.MathUtils.clamp(axes.z, -5, 325);
  }

  setFanDuty(duty) {
    this.fanDuty = duty;
  }

  updateAxisTransforms() {
    const x = (this.axisShown.x - 117.5) * MM;
    const y = (this.axisShown.y - 117.5) * MM;
    const z = Math.max(0, this.axisShown.z) * MM;
    this.bedGroup.position.z = -y;
    this.gantryGroup.position.set(0, 1.83 + z, -1.62);
    this.carriageGroup.position.set(x, -0.16, 0.14);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate() {
    for (const axis of ['x', 'y', 'z']) {
      this.axisShown[axis] = THREE.MathUtils.lerp(this.axisShown[axis], this.axisTargets[axis], 0.18);
    }
    this.updateAxisTransforms();
    this.fanAngle += 0.04 + (this.fanDuty || 0) * 0.8;
    this.fan.rotation.z = this.fanAngle;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  }
}
