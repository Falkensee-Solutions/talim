export function timeAtPosition(x, width, start, span, duration) {
  return Math.max(0, Math.min(duration, start + Math.max(0, Math.min(1, x / Math.max(1, width))) * span));
}

export function createWaveform({ audio, onSeek, onEdit, onToggle }) {
  const $ = id => document.getElementById(id);
  const canvas = $('wave-canvas');
  const wrapper = $('waveform');
  const inputs = { start: $('start-time'), end: $('end-time') };
  let peaks = null;
  let windowStart = 0;
  let dragging = null;
  let manualWindow = false;
  const duration = () => Number.isFinite(audio.duration) ? audio.duration : 54;
  const span = () => Number($('wave-zoom').value) || duration();
  const timeAtEvent = event => {
    const rect = wrapper.getBoundingClientRect();
    return timeAtPosition(event.clientX - rect.left, rect.width, windowStart, span(), duration());
  };
  function setBoundary(kind, time) {
    inputs[kind].value = time.toFixed(3);
    onEdit(); render();
  }
  function render() {
    if (!wrapper.isConnected || wrapper.clientWidth === 0) return;
    const width = wrapper.clientWidth;
    const height = 120;
    const scale = devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * scale)) canvas.width = Math.round(width * scale);
    if (canvas.height !== Math.round(height * scale)) canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f1f6ef'; context.fillRect(0, 0, width, height);
    const start = inputs.start.valueAsNumber;
    const end = inputs.end.valueAsNumber;
    const xAt = time => (time - windowStart) / span() * width;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      context.fillStyle = '#d0e7c8'; context.fillRect(xAt(start), 0, xAt(end) - xAt(start), height);
    }
    context.strokeStyle = '#599488'; context.lineWidth = 1.5;
    context.beginPath();
    for (let x = 0; x < width; x += 2) {
      let amplitude = .02;
      if (peaks) {
        const from = Math.floor((windowStart + x / width * span()) * 100);
        const to = Math.ceil((windowStart + (x + 2) / width * span()) * 100);
        for (let index = from; index <= to && index < peaks.length; index++) amplitude = Math.max(amplitude, peaks[index] || 0);
      }
      context.moveTo(x, height / 2 - amplitude * 46);
      context.lineTo(x, height / 2 + amplitude * 46);
    }
    context.stroke();
    const playhead = xAt(audio.currentTime);
    context.fillStyle = '#e49d2b'; context.fillRect(playhead - 1, 0, 2, height);
    for (const kind of ['start', 'end']) {
      const handle = $(`${kind}-handle`);
      const value = inputs[kind].valueAsNumber;
      const visible = Number.isFinite(value) && value >= windowStart && value <= windowStart + span();
      handle.hidden = !visible;
      if (visible) handle.style.left = `${Math.max(0, Math.min(width, xAt(value)))}px`;
    }
    canvas.setAttribute('aria-valuemax', String(duration()));
    canvas.setAttribute('aria-valuenow', audio.currentTime.toFixed(2));
    canvas.setAttribute('aria-valuetext', `Ses konumu ${audio.currentTime.toFixed(2)} saniye`);
    $('wave-label').textContent = `${windowStart.toFixed(1)} – ${Math.min(duration(), windowStart + span()).toFixed(1)} sn`;
  }
  wrapper.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('.wave-handle');
    dragging = handle ? (handle.id === 'start-handle' ? 'start' : 'end') : 'seek';
    wrapper.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (dragging === 'seek') onSeek(timeAtEvent(event));
    else setBoundary(dragging, timeAtEvent(event));
    render();
  });
  wrapper.addEventListener('pointermove', event => {
    if (!dragging) return;
    if (dragging === 'seek') onSeek(timeAtEvent(event)); else setBoundary(dragging, timeAtEvent(event));
    render();
  });
  const endDrag = () => { dragging = null; };
  wrapper.addEventListener('pointerup', endDrag);
  wrapper.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', event => {
    if (event.key === ' ') { event.preventDefault(); onToggle(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const time = event.key === 'Home' ? 0 : event.key === 'End' ? duration() : audio.currentTime + (event.key === 'ArrowLeft' ? -.1 : .1);
    onSeek(Math.max(0, Math.min(duration(), time))); render();
  });
  for (const kind of ['start', 'end']) $(`${kind}-handle`).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setBoundary(kind, Math.max(0, Math.min(duration(), inputs[kind].valueAsNumber + (event.key === 'ArrowLeft' ? -.01 : .01))));
  });
  $('wave-zoom').addEventListener('change', () => { manualWindow = false; focus(audio.currentTime); });
  for (const [id, delta] of [['wave-previous', -1], ['wave-next', 1]]) $(id).addEventListener('click', () => {
    manualWindow = true;
    windowStart = Math.max(0, Math.min(Math.max(0, duration() - span()), windowStart + delta * span()));
    render();
  });
  function focus(time) {
    windowStart = Number($('wave-zoom').value) ? Math.max(0, Math.min(Math.max(0, duration() - span()), Math.floor(time / span()) * span())) : 0;
    render();
  }
  function update() {
    if (!audio.paused && !dragging && !manualWindow && (audio.currentTime < windowStart || audio.currentTime > windowStart + span())) focus(audio.currentTime);
    else render();
  }
  async function decode(buffer) {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(buffer.slice(0));
      const samples = decoded.getChannelData(0);
      peaks = new Float32Array(Math.ceil(decoded.duration * 100));
      for (let bin = 0; bin < peaks.length; bin++) {
        const start = Math.floor(bin / 100 * decoded.sampleRate);
        const end = Math.min(samples.length, Math.ceil((bin + 1) / 100 * decoded.sampleRate));
        for (let index = start; index < end; index++) peaks[bin] = Math.max(peaks[bin], Math.abs(samples[index]));
      }
      render();
    } finally { await context.close(); }
  }
  globalThis.addEventListener('resize', render);
  return { render, update, focus, decode };
}
