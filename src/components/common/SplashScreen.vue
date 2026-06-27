<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  autoEnter?: boolean
  autoEnterDelay?: number
  showDontShowAgain?: boolean
}>(), {
  autoEnter: false,
  autoEnterDelay: 6000,
  showDontShowAgain: false
})

const emit = defineEmits<{
  (e: 'enter'): void
}>()

const isReady = ref(false)
const isExiting = ref(false)
const dontShowAgain = ref(false)
const splashCanvasRef = ref<HTMLCanvasElement | null>(null)

let readyTimer: ReturnType<typeof setTimeout> | null = null
let autoEnterTimer: ReturnType<typeof setTimeout> | null = null
let _resizeFn: (() => void) | null = null

/* ---------- WebGL splash canvas ---------- */
let _raf = 0
let _startedAt = 0
let _gl: WebGLRenderingContext | null = null
let _glProg: WebGLProgram | null = null
let _glBuf: WebGLBuffer | null = null
let _glU: { pos: number; res: WebGLUniformLocation | null; time: WebGLUniformLocation | null } | null = null
let _c2d: CanvasRenderingContext2D | null = null
let _w = 0
let _h = 0
let _pr = 1
const _dust: Array<{x:number;y:number;vx:number;vy:number;r:number;a:number;p:number}> = []
const _streaks: Array<{x:number;y:number;len:number;width:number;speed:number;angle:number;phase:number;color:string;delay:number;alpha:number}> = []
const _shards: Array<{ox:number;oy:number;w:number;h:number;skew:number;phase:number;color:string;alpha:number}> = []

function _cl(v: number) { return Math.max(0, Math.min(1, v)) }
function _ss(e0: number, e1: number, x: number) {
  const t = _cl((x - e0) / Math.max(0.0001, e1 - e0))
  return t * t * (3 - 2 * t)
}
function _eoc(t: number) {
  t = _cl(t)
  return 1 - Math.pow(1 - t, 3)
}

function handleEnter() {
  if (!isReady.value || isExiting.value) return
  
  if (dontShowAgain.value) {
    try {
      localStorage.setItem('mineradio_splash_dont_show', 'true')
    } catch {
      // ignore
    }
  }
  
  isExiting.value = true
  setTimeout(() => {
    emit('enter')
  }, 1180)
}

function checkDontShow(): boolean {
  try {
    return localStorage.getItem('mineradio_splash_dont_show') === 'true'
  } catch {
    return false
  }
}

/* ---------- WebGL init ---------- */
function _initGL(cvs: HTMLCanvasElement): boolean {
  let gl: WebGLRenderingContext | null = null
  try {
    gl = cvs.getContext('webgl', { alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:false, preserveDrawingBuffer:false, powerPreference:'high-performance' }) as WebGLRenderingContext
      || cvs.getContext('experimental-webgl') as WebGLRenderingContext
  } catch { gl = null }
  if (!gl) return false
  const vs = 'attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.0,1.0);}'
  const fs = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    'float saturate(float v){return clamp(v,0.0,1.0);}',
    'float ease(float v){v=saturate(v);return v*v*(3.0-2.0*v);}',
    'mat2 rot(float a){float c=cos(a);float s=sin(a);return mat2(c,-s,s,c);}',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
    'float noise(vec2 p){',
    '  vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
    'float animatedLoop(vec2 uv,float t,float channel){',
    '  vec2 q=uv;',
    '  q*=rot(0.28+sin(t*0.18)*0.12);',
    '  q.x+=0.055*sin(t*0.30+channel);',
    '  q.y+=0.040*cos(t*0.24+channel*1.7);',
    '  float ang=atan(q.y,q.x);',
    '  float angularShift=sin(ang*3.0+t*0.72+channel*1.9)*0.078;',
    '  angularShift+=sin(ang*7.0-t*0.54+channel)*0.020;',
    '  float neonD=length(q)+angularShift;',
    '  float warpD=length(q*vec2(1.34+0.06*sin(t*0.25),0.82+0.04*cos(t*0.31)));',
    '  warpD+=0.026*sin(q.x*4.4+t*0.62)+0.018*sin(q.y*5.2-t*0.45);',
    '  float diamondD=abs(q.x)*1.20+abs(q.y)*0.84;',
    '  float d=mix(warpD,diamondD,0.32);',
    '  d=mix(d,neonD,0.20+0.04*sin(t*0.18+channel));',
    '  float pattern=mod((q.x+q.y)*0.62+sin(q.x*5.5+t)*0.015+sin(q.y*7.0-t*0.75)*0.012,0.20);',
    '  float acc=0.0;',
    '  for(int i=1;i<=6;i++){',
    '    float fi=float(i);',
    '    float f=fract(t*0.152-channel*0.018+0.011*fi)*4.70-d+pattern;',
    '    acc+=0.00110*fi*fi/max(abs(f),0.0065);}',
    '  float threadCoord=q.x*0.92-q.y*0.58+0.030*sin(q.x*5.2+t*0.72);',
    '  float threadLines=0.0065/max(abs(sin((threadCoord+t*0.10+channel*0.035)*27.0)),0.070);',
    '  acc+=threadLines*(0.50+0.30*sin(ang*1.2+t+channel));',
    '  return min(acc,1.95);}',
    'void main(){',
    '  vec2 p=vUv*2.0-1.0;',
    '  p.x*=uResolution.x/max(uResolution.y,1.0);',
    '  float t=uTime;',
    '  float intro=ease(t/0.72);',
    '  float bloomIn=ease((t-0.10)/1.10);',
    '  float climax=exp(-pow((t-3.62)/0.58,2.0));',
    '  float preClimax=ease((t-2.15)/1.25)*(1.0-ease((t-3.86)/0.72));',
    '  float afterglow=exp(-pow((t-4.14)/0.62,2.0));',
    '  float calm=1.0-0.22*ease((t-4.75)/0.70);',
    '  float settle=1.0-0.34*ease((t-5.05)/0.52);',
    '  vec2 uv=p*(0.98+0.05*sin(t*0.25));',
    '  uv+=vec2(0.0,-0.025);',
    '  vec2 flowAxis=normalize(vec2(0.86,-0.50));',
    '  vec2 crossAxis=vec2(-flowAxis.y,flowAxis.x);',
    '  float lane=dot(p,flowAxis);',
    '  float crossLane=dot(p,crossAxis);',
    '  float syncWave=sin(crossLane*5.4+lane*1.1-t*1.85);',
    '  uv+=flowAxis*syncWave*0.055*climax;',
    '  uv+=crossAxis*sin(lane*7.2+t*1.25)*0.034*climax;',
    '  uv*=1.0+0.045*preClimax-0.020*climax;',
    '  vec3 ch1=vec3(1.00,0.13,0.31);',
    '  vec3 ch2=vec3(0.16,1.00,0.86);',
    '  vec3 ch3=vec3(1.00,0.76,0.28);',
    '  float a=animatedLoop(uv,t,0.0);',
    '  float b=animatedLoop(uv*1.018+vec2(0.012,-0.008),t+0.18,1.0);',
    '  float c=animatedLoop(uv*0.986+vec2(-0.010,0.010),t+0.35,2.0);',
    '  vec3 loopCol=ch1*a+ch2*b+ch3*c;',
    '  float tunnel=animatedLoop(uv*1.42+vec2(sin(t*0.2)*0.08,cos(t*0.17)*0.05),t*1.12+1.7,2.7);',
    '  loopCol+=mix(ch2,ch3,0.35+0.25*sin(t))*tunnel*(0.30+0.24*preClimax);',
    '  float syncBand=exp(-pow((lane+0.08*sin(t*0.72))/0.62,2.0));',
    '  float phaseThread=pow(0.5+0.5*sin(crossLane*13.5+lane*2.2-t*3.1),8.0);',
    '  float phaseThread2=pow(0.5+0.5*sin(crossLane*9.0-lane*5.4+t*2.4),10.0);',
    '  vec3 climaxCol=(mix(ch2,ch3,0.36)*phaseThread+ch1*phaseThread2*0.52)*syncBand*climax;',
    '  float afterBand=exp(-pow((lane-0.34)/0.72,2.0));',
    '  climaxCol+=mix(ch1,ch2,vUv.x)*afterBand*afterglow*0.13;',
    '  float centerBeam=exp(-abs(p.y+0.005*sin(t*3.0))*24.0)*(0.14+0.52*exp(-pow((t-0.74)/0.34,2.0)));',
    '  float bladeMask=smoothstep(-1.55,-0.08,p.x)*(1.0-smoothstep(0.08,1.55,p.x));',
    '  vec3 blade=mix(ch1,ch2,vUv.x)*centerBeam*bladeMask*(0.40+0.28*climax);',
    '  float flare=exp(-dot(p,p)*3.6)*exp(-pow((t-0.88)/0.40,2.0));',
    '  vec3 col=vec3(0.002,0.004,0.005);',
    '  col+=loopCol*(0.56+0.46*bloomIn)*calm*settle;',
    '  col+=climaxCol*0.22;',
    '  float diagonalGlint=exp(-pow(lane*1.2+crossLane*0.10,2.0)/0.030)*climax;',
    '  col+=blade+vec3(1.0,0.78,0.42)*flare*0.18+vec3(1.0,0.86,0.58)*diagonalGlint*0.07;',
    '  float scan=0.92+0.08*sin((vUv.y*uResolution.y+t*52.0)*0.72);',
    '  float grain=noise(vUv*uResolution.xy*0.52+t*17.0)-0.5;',
    '  col*=scan;',
    '  col+=grain*0.018;',
    '  col*=intro;',
    '  col=max(col-vec3(0.010,0.012,0.012),0.0);',
    '  col=vec3(1.0)-exp(-max(col,0.0)*(0.62+0.18*climax));',
    '  float vignette=smoothstep(1.52,0.20,length(p*vec2(0.78,1.04)));',
    '  col*=0.38+0.86*vignette;',
    '  col+=vec3(0.020,0.010,0.014)*(1.0-vignette);',
    '  gl_FragColor=vec4(col,1.0);}'
  ].join('\n')
  function compile(type: number, src: string) {
    const s = gl!.createShader(type)!
    gl!.shaderSource(s, src); gl!.compileShader(s)
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { console.warn('splash shader:', gl!.getShaderInfoLog(s)); gl!.deleteShader(s); return null }
    return s
  }
  const vert = compile(gl!.VERTEX_SHADER, vs)
  const frag = compile(gl!.FRAGMENT_SHADER, fs)
  if (!vert || !frag) return false
  const prog = gl!.createProgram()!
  gl!.attachShader(prog, vert); gl!.attachShader(prog, frag); gl!.linkProgram(prog)
  gl!.deleteShader(vert); gl!.deleteShader(frag)
  if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) { console.warn('splash prog:', gl!.getProgramInfoLog(prog)); gl!.deleteProgram(prog); return false }
  _gl = gl; _glProg = prog
  _glBuf = gl!.createBuffer()!
  gl!.bindBuffer(gl!.ARRAY_BUFFER, _glBuf)
  gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl!.STATIC_DRAW)
  _glU = { pos: gl!.getAttribLocation(prog, 'aPosition'), res: gl!.getUniformLocation(prog, 'uResolution'), time: gl!.getUniformLocation(prog, 'uTime') }
  gl!.disable(gl!.DEPTH_TEST); gl!.disable(gl!.CULL_FACE)
  return true
}

/* ---------- Canvas 2D fallback ---------- */
function _initC2D(cvs: HTMLCanvasElement) {
  _c2d = cvs.getContext('2d')
  if (!_c2d) return
  const cols = ['rgba(244,210,138,','rgba(122,215,194,','rgba(255,83,103,','rgba(157,184,207,']
  _dust.length = 0; _streaks.length = 0; _shards.length = 0
  for (let i = 0; i < 84; i++) _dust.push({ x: Math.random()*_w, y: Math.random()*_h, vx:(Math.random()-0.5)*0.18, vy:(Math.random()-0.5)*0.11, r: Math.random()*1.35+0.28, a: Math.random()*0.105+0.025, p: Math.random()*Math.PI*2 })
  for (let s = 0; s < 22; s++) _streaks.push({ x: Math.random()*_w, y: _h*(0.20+Math.random()*0.62), len: _w*(0.12+Math.random()*0.24), width: 0.75+Math.random()*2.1, speed: _w*(0.00028+Math.random()*0.00042), angle: (-10+Math.random()*20)*Math.PI/180, phase: Math.random()*Math.PI*2, color: cols[s%4], delay: Math.random()*1.1, alpha: 0.18+Math.random()*0.36 })
  for (let h = 0; h < 34; h++) _shards.push({ ox:(Math.random()-0.5)*_w*0.92, oy:(Math.random()-0.5)*_h*0.22, w: 18+Math.random()*86, h: 1+Math.random()*5, skew:(Math.random()-0.5)*20, phase: Math.random()*Math.PI*2, color: cols[h%4], alpha: 0.10+Math.random()*0.24 })
}

/* ---------- Canvas setup + resize ---------- */
function _sizeCanvas(cvs: HTMLCanvasElement) {
  _pr = Math.min(1.6, Math.max(1, window.devicePixelRatio || 1))
  _w = window.innerWidth; _h = window.innerHeight
  cvs.width = Math.max(1, Math.floor(_w * _pr))
  cvs.height = Math.max(1, Math.floor(_h * _pr))
  if (_c2d) _c2d.setTransform(_pr, 0, 0, _pr, 0, 0)
  if (_gl) _gl.viewport(0, 0, cvs.width, cvs.height)
  if (_c2d) _initC2D(cvs)
}

/* ---------- Draw ---------- */
function _draw() {
  const cvs = splashCanvasRef.value
  if (!cvs || (!_gl && !_c2d)) return
  _raf = requestAnimationFrame(_draw)
  const elapsed = (performance.now() - _startedAt) / 1000
  if (_gl && _glProg && _glU) {
    _gl.viewport(0, 0, cvs.width, cvs.height)
    _gl.useProgram(_glProg)
    _gl.bindBuffer(_gl.ARRAY_BUFFER, _glBuf)
    _gl.enableVertexAttribArray(_glU.pos)
    _gl.vertexAttribPointer(_glU.pos, 2, _gl.FLOAT, false, 0, 0)
    _gl.uniform2f(_glU.res!, cvs.width, cvs.height)
    _gl.uniform1f(_glU.time!, elapsed)
    _gl.drawArrays(_gl.TRIANGLES, 0, 3)
    return
  }
  if (_c2d) {
    const ctx = _c2d
    ctx.clearRect(0, 0, _w, _h)
    const base = ctx.createLinearGradient(0, 0, _w, _h)
    base.addColorStop(0, 'rgba(1,6,7,0.68)'); base.addColorStop(0.45, 'rgba(10,9,12,0.74)'); base.addColorStop(1, 'rgba(0,0,0,0.84)')
    ctx.fillStyle = base; ctx.fillRect(0, 0, _w, _h)
    for (const d of _dust) {
      d.x += d.vx; d.y += d.vy; d.p += 0.018
      if (d.x < -10) d.x = _w + 10; if (d.x > _w + 10) d.x = -10
      if (d.y < -10) d.y = _h + 10; if (d.y > _h + 10) d.y = -10
      const alpha = d.a * (0.58 + Math.sin(d.p + elapsed * 0.8) * 0.34)
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, alpha) + ')'; ctx.fill()
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const st of _streaks) {
      const travel = (elapsed * st.speed * 240 + st.x + Math.sin(elapsed * 0.8 + st.phase) * 28) % (_w + st.len + 180)
      const px = travel - st.len - 90, py = st.y + Math.sin(elapsed * 0.75 + st.phase) * 18
      const fade = _ss(st.delay * 0.55, st.delay * 0.55 + 0.52, elapsed) * (1 - _ss(3.52, 4.12, elapsed))
      if (fade <= 0) continue
      ctx.save(); ctx.translate(px, py); ctx.rotate(st.angle)
      const sg = ctx.createLinearGradient(-st.len * 0.5, 0, st.len * 0.5, 0)
      sg.addColorStop(0, st.color + '0)'); sg.addColorStop(0.52, st.color + (st.alpha * fade).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.strokeStyle = sg; ctx.lineWidth = st.width
      ctx.shadowColor = st.color + (0.34 * fade).toFixed(3) + ')'; ctx.shadowBlur = 18
      ctx.beginPath(); ctx.moveTo(-st.len * 0.5, 0); ctx.lineTo(st.len * 0.5, 0); ctx.stroke()
      ctx.restore()
    }
    const lineT = _eoc((elapsed - 0.12) / 1.18)
    const exitFade = 1 - _ss(3.58, 4.12, elapsed)
    if (lineT > 0 && exitFade > 0) {
      const cy = _h * 0.5 + Math.sin(elapsed * 1.4) * 1.6
      const slitW = _w * (0.16 + lineT * 0.72)
      const left = _w * 0.5 - slitW * 0.5, right = _w * 0.5 + slitW * 0.5
      const coreA = (0.34 + lineT * 0.58) * exitFade
      const slitG = ctx.createLinearGradient(left, cy, right, cy)
      slitG.addColorStop(0, 'rgba(255,83,103,0)'); slitG.addColorStop(0.18, 'rgba(255,83,103,' + (0.18*exitFade).toFixed(3) + ')')
      slitG.addColorStop(0.50, 'rgba(255,255,255,' + coreA.toFixed(3) + ')')
      slitG.addColorStop(0.68, 'rgba(244,210,138,' + (0.38*exitFade).toFixed(3) + ')')
      slitG.addColorStop(0.84, 'rgba(122,215,194,' + (0.20*exitFade).toFixed(3) + ')')
      slitG.addColorStop(1, 'rgba(122,215,194,0)')
      ctx.shadowColor = 'rgba(244,210,138,' + (0.48*exitFade).toFixed(3) + ')'
      ctx.shadowBlur = 42 + lineT * 42; ctx.lineCap = 'round'
      ctx.strokeStyle = slitG; ctx.lineWidth = 1.4 + lineT * 2.2
      ctx.beginPath(); ctx.moveTo(left, cy); ctx.lineTo(right, cy); ctx.stroke()
    }
    ctx.restore()
  }
}

onMounted(() => {
  // 启动耗时日志
  const navStart = performance.timing?.navigationStart || 0
  const mountElapsed = navStart ? Date.now() - navStart : null
  console.log(
    `[Startup] SplashScreen mounted` +
    (mountElapsed !== null ? ` (+${mountElapsed}ms since navigationStart)` : '')
  )

  if (checkDontShow()) {
    emit('enter')
    return
  }

  const cvs = splashCanvasRef.value
  if (cvs) {
    _sizeCanvas(cvs)
    if (!_initGL(cvs)) _initC2D(cvs)
    _startedAt = performance.now()
    _raf = requestAnimationFrame(_draw)
    _resizeFn = () => _sizeCanvas(cvs)
    window.addEventListener('resize', _resizeFn)
  }

  readyTimer = setTimeout(() => {
    isReady.value = true
    
    if (props.autoEnter) {
      autoEnterTimer = setTimeout(() => {
        handleEnter()
      }, props.autoEnterDelay)
    }
  }, 5000)
})

onUnmounted(() => {
  cancelAnimationFrame(_raf)
  if (_resizeFn) window.removeEventListener('resize', _resizeFn)
  if (readyTimer) clearTimeout(readyTimer)
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
  _gl = null; _glProg = null; _glBuf = null; _glU = null; _c2d = null
})
</script>

<template>
  <div 
    class="splash-screen"
    :class="{ 
      'splash--exiting': isExiting,
      'splash--ready': isReady
    }"
    @click="handleEnter"
  >
    <canvas ref="splashCanvasRef" class="splash-canvas"></canvas>
    <div class="splash-bg">
      <div class="splash-bg__gradient"></div>
      <div class="splash-bg__grid"></div>
      <div class="splash-bg__scanline"></div>
      <div class="splash-bg__noise"></div>
      <div class="splash-bg__vignette-top"></div>
      <div class="splash-bg__vignette-bottom"></div>
      <div class="splash-bg__vignette-left"></div>
      <div class="splash-bg__vignette-right"></div>
    </div>

    <div class="splash-content">
      <div class="splash-wordmark">
        <span class="splash-word-mine">Mine</span>
        <span class="splash-word-radio">rad<span class="splash-word-i"></span><span class="splash-word-o">o</span></span>
      </div>

      <div class="splash-signal-line"></div>

      <div class="splash-sub">private visual radio</div>

      <div class="splash-enter" v-if="isReady">
        <span class="splash-enter__text">Click to Enter</span>
        <span class="splash-enter__hint">点击进入</span>
      </div>

      <div class="splash-dont-show" v-if="showDontShowAgain && isReady" @click.stop>
        <label class="checkbox-label">
          <input type="checkbox" v-model="dontShowAgain" />
          <span>下次不再显示</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style>
/* 使用非 scoped 样式确保 @keyframes 动画正常播放 */
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  cursor: pointer;
  opacity: 1;
  transition: opacity 1180ms cubic-bezier(.16,1,.3,1), transform 1180ms cubic-bezier(.16,1,.3,1);
  background: #010304;
  box-shadow: inset 0 0 180px rgba(0,0,0,.88);
}

.splash--exiting {
  opacity: 0;
  transform: scale(1.018);
  pointer-events: none;
}

.splash--exiting .splash-canvas {
  opacity: 0.30;
  transform: scale(1.012);
}

.splash-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 1;
  transition: opacity 1100ms cubic-bezier(.22,1,.36,1), transform 1100ms cubic-bezier(.22,1,.36,1);
}

.splash-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.splash-bg::before {
  content: '';
  position: absolute;
  inset: -8%;
  z-index: 0;
  background:
    linear-gradient(115deg,transparent 0%,rgba(255,83,103,.055) 24%,transparent 42%,rgba(244,210,138,.052) 62%,transparent 82%),
    repeating-linear-gradient(90deg,rgba(255,255,255,.030) 0 1px,transparent 1px 54px),
    repeating-linear-gradient(0deg,rgba(255,255,255,.020) 0 1px,transparent 1px 46px),
    linear-gradient(180deg,#020606 0%,#050607 42%,#000 100%);
  filter: blur(.4px);
  opacity: .90;
  animation: splash-field-breathe 7s ease-in-out infinite alternate;
  pointer-events: none;
}

.splash-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    linear-gradient(90deg,rgba(0,0,0,.82),transparent 21%,transparent 79%,rgba(0,0,0,.82)),
    linear-gradient(180deg,rgba(0,0,0,.68),transparent 32%,transparent 64%,rgba(0,0,0,.74));
  pointer-events: none;
}

.splash-bg__gradient {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: 
    radial-gradient(ellipse at 30% 20%, rgba(217, 91, 103, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(100, 200, 220, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(244, 210, 138, 0.08) 0%, transparent 60%),
    linear-gradient(180deg, #010304 0%, #0a0a10 50%, #010304 100%);
  animation: splashBreath 7s ease-in-out infinite;
}

@keyframes splash-field-breathe {
  0% { opacity: .72; transform: scale(1); }
  100% { opacity: 1; transform: scale(1.035); }
}

@keyframes splashBreath {
  0%, 100% {
    opacity: 0.8;
    filter: brightness(0.9);
  }
  50% {
    opacity: 1;
    filter: brightness(1.15);
  }
}

.splash-bg__grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

.splash-bg__scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  opacity: 0.4;
  pointer-events: none;
}

.splash-bg__noise {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
}

.splash-bg__vignette-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(180deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(0deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-left {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 20%;
  background: linear-gradient(90deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-right {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 20%;
  background: linear-gradient(-90deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-content {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 680ms cubic-bezier(.22,1,.36,1), transform 980ms cubic-bezier(.22,1,.36,1);
}

.splash--exiting .splash-content {
  opacity: 0;
  transform: translateY(-14px) scale(.986);
}

/* ---------- 标题：绝对定位 + 中心展开 ---------- */
.splash-wordmark {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: center;
  height: clamp(70px, 12vw, 136px);
  min-width: min(74vw, 760px);
  font-size: clamp(52px, 8.8vw, 112px);
  line-height: 0.92;
  font-weight: 720;
  letter-spacing: -0.055em;
  color: #f8f8f2;
  text-shadow: 0 20px 82px rgba(0,0,0,.68), -2px 0 18px rgba(255,83,103,.16), 2px 0 18px rgba(122,215,194,.12);
  isolation: isolate;
  filter: drop-shadow(0 0 22px rgba(244,210,138,.075));
}

.splash-word-mine,
.splash-word-radio {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  will-change: opacity, transform, letter-spacing;
}

.splash-word-mine {
  opacity: 0;
  animation: splash-mine-in 5200ms cubic-bezier(.22,1,.36,1) forwards;
  text-shadow: -2px 0 0 rgba(255,83,103,.24), 2px 0 0 rgba(122,215,194,.18), 0 22px 72px rgba(0,0,0,.58), 0 0 34px rgba(244,210,138,.10);
}

.splash-word-radio {
  opacity: 0;
  letter-spacing: -0.018em;
  background: linear-gradient(94deg, rgba(255,255,255,.06), #fff 26%, rgba(244,210,138,.98) 48%, rgba(122,215,194,.90) 68%, rgba(255,255,255,.82));
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: splash-radio-in 5200ms cubic-bezier(.22,1,.36,1) forwards;
  text-shadow: -2px 0 0 rgba(255,83,103,.16), 2px 0 0 rgba(122,215,194,.22), 0 0 34px rgba(122,215,194,.10);
}

/* "i" 字母：用竖线 + 点替代 */
.splash-word-i {
  display: inline-block;
  position: relative;
  width: 0.24em;
  height: 0.86em;
  margin: 0 0.022em;
  vertical-align: -0.015em;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
.splash-word-i::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0.015em;
  width: 0.108em;
  height: 0.565em;
  border-radius: 0.06em;
  background: linear-gradient(180deg, #f8edd1 0%, #d8bd78 100%);
  transform: translateX(-50%);
  box-shadow: 0 0 14px rgba(244,210,138,.12);
}
.splash-word-i::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0.035em;
  width: 0.142em;
  height: 0.142em;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 16px rgba(244,210,138,.44), 0 0 36px rgba(255,255,255,.16);
  opacity: 0;
  transform: translate(-50%, 0.22em) scale(0.34);
  animation: splash-i-dot-pop 4200ms cubic-bezier(.22,1,.36,1) forwards;
}

/* "o" 字母：金色 */
.splash-word-o {
  display: inline-block;
  position: relative;
  color: #d8c486;
  -webkit-text-fill-color: #d8c486;
}

@keyframes splash-mine-in {
  0% {
    opacity: 0;
    clip-path: inset(48% 0 49% 0);
    transform: translate(calc(-50% - 10px), -42%) skewX(-10deg) scaleX(1.08);
    letter-spacing: 0.055em;
  }
  14% {
    opacity: 0.92;
    clip-path: inset(40% 0 42% 0);
    transform: translate(calc(-50% - 4px), -50%) skewX(-4deg) scaleX(1.04);
    letter-spacing: 0.014em;
  }
  26% {
    opacity: 1;
    clip-path: inset(0);
    transform: translate(-50%, -50%) skewX(0) scaleX(1);
    letter-spacing: -0.040em;
  }
  48% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  67% {
    opacity: 1;
    transform: translate(calc(-50% - clamp(66px, 10.8vw, 130px)), -50%) scale(0.998);
    letter-spacing: -0.055em;
  }
  100% {
    opacity: 1;
    transform: translate(calc(-50% - clamp(66px, 10.8vw, 130px)), -50%) scale(0.998);
  }
}

@keyframes splash-radio-in {
  0%, 32% {
    opacity: 0;
    clip-path: inset(52% 0 44% 0);
    transform: translate(calc(-50% + clamp(78px, 12vw, 142px)), -50%) skewX(9deg) scaleX(1.06);
    background-position: 0 0;
  }
  48% {
    opacity: 0.88;
    clip-path: inset(34% 0 32% 0);
    transform: translate(calc(-50% + clamp(72px, 11.5vw, 138px)), -50%) skewX(3deg) scaleX(1.02);
    background-position: 52% 0;
  }
  66% {
    opacity: 1;
    clip-path: inset(0);
    transform: translate(calc(-50% + clamp(70px, 11.4vw, 136px)), -50%) scale(1);
    background-position: 76% 0;
  }
  100% {
    opacity: 1;
    transform: translate(calc(-50% + clamp(70px, 11.4vw, 136px)), -50%) scale(1);
    background-position: 100% 0;
  }
}

@keyframes splash-i-dot-pop {
  0%, 48% {
    opacity: 0;
    transform: translate(-50%, 0.22em) scale(0.34);
  }
  60% {
    opacity: 1;
    transform: translate(-50%, -0.018em) scale(1.12);
  }
  68% {
    opacity: 0.92;
    transform: translate(-50%, 0.010em) scale(0.94);
  }
  76%, 100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

/* ---------- 信号线 ---------- */
.splash-signal-line {
  position: relative;
  width: min(460px, 54vw);
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(122,215,194,.22), rgba(255,255,255,.78), rgba(244,210,138,.66), rgba(255,83,103,.22), transparent);
  opacity: 0;
  transform: scaleX(0.12);
  box-shadow: 0 0 18px rgba(244,210,138,.24), 0 0 34px rgba(122,215,194,.10);
  animation: splash-signal-line 4200ms cubic-bezier(.22,1,.36,1) forwards;
}

.splash-signal-line::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,.82);
  box-shadow: 0 0 24px rgba(244,210,138,.54);
  transform: translate(-50%, -50%) scale(0.32);
  opacity: 0;
  animation: splash-signal-blip 4200ms cubic-bezier(.22,1,.36,1) forwards;
}

@keyframes splash-signal-line {
  0%, 28% {
    opacity: 0;
    transform: scaleX(0.10);
  }
  44% {
    opacity: 0.98;
    transform: scaleX(1.05);
  }
  64% {
    opacity: 0.70;
    transform: scaleX(0.82);
  }
  76% {
    opacity: 1;
    transform: scaleX(1.14);
    box-shadow: 0 0 28px rgba(244,210,138,.36), 0 0 60px rgba(122,215,194,.18);
  }
  100% {
    opacity: 0.30;
    transform: scaleX(0.64);
  }
}

@keyframes splash-signal-blip {
  0%, 42% {
    opacity: 0;
    left: 18%;
    transform: translate(-50%, -50%) scale(0.24);
  }
  62% {
    opacity: 0.94;
    left: 50%;
    transform: translate(-50%, -50%) scale(1);
  }
  76% {
    opacity: 1;
    left: 50%;
    transform: translate(-50%, -50%) scale(1.45);
  }
  100% {
    opacity: 0.16;
    left: 82%;
    transform: translate(-50%, -50%) scale(0.46);
  }
}

/* ---------- 副标题 ---------- */
.splash-sub {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: rgba(255,255,255,.34);
  text-transform: uppercase;
  opacity: 0;
  animation: splash-sub-in 4200ms cubic-bezier(.22,1,.36,1) forwards;
}

@keyframes splash-sub-in {
  0%, 38% {
    opacity: 0;
    transform: translateY(7px);
  }
  56% {
    opacity: 0.58;
    transform: translateY(0);
  }
  100% {
    opacity: 0.42;
    transform: translateY(0);
  }
}

/* ---------- 进入按钮 ---------- */
.splash-enter {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  color: rgba(255,255,255,.62);
  text-transform: uppercase;
  opacity: 0;
  transform: translateY(10px);
  text-shadow: 0 0 18px rgba(244,210,138,.24), 0 0 34px rgba(122,215,194,.12);
  transition: opacity 620ms cubic-bezier(.22,1,.36,1), transform 620ms cubic-bezier(.22,1,.36,1);
}

.splash--ready .splash-enter {
  opacity: 1;
  transform: translateY(0);
  animation: splash-enter-pulse 1800ms ease-in-out infinite alternate;
}

@keyframes splash-enter-pulse {
  0% {
    opacity: 0.46;
    text-shadow: 0 0 14px rgba(244,210,138,.16), 0 0 26px rgba(122,215,194,.08);
  }
  100% {
    opacity: 0.78;
    text-shadow: 0 0 22px rgba(244,210,138,.30), 0 0 42px rgba(122,215,194,.16);
  }
}

.splash-enter__text {
  display: block;
}

.splash-enter__hint {
  display: block;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,.50);
  margin-top: 4px;
}

.splash-dont-show {
  margin-top: 16px;
  opacity: 0;
  transition: opacity 1s ease 0.5s;
}

.splash--ready .splash-dont-show {
  opacity: 1;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #f4d28a;
}
</style>
