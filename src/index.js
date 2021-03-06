// https://www.cobosrl.co/

import "./style.scss";
import SimplexNoise from "simplex-noise";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { gsap } from "gsap";

function isMobile() {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
const WIDTH = isMobile() ? 64 : 128,
  BOUNDS = 764,
  initialState = {
    uFrequency: 0.6,
    uAmplitude: 2.5,
    speedTime: 1
  },
  mouseDownState = {
    uFrequency: 5,
    uAmplitude: 0.3,
    speedTime: 1
  };

let effectController = {
  mouseSize: 10,
  viscosity: 0.9
};

class App {
  constructor() {
    (this.speedTime = 0.3),
      (this.time = 0),
      (this.clock = new THREE.Clock()),
      (this.mouse = new THREE.Vector2(1e3, 1e3)),
      (this.raycaster = new THREE.Raycaster()),
      this.init(),
      window.addEventListener("resize", this.onWindowResize.bind(this), !1),
      window.addEventListener("mousemove", this.onMouseMove.bind(this), !1),
      document.addEventListener("mousedown", this.onMouseDown.bind(this), !1),
      document.addEventListener("mouseup", this.onMouseUp.bind(this), !1),
      document.addEventListener("touchstart", this.onMouseDown.bind(this), !1),
      document.addEventListener("touchend", this.onMouseUp.bind(this), !1),
      document.addEventListener(
        "touchmove",
        e => {
          this.onMove(e.touches[0]);
        },
        !1
      );
  }
  init() {
    (this.renderer = new THREE.WebGLRenderer({
      antialias: !0,
      alpha: true
    })),
      this.renderer.setSize(window.innerWidth, window.innerHeight),
      document.getElementById("blob").appendChild(this.renderer.domElement),
      (this.scene = new THREE.Scene()),
      (this.camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        10
      )),
      this.camera.position.set(0, 0, isMobile() ? 10 : 7),
      (this.lightTop = new THREE.DirectionalLight(16777215, 0.65)),
      this.lightTop.position.set(0, 500, 200),
      this.scene.add(this.lightTop),
      (this.lightBottom = new THREE.DirectionalLight(16777215, 0.3)),
      this.lightBottom.position.set(0, -500, 400),
      this.scene.add(this.lightBottom);
    let e = new THREE.AmbientLight(1053224, 0.7);
    this.scene.add(e),
      this.addBlob(),
      this.renderer.setAnimationLoop(this.render.bind(this));
  }
  addBlob() {
    let e = new THREE.SphereGeometry(1, WIDTH - 1, WIDTH - 1),
      t = THREE.ShaderLib.phong;
    (t.uniforms.diffuse.value = [
      0.8941176470588236,
      0.9254901960784314,
      0.9803921568627451
    ]),
      (t.uniforms.shininess.value = 600);
    let i = THREE.UniformsUtils.merge([
        t.uniforms,
        {
          uTime: {
            value: 0
          },
          uFrequency: {
            value: initialState.uFrequency
          },
          uAmplitude: {
            value: initialState.uAmplitude
          },
          uHeightMap: {
            value: null
          }
        }
      ]),
      s = t.fragmentShader;
    s = s.replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      document.getElementById("fragmentShader").textContent
    );
    let a = new THREE.ShaderMaterial({
      uniforms: i,
      vertexShader: document.getElementById("vertexShader").textContent,
      fragmentShader: s,
      // --------------
      clipping: true,
      fog: true,
      color: [200, 200, 200],
      wireframe: true,
      flatshading: false,
      // ------------
      lights: !0,
      defines: {
        WIDTH: WIDTH.toFixed(1),
        BOUNDS: BOUNDS.toFixed(1)
      }
    });
    (this.blob = new THREE.Mesh(e, a)),
      this.scene.add(this.blob),
      (this.blob.rotation.y = THREE.Math.degToRad(-45));
    let o = new THREE.SphereBufferGeometry(1.4, 16, 16);
    (this.shadowBlob = new THREE.Mesh(
      o,
      new THREE.MeshBasicMaterial({
        color: 16777215,
        visible: false
      })
    )),
      this.scene.add(this.shadowBlob),
      (this.shadowBlob.rotation.y = THREE.Math.degToRad(-45)),
      (this.gpuCompute = new GPUComputationRenderer(
        WIDTH,
        WIDTH,
        this.renderer
      ));
    let n = this.gpuCompute.createTexture();
    this.fillTexture(n),
      (this.heightmapVariable = this.gpuCompute.addVariable(
        "heightmap",
        document.getElementById("heightmapFragmentShader").textContent,
        n
      )),
      this.gpuCompute.setVariableDependencies(this.heightmapVariable, [
        this.heightmapVariable
      ]),
      (this.heightmapVariable.material.uniforms.mousePos = {
        value: new THREE.Vector3(1e4, 1e4)
      }),
      (this.heightmapVariable.material.uniforms.mouseSize = {
        value: effectController.mouseSize
      }),
      (this.heightmapVariable.material.uniforms.viscosityConstant = {
        value: effectController.viscosity
      }),
      (this.heightmapVariable.material.uniforms.heightCompensation = {
        value: 0
      }),
      (this.heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1));
    let r = this.gpuCompute.init();
    null !== r && console.error(r),
      (this.smoothShader = this.gpuCompute.createShaderMaterial(
        document.getElementById("smoothFragmentShader").textContent,
        {
          smoothTexture: {
            value: null
          }
        }
      )),
      (this.readWaterLevelShader = this.gpuCompute.createShaderMaterial(
        document.getElementById("readWaterLevelFragmentShader").textContent,
        {
          point1: {
            value: new THREE.Vector2()
          },
          levelTexture: {
            value: null
          }
        }
      )),
      (this.readWaterLevelShader.defines.WIDTH = WIDTH.toFixed(1)),
      (this.readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed(1)),
      (this.readWaterLevelImage = new Uint8Array(16)),
      (this.readWaterLevelRenderTarget = new THREE.WebGLRenderTarget(4, 1, {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        stencilBuffer: !1,
        depthBuffer: !1
      }));
  }
  fillTexture(e) {
    var t = 10;
    function i(e, i) {
      for (var s = t, a = 0.05, o = 0, n = 0; n < 15; n++)
        (o += s * simplex.noise2D(e * a, i * a)),
          (s *= 0.53 + 0.025 * n),
          (a *= 1.25);
      return o;
    }
    for (var s = e.image.data, a = 0, o = 0; o < WIDTH; o++)
      for (var n = 0; n < WIDTH; n++) {
        var r = (128 * n) / WIDTH,
          h = (128 * o) / WIDTH;
        (s[a + 0] = i(r, h)),
          (s[a + 1] = s[a + 0]),
          (s[a + 2] = 0),
          (s[a + 3] = 1),
          (a += 4);
      }
  }
  render() {
    let e = this.clock.getDelta() * this.speedTime;
    if (((this.time = this.time + e), !isMobile())) {
      let e = this.heightmapVariable.material.uniforms;
      if (!0 === this.mouseMoved) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        let t = this.raycaster.intersectObject(this.shadowBlob)[0];
        if (t) {
          let i = t.uv;
          t.point;
          (i.x = 2 * (i.x - 0.5) * 256),
            (i.y = 2 * (0.5 - i.y) * 256),
            e.mousePos.value.set(i.x, i.y);
        } else e.mousePos.value.set(1e4, 1e4);
        this.gpuCompute.compute(),
          (this.blob.material.uniforms.uHeightMap.value = this.gpuCompute.getCurrentRenderTarget(
            this.heightmapVariable
          ).texture);
      }
    }
    (this.blob.material.uniforms.uTime.value = this.time),
      this.renderer.render(this.scene, this.camera);
  }
  onMove(e) {
    this.firstMove ||
      ((this.firstMove = !0),
      (this.heightmapVariable.material.uniforms.viscosityConstant.value = 0),
      setTimeout(() => {
        this.heightmapVariable.material.uniforms.viscosityConstant.value = 0;
      }, 100),
      setTimeout(() => {
        this.heightmapVariable.material.uniforms.viscosityConstant.value =
          effectController.viscosity;
      }, 1e3));
    let t = (e.clientX / window.innerWidth) * 2 - 1,
      i = (-e.clientY / window.innerHeight) * 2 + 1;

    (t = Math.max(Math.min(t, 1), -1)),
      (i = Math.max(Math.min(i, 1), -1)),
      gsap.to(this.lightBottom.position, 0.75, {
        x: 1e3 * t - 600,
        y: 1e3 * i - 100
      }),
      gsap.to([this.blob.rotation, this.shadowBlob.rotation], 0.25, {
        y: THREE.Math.degToRad(25 * t - 45) / 2
      }),
      (this.mouse.x = t),
      (this.mouse.y = i),
      gsap.to([this.blob.position, this.shadowBlob.position], 1, {
        x: t / 2,
        y: i / 2,
        z: -i
      }),
      (this.mouseMoved = !0);
  }
  onMouseMove(e) {
    this.onMove(e);
  }
  onMouseDown(e) {
    (this.mouseDown = !0),
      gsap.to(this.blob.material.uniforms.uAmplitude, {
        duration: 2,
        ease: "elastic(1, 0.3)",
        value: mouseDownState.uAmplitude
      }),
      gsap.to(this.blob.material.uniforms.uFrequency, {
        duration: 0.5,
        value: mouseDownState.uFrequency
      }),
      gsap.to(this, {
        duration: 0.5,
        speedTime: mouseDownState.speedTime
      }),
      gsap.to(this.heightmapVariable.material.uniforms.viscosityConstant, {
        duration: 0.5,
        value: 0
      });
  }
  onMouseUp(e) {
    (this.mouseDown = !1),
      gsap.to(this.blob.material.uniforms.uAmplitude, {
        duration: 2,
        value: initialState.uAmplitude,
        ease: "elastic(1, 0.3)"
      }),
      gsap.to(this.blob.material.uniforms.uFrequency, {
        duration: 0.5,
        value: initialState.uFrequency
      }),
      gsap.to(this, {
        duration: 0.5,
        speedTime: initialState.speedTime
      }),
      gsap.to(this.heightmapVariable.material.uniforms.viscosityConstant, {
        duration: 0.5,
        value: effectController.viscosity
      });
  }
  onWindowResize() {
    (this.camera.aspect = window.innerWidth / window.innerHeight),
      this.camera.updateProjectionMatrix(),
      this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
Number.prototype.map = function(e, t, i, s) {
  return ((this - e) * (s - i)) / (t - e) + i;
};

const simplex = new SimplexNoise(),
  app = new App();
