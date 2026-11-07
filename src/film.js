import * as THREE from 'three';

// «Фильм» на экране: горы Кавказа, вайнахская башня, смена времени суток.
// Та же модель неба считается в JS, чтобы боковая LED-подсветка зала
// подхватывала цвета картинки (как в настоящем Sphera).

const CYCLE = 64; // секунд на сутки

export const filmVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

export const filmFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uOn;
uniform float uPhase;
uniform float uTitle;
uniform float uReveal;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise1(float x){ float i=floor(x), f=fract(x); float a=hash(vec2(i,1.3)), b=hash(vec2(i+1.,1.3)); f=f*f*(3.-2.*f); return mix(a,b,f); }
float fbm(float x){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise1(x); x*=2.07; a*=.5; } return v; }

vec3 skyHorizon(float sunH){
  vec3 night = vec3(.10,.09,.22);
  vec3 dusk  = vec3(.98,.52,.28);
  vec3 day   = vec3(.78,.86,.95);
  vec3 c = mix(night, dusk, smoothstep(-.18,.12,sunH));
  return mix(c, day, smoothstep(.3,.75,sunH));
}
vec3 skyTop(float sunH){
  return mix(vec3(.02,.03,.09), vec3(.20,.42,.80), smoothstep(-.1,.55,sunH));
}

float layerH(float i, float x){
  return .50 - i*.095 + (fbm(x*1.15 + i*7.1) - .5) * (.42 - i*.06);
}

void main(){
  vec2 uv = vUv;
  float aspect = 2.35;
  float t = uTime;
  float cyc = fract(t / ${CYCLE.toFixed(1)} + uPhase);
  float sunH = sin(cyc * 6.28318) * .5 + .28;
  vec3 hor = skyHorizon(sunH);
  vec3 col = mix(hor, skyTop(sunH), smoothstep(.2, 1., uv.y));

  // солнце / луна
  vec2 sp = vec2(.5 + .32 * cos(cyc * 6.28318), .2 + sunH * .62);
  float sd = length((uv - sp) * vec2(aspect, 1.));
  float dayk = smoothstep(-.12, .05, sunH);
  col += vec3(1., .82, .55) * smoothstep(.055, .045, sd) * dayk;
  col += vec3(1., .55, .3) * .45 * exp(-sd * 5.) * dayk;
  vec2 mp = vec2(.5 - .32 * cos(cyc * 6.28318), .2 - sunH * .62);
  float md = length((uv - mp) * vec2(aspect, 1.));
  col += vec3(.85, .88, 1.) * smoothstep(.035, .03, md) * (1. - dayk);

  // звёзды
  float night = 1. - smoothstep(-.15, .1, sunH);
  vec2 g = floor(uv * vec2(420., 180.));
  float s = hash(g);
  col += night * step(.996, s) * (.55 + .45 * sin(t * 2. + s * 50.)) * smoothstep(.3, .7, uv.y);

  // слои гор
  for (int k = 0; k < 4; k++){
    float i = float(k);
    float scale = 1.3 + i * .7;
    float speed = .006 + i * .01;
    float x = uv.x * aspect * scale + t * speed + i * 13.;
    float h = layerH(i, x);
    float m = smoothstep(h + .002, h - .002, uv.y);
    vec3 mc = mix(hor * .7, vec3(.03, .03, .06), (i + 1.) / 4.6);
    mc *= .45 + .55 * smoothstep(-.15, .6, sunH);
    if (k == 0) {
      float snow = smoothstep(h - .06, h - .012, uv.y) * smoothstep(.5, .62, h);
      mc = mix(mc, vec3(.92, .94, 1.) * (.35 + .65 * smoothstep(-.1, .5, sunH)), snow);
    }
    mc = mix(mc, hor, .3 * (3. - i) / 3.);

    // вайнахская боевая башня на третьем плане
    if (k == 2) {
      float period = 1.6;
      float u = 1.25 - mod(t * speed / (aspect * scale), period);
      float bx = (u * aspect * scale) + t * speed + i * 13.;
      float base = layerH(i, bx) - .01;
      float px = (uv.x - u) * aspect;
      float py = uv.y - base;
      float H = .23;
      float wb = .028, wt = .019;
      float w = mix(wb, wt, clamp(py / H, 0., 1.));
      float body = step(0., py) * step(py, H) * step(abs(px), w);
      float rh = .07;
      float ry = py - H;
      float steps = floor(ry / rh * 6.) / 6.;
      float roof = step(0., ry) * step(ry, rh) * step(abs(px), wt * (1. - steps) + .002);
      float slit = step(abs(px), .003) * step(abs(fract(py * 14.) - .5), .18) * step(.04, py) * step(py, H - .02);
      float tower = max(body, roof) * (1. - slit * .8);
      vec3 tc = mc * .78;
      col = mix(col, tc, tower);
      // окошко светится ночью
      col += vec3(1., .7, .35) * slit * body * night * .9;
    }
    col = mix(col, mc, m);
  }

  // дымка у подножия
  col = mix(col, hor * .9, smoothstep(.22, 0., uv.y) * .35);

  // титр в начале сеанса
  col = mix(col, col * .35, uTitle);

  // виньетка и зерно
  vec2 q = (uv - .5) * vec2(1.4, 1.);
  col *= .72 + .28 * smoothstep(1.05, .25, length(q));
  col += (hash(uv * 900. + fract(t * 7.)) - .5) * .035;

  // лазерный «проход» при включении
  float shown = step(uv.x, uReveal);
  col *= shown;
  col += vec3(.75, .88, 1.) * exp(-abs(uv.x - uReveal) * 260.) * step(.001, uReveal) * step(uReveal, .999) * 1.6;

  col = mix(vec3(.0), col, uOn);
  col = pow(max(col, 0.), vec3(2.2)); // sRGB → linear
  gl_FragColor = vec4(col, 1.);
}`;

export function createFilmMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: filmVert,
    fragmentShader: filmFrag,
    uniforms: {
      uTime: { value: 0 },
      uOn: { value: 0 },
      uPhase: { value: 0.12 },
      uTitle: { value: 0 },
      uReveal: { value: 0 },
    },
    toneMapped: false,
  });
}

// --- JS-реплика неба для подсветки зала ---
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

export function filmAmbient(time, phase) {
  const cyc = (((time / CYCLE + phase) % 1) + 1) % 1;
  const sunH = Math.sin(cyc * Math.PI * 2) * 0.5 + 0.28;
  let hor = mix3([0.1, 0.09, 0.22], [0.98, 0.52, 0.28], smooth(-0.18, 0.12, sunH));
  hor = mix3(hor, [0.78, 0.86, 0.95], smooth(0.3, 0.75, sunH));
  const top = mix3([0.02, 0.03, 0.09], [0.2, 0.42, 0.8], smooth(-0.1, 0.55, sunH));
  const sunX = 0.5 + 0.32 * Math.cos(cyc * Math.PI * 2); // 0..1 по ширине
  const dayk = smooth(-0.12, 0.05, sunH);
  const sunCol = [1, 0.62, 0.35];
  const left = mix3(mix3(hor, top, 0.45), sunCol, dayk * Math.max(0, 1 - sunX * 1.6) * 0.6);
  const right = mix3(mix3(hor, top, 0.45), sunCol, dayk * Math.max(0, (sunX - 0.38) * 1.6) * 0.6);
  const avg = mix3(hor, top, 0.5);
  const lum = 0.35 + 0.65 * smooth(-0.15, 0.6, sunH);
  return { left, right, avg, lum };
}
