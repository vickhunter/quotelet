// H-01 demo video, step 2 (owner: UI/UX): fit each recorded beat into its section 7 slot (hold the
// last frame, or fast-forward a beat that ran long on a busy machine), then burn the captions.
// Input: /tmp/quotelet-aperto-demo.raw.webm (+ .beats.json) and proof/aperto-demo.srt from
// `node --import tsx sim/aperto-proof.ts video`. Output: proof/aperto-demo.mp4 (no audio, < 3:00).
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'

const RAW = process.env.RAW ?? '/tmp/quotelet-aperto-demo.raw.webm'
const OUT = 'proof/aperto-demo.mp4'
const FONT_DIR = process.env.FONT_DIR ?? '/usr/share/fonts/truetype/sand-box/google/Noto Sans' // Noto Sans, OFL
const FONT_FILE = `${FONT_DIR}/${readdirSync(FONT_DIR).find((f) => /^NotoSans-VariableFont.*\.ttf$/.test(f))}`
const FPS = 25
const MAX_SECONDS = 179
/** Screencast frames trail or lead the script clock by up to ~1 s; drop the tail of each beat so the held frame is its own end state, never the next page. */
const TAIL_CUT = 0.6

type Beat = { slot: [number, number]; at: [number, number]; name: string }
const beats: Beat[] = JSON.parse(readFileSync(`${RAW}.beats.json`, 'utf8'))

const parts: string[] = [`[0:v]fps=${FPS},split=${beats.length}${beats.map((_, i) => `[r${i}]`).join('')}`]
beats.forEach((b, i) => {
  const slot = b.slot[1] - b.slot[0]
  const end = Math.max(b.at[0] + 0.2, b.at[1] - TAIL_CUT)
  const len = end - b.at[0]
  const room = Math.max(0.5, slot - 1) // keep at least 1 s of the end state on screen
  const speed = len > room ? len / room : 1
  const shown = len / speed
  parts.push(`[r${i}]trim=start=${b.at[0].toFixed(3)}:end=${end.toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=${FPS},tpad=stop_mode=clone:stop_duration=${(slot - shown + 0.2).toFixed(3)},trim=duration=${slot.toFixed(3)},setpts=PTS-STARTPTS[s${i}]`)
  console.log(`${b.name.padEnd(13)} slot ${b.slot[0]}-${b.slot[1]}s  recorded ${len.toFixed(1)}s  speed x${speed.toFixed(2)}`)
})
const style = 'FontName=Noto Sans,FontSize=19,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00141210,BackColour=&H99141210,BorderStyle=4,Outline=8,Shadow=0,MarginV=26,Alignment=2'
parts.push(`${beats.map((_, i) => `[s${i}]`).join('')}concat=n=${beats.length}:v=1:a=0[cat]`)
parts.push(`[cat]subtitles=proof/aperto-demo.srt:fontsdir='${FONT_DIR}':force_style='${style}',drawtext=fontfile='${FONT_FILE}':text='Local build · recorded Apertus answers (mock)':fontsize=15:fontcolor=white@0.92:box=1:boxcolor=0x141210@0.55:boxborderw=8:x=w-tw-18:y=14[out]`)

const args = ['-y', '-loglevel', 'error', '-i', RAW, '-filter_complex', parts.join(';'), '-map', '[out]', '-an', '-t', String(MAX_SECONDS),
  '-c:v', 'libx264', '-preset', 'veryfast', '-threads', '2', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT]
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' })
if (r.status !== 0) process.exit(r.status ?? 1)
const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', OUT], { encoding: 'utf8' })
console.log(`${OUT}: ${Number(d.stdout).toFixed(2)} s`)
