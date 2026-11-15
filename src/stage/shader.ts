// One fragment shader paints the whole living canvas from a single public-domain image:
// the studio stage (sinopia → grisaille → glaze → varnish), the week's light, the hour of the day,
// a candle's flicker, dust turning in the window light, and the brushstrokes each entry leaves.

export const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;

export const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform vec2 uImgSize;
uniform vec2 uFocus;
uniform vec2 uPointer;
uniform vec2 uLight;
uniform float uStage;
uniform float uTime;
uniform float uNight;
uniform float uZoom;
uniform float uFlash;
uniform vec4 uMood; // calm, rush, weight, plenty
in vec2 vUv;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sat(vec3 c, float s) { return mix(vec3(lum(c)), c, s); }

// The painting fills the frame like a cover image, centred on its focus, breathing very slightly.
vec2 cover(vec2 uv) {
  float ra = uRes.x / uRes.y, ia = uImgSize.x / uImgSize.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  s /= uZoom;
  return (1.0 - s) * uFocus + uv * s;
}

vec3 sinopia(vec2 p, vec2 px) {
  float tl = lum(texture(uImg, p + px * vec2(-1, -1)).rgb), t = lum(texture(uImg, p + px * vec2(0, -1)).rgb), tr = lum(texture(uImg, p + px * vec2(1, -1)).rgb);
  float l = lum(texture(uImg, p + px * vec2(-1, 0)).rgb), r = lum(texture(uImg, p + px * vec2(1, 0)).rgb);
  float bl = lum(texture(uImg, p + px * vec2(-1, 1)).rgb), b = lum(texture(uImg, p + px * vec2(0, 1)).rgb), br = lum(texture(uImg, p + px * vec2(1, 1)).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br, gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float edge = smoothstep(0.16, 0.55, length(vec2(gx, gy)) + (noise(p * 700.0) - 0.5) * 0.05);
  float shade = 1.0 - lum(texture(uImg, p).rgb);
  // Linen ground, then chalk lines and a light hatching in the shadows.
  vec3 linen = vec3(0.91, 0.86, 0.77) * (0.96 + 0.04 * sin(p.x * uImgSize.x * 1.7) * sin(p.y * uImgSize.y * 1.7));
  float hatch = smoothstep(0.5, 0.62, fract((p.x - p.y * 0.6) * uImgSize.x * 0.12)) * smoothstep(0.55, 0.95, shade) * 0.16;
  vec3 chalk = vec3(0.60, 0.25, 0.16);
  return mix(linen, chalk, clamp(edge * 0.85 + hatch + smoothstep(0.3, 1.0, shade) * 0.22, 0.0, 1.0));
}
vec3 grisaille(vec3 c) {
  float l = smoothstep(0.02, 0.95, lum(c));
  return mix(vec3(0.17, 0.12, 0.08), vec3(0.94, 0.89, 0.79), l);
}

vec3 stageColour(float s, vec3 col, vec2 p, vec2 px) {
  vec3 a = sinopia(p, px);
  vec3 g = grisaille(col);
  vec3 glaze = sat(col, 0.92);
  vec3 varnish = pow(col, vec3(0.96)) * vec3(1.04, 1.0, 0.9);
  vec3 c = mix(a, g, smoothstep(0.0, 1.0, s));
  c = mix(c, glaze, smoothstep(1.0, 2.0, s));
  return mix(c, varnish, smoothstep(2.0, 3.0, s));
}

void main() {
  vec2 uv = vUv;
  vec2 drift = vec2(sin(uTime * 0.05), cos(uTime * 0.04)) * 0.004;
  vec2 p = cover(uv + uPointer * 0.010 + drift);
  vec2 px = 1.2 / uImgSize;
  vec3 col = texture(uImg, p).rgb;
  // Dry-brush edge: the canvas weave catches paint unevenly where the brush runs thin.
  float m0 = texture(uMask, p).r;
  float tooth = noise(p * vec2(520.0, 380.0)) * 0.6 + noise(p * vec2(90.0, 1400.0)) * 0.4;
  float m = clamp(m0 + (tooth - 0.55) * 0.9 * (1.0 - m0) * step(0.01, m0), 0.0, 1.0);

  // The calendar's stage, and full colour wherever an entry has been brushed in.
  vec3 base = stageColour(uStage, col, p, px);
  float lift = smoothstep(0.15, 0.9, m);
  vec3 full = stageColour(mix(uStage, max(uStage, 2.9), lift), col, p, px);
  vec3 c = mix(base, full, smoothstep(0.0, 0.95, m));
  // A wet edge where the stroke meets the underpainting.
  c += vec3(0.95, 0.78, 0.38) * smoothstep(0.05, 0.3, m) * (1.0 - smoothstep(0.3, 0.6, m)) * 0.10;

  float l = lum(c);
  float calm = uMood.x, rush = uMood.y, weight = uMood.z, plenty = uMood.w;

  // Plenty: Venetian gold in the highlights, the colour a little richer.
  c = sat(c, 1.0 + 0.25 * plenty);
  c += vec3(0.95, 0.72, 0.28) * pow(l, 2.2) * 0.32 * plenty;
  // Weight: Northern slate, cooler and heavier.
  c = mix(c, vec3(l) * vec3(0.66, 0.71, 0.78), 0.32 * weight);
  // Calm: Vermeer's window, a warm light from the upper left.
  float win = smoothstep(1.15, 0.0, distance(uv * vec2(1.0, 0.8), vec2(0.08, 0.1)));
  c += vec3(1.0, 0.86, 0.6) * win * 0.10 * calm * (1.0 - uNight);

  // Light that follows the pointer (a lantern at night, a shaft of day otherwise).
  float spot = smoothstep(0.85, 0.05, distance(uv * vec2(uRes.x / uRes.y, 1.0), uLight * vec2(uRes.x / uRes.y, 1.0)));
  // Rush: Caravaggio's dark comes in from the edges and the spotlight tightens.
  float edgeDark = smoothstep(0.25, 0.95, distance(uv, vec2(0.5, 0.48)) * 1.25);
  c *= 1.0 - edgeDark * (0.30 + 0.55 * rush);
  c *= mix(1.0, 0.45 + 0.75 * spot, 0.55 * rush);

  // Night: the room goes to candlelight, which flickers.
  float flicker = 0.88 + 0.08 * noise(vec2(uTime * 3.1, 0.0)) + 0.04 * noise(vec2(uTime * 9.0, 4.0));
  vec3 candle = c * vec3(1.08, 0.86, 0.62) * (0.42 + 0.7 * spot) * flicker;
  c = mix(c, candle, 0.85 * uNight);

  // Dust turning in the light.
  float dust = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    vec2 q = uv * vec2(34.0, 22.0) * (1.0 + k * 0.7) + vec2(uTime * (0.012 + k * 0.004), -uTime * (0.02 + k * 0.006)) + k * 13.0;
    vec2 cell = floor(q); vec2 f = fract(q) - 0.5;
    float h = hash(cell + k);
    vec2 jitter = vec2(hash(cell * 1.7), hash(cell * 2.3)) - 0.5;
    dust += step(0.965, h) * smoothstep(0.09, 0.0, length(f - jitter * 0.6)) * (0.5 + 0.5 * sin(uTime * 1.3 + h * 40.0));
  }
  c += vec3(1.0, 0.9, 0.7) * dust * (0.35 * win + 0.4 * spot) * 0.55;

  // A brief warmth when a line is kept.
  c += vec3(0.9, 0.7, 0.3) * uFlash * 0.12 * (0.4 + spot);

  // Canvas weave and grain.
  c += (hash(uv * uRes + fract(uTime)) - 0.5) * 0.03;
  c *= 0.985 + 0.015 * sin(uv.x * uRes.x * 1.4) * sin(uv.y * uRes.y * 1.4);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
