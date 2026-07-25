import { prefersReducedMotion } from './a11y'

/**
 * Ambient aurora — a slow, flowing WebGL gradient field layered over the
 * existing CSS glows. Hand-written (no deps); every failure mode degrades
 * silently to the CSS underneath: `mountAurora` returns null (mounting
 * nothing) on reduced-motion, missing WebGL, or shader compile failure.
 *
 * Perf contract: DPR capped at 1.5 and backing store at 720px wide (it's a
 * blurry glow — low res is free quality), ~30fps frame skip, pauses when the
 * tab is hidden or the host scrolls out of view, self-destroys when the
 * canvas leaves the DOM or the GL context is lost.
 */

export interface AuroraOptions {
  /** Three colors blended across the field (hex, e.g. '#2dd4bf'). */
  colors: [string, string, string]
  /** Opacity ceiling, 0..1. Default 0.45. */
  intensity?: number
  /** Flow speed multiplier. Default 1. */
  speed?: number
}

export interface AuroraHandle {
  canvas: HTMLCanvasElement
  setColors(colors: [string, string, string]): void
  destroy(): void
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_intensity;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  return 0.6 * noise(p) + 0.4 * noise(p * 2.1 + 7.3);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = u_time * 0.05;
  float n1 = fbm(uv * vec2(2.2, 1.6) + vec2(t, -t * 0.6));
  float n2 = fbm(uv * vec2(3.1, 2.2) - vec2(t * 0.7, t * 0.4) + 3.7);
  vec3 col = mix(u_c1, u_c2, smoothstep(0.25, 0.75, n1));
  col = mix(col, u_c3, smoothstep(0.55, 0.95, n2) * 0.6);
  float alpha = u_intensity * smoothstep(0.15, 0.8, n1 * 0.7 + n2 * 0.5) * (1.0 - uv.y * 0.5);
  gl_FragColor = vec4(col * alpha, alpha); /* premultiplied */
}
`

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null
  return sh
}

/** Mount an aurora canvas into `host`. Returns null when it can't (or shouldn't) run. */
export function mountAurora(host: HTMLElement, opts: AuroraOptions): AuroraHandle | null {
  try {
    if (prefersReducedMotion()) return null
    const canvas = document.createElement('canvas')
    canvas.className = 'aurora-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true })
    if (!gl) return null

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return null
    const prog = gl.createProgram()
    if (!prog) return null
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
    gl.useProgram(prog)

    // Fullscreen triangle.
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uC1 = gl.getUniformLocation(prog, 'u_c1')
    const uC2 = gl.getUniformLocation(prog, 'u_c2')
    const uC3 = gl.getUniformLocation(prog, 'u_c3')
    const uIntensity = gl.getUniformLocation(prog, 'u_intensity')

    const intensity = Math.max(0, Math.min(1, opts.intensity ?? 0.45))
    const speed = opts.speed ?? 1
    let colors = opts.colors.map(hexToRgb01) as [number, number, number][]

    let raf = 0
    let running = true
    let inView = true
    let destroyed = false
    let firstFrame = true
    let everConnected = false
    let last = 0
    const t0 = performance.now()

    const resize = () => {
      const w = host.clientWidth || 300
      const h = host.clientHeight || 150
      // Cap backing store: DPR ≤ 1.5 AND width ≤ 720 device px.
      const scale = Math.min(Math.min(window.devicePixelRatio || 1, 1.5), 720 / Math.max(w, 1))
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const frame = (now: number) => {
      raf = 0
      if (destroyed) return
      if (!canvas.isConnected) {
        // Callers build stages before attaching them: only a canvas that has
        // BEEN in the document and left it is dead. Pre-attach, just wait.
        if (everConnected) { destroy(); return }
        raf = requestAnimationFrame(frame)
        return
      }
      if (!everConnected) {
        everConnected = true
        resize() // now the host has real dimensions
      }
      if (!running || !inView || document.hidden) return
      if (now - last >= 32) { // ~30fps
        last = now
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform1f(uTime, ((now - t0) / 1000) * speed)
        gl.uniform3f(uC1, ...colors[0])
        gl.uniform3f(uC2, ...colors[1])
        gl.uniform3f(uC3, ...colors[2])
        gl.uniform1f(uIntensity, intensity)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
        if (firstFrame) {
          firstFrame = false
          canvas.style.opacity = '1' // fade in over the CSS fallback
        }
      }
      raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (!destroyed && !raf && running && inView && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const onVisibility = () => start()
    const io = new IntersectionObserver((entries) => {
      inView = entries[0]?.isIntersecting ?? true
      start()
    })
    const ro = new ResizeObserver(() => { resize() })

    const destroy = () => {
      if (destroyed) return
      destroyed = true
      running = false
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.remove()
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
    }

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      destroy()
    })
    document.addEventListener('visibilitychange', onVisibility)
    io.observe(host)
    ro.observe(host)

    host.append(canvas)
    resize()
    start()

    return {
      canvas,
      setColors(next) {
        colors = next.map(hexToRgb01) as [number, number, number][]
      },
      destroy,
    }
  } catch {
    return null
  }
}
