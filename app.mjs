import { sections, verses, sectionLabel, displayArabic, alignmentUnits as letters } from './fatiha.mjs';
import { ALIGNMENT_VERSION, validateTimingDocument, nextSpokenLetter, activeLetter } from './timing.mjs';
import { validateWordPreview, applyPreviewOverrides, validatePreviewSilences, wordPreviewAt } from './word-preview.mjs';
import { versePlaybackRange, selectedVerseRanges } from './verse-playback.mjs';
import { createWaveform } from './waveform.mjs';
import { createHoldRecorder } from './hold-timing.mjs';
import { buildTalimSteps, nextTalimStep, talimGapAfter, REPEAT_GAP_SECONDS, DEFAULT_PROGRESSION, validateProgression, validateRepeatGapSeconds, repeatGapRemaining, repeatGapFraction, repeatCueTime, memoryTime } from './memorization.mjs';
import { buildStudyRanges } from './study-groups.mjs';

const $ = id => document.getElementById(id);
const audio = $('audio');
const dialog = $('editor');
const markers = new Map();
const paragraphs = new Map();
const rows = new Map();
const verseChoices = new Map();
let chosenPlayback = null;
let listeningSession = false;
let gapActive = false;
let repeatCueActive = false;
let repeatGapAnimation = null;
let timings = [];
let audioInfo = null;
let timingApiAvailable = false;
let audioObjectUrl = null;
let mode = 'full';
let segments = [];
let segmentIndex = 0;
let selectedId = letters[0].id;
let clip = null;
let playbackRequest = 0;
let frame = 0;
let highlighted = null;
let previewWords = [];
let previewSilences = [];
let previewTime = null;
let saveQueue = Promise.resolve();
let saveSequence = 0;
const holdRecorder = createHoldRecorder();
let holdInput = null;
let livePlayback = false;
let liveFinished = false;
const selectedListeningVerses = new Set(verses.map(verse => verse.id));
const selectedMemoryVerses = new Set(verses.map(verse => verse.id));
let memoryRepetitions = 3;
let memoryGapSeconds = REPEAT_GAP_SECONDS;
let memoryProgression = DEFAULT_PROGRESSION;
let memoryMode = 'verse';
let selectedMemoryParts = null;
let memorySession = null;
let memoryRunning = false;
const wave = createWaveform({
  audio,
  onSeek(time) { stop(); audio.currentTime = time; updateClock(); },
  onEdit() { $('reviewed').checked = false; },
  onToggle() { $('editor-play').click(); },
});

function setVerseChoiceLabel(element, id) {
  if (id > 0) { element.textContent = id; return; }
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.classList.add('introduction-icon');
  icon.setAttribute('viewBox', '0 0 64 64');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  for (let petal = 0; petal < 8; petal++) {
    const outline = document.createElementNS(ns, 'path');
    outline.setAttribute('d', 'M25 21 Q24 12 32 3 Q40 12 39 21');
    outline.setAttribute('transform', `rotate(${petal * 45} 32 32)`);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', 'currentColor');
    outline.setAttribute('stroke-width', '2.5');
    const inner = document.createElementNS(ns, 'path');
    inner.setAttribute('d', 'M29 21 Q29 17 32 15 Q35 17 35 21 Z');
    inner.setAttribute('transform', `rotate(${petal * 45} 32 32)`);
    inner.setAttribute('fill', 'currentColor');
    icon.append(outline, inner);
  }
  const ring = document.createElementNS(ns, 'circle');
  ring.setAttribute('cx', '32'); ring.setAttribute('cy', '32');
  ring.setAttribute('r', '10');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', 'currentColor');
  ring.setAttribute('stroke-width', '5');
  const center = document.createElementNS(ns, 'circle');
  center.setAttribute('cx', '32'); center.setAttribute('cy', '32');
  center.setAttribute('r', '3'); center.setAttribute('fill', 'currentColor');
  icon.append(ring, center);
  element.replaceChildren(icon);
}

for (const verse of sections) {
  const row = document.createElement('section');
  row.className = 'verse';
  row.setAttribute('aria-label', sectionLabel(verse.id));
  const arabic = document.createElement('p');
  arabic.className = 'arabic';
  arabic.lang = 'ar';
  arabic.dir = 'rtl';
  arabic.textContent = displayArabic(verse.arabic);
  const reading = document.createElement('p');
  reading.className = 'reading';
  reading.textContent = verse.id === 0 ? `${verse.reading.replace(/\.$/, '')} (ayet değildir).` : verse.reading;
  const marker = document.createElement('span');
  marker.className = 'letter-marker';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  const choice = document.createElement('button');
  choice.className = 'verse-choice';
  choice.type = 'button';
  setVerseChoiceLabel(choice, verse.id);
  choice.setAttribute('aria-label', `${sectionLabel(verse.id)} seç`);
  choice.setAttribute('aria-pressed', String(selectedListeningVerses.has(verse.id)));
  choice.disabled = true;
  choice.addEventListener('click', () => toggleVerseSelection(verse.id));
  verseChoices.set(verse.id, choice);
  row.append(choice, arabic, reading, marker);
  $('verses').append(row);
  markers.set(verse.id, marker);
  paragraphs.set(verse.id, arabic);
  rows.set(verse.id, row);
  const option = document.createElement('option');
  option.value = verse.id;
  option.textContent = sectionLabel(verse.id);
  $('editor-verse').append(option);
}

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const showMessage = (text, error = false) => {
  $('editor-message').textContent = text;
  $('editor-message').classList.toggle('error', error);
};
function timingDocument(values = timings) {
  return { version: 1, alignment: ALIGNMENT_VERSION, audio: audioInfo, timings: values };
}
function persistTimings() {
  if (!timingApiAvailable) {
    $('save-state').textContent = 'Bu yayın salt okunur. Değişiklikleri JSON olarak indirebilirsin; sunucuya kaydedilmez.';
    return Promise.resolve();
  }
  const payload = JSON.stringify(timingDocument());
  const sequence = ++saveSequence;
  $('save-state').textContent = 'Eşleşmeler sure dosyasına kaydediliyor…';
  $('save-state').classList.remove('error');
  const operation = saveQueue.then(async () => {
    const response = await fetch('./api/timings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Kayıt yapılamadı.');
    if (sequence === saveSequence) $('save-state').textContent = 'Eşleşmeler bu sure için kaydedildi. Yeniden açınca otomatik yüklenir.';
  });
  saveQueue = operation.catch(error => {
    if (sequence !== saveSequence) return;
    $('save-state').textContent = `Kayıt yapılamadı: ${error.message} Değişiklikler yalnızca bu açık sayfada; JSON indirerek yedekleyin.`;
    $('save-state').classList.add('error');
  });
  return saveQueue;
}
function complete() {
  if (!audioInfo) return false;
  try { validateTimingDocument(timingDocument(), audioInfo, { requireComplete: true }); return true; }
  catch { return false; }
}
function updateAlignment() {
  const ready = complete();
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.disabled = !audioInfo || (button.dataset.mode !== 'full' && !ready);
  });
  $('timing-count').textContent = `${timings.filter(t => t.reviewed).length} / ${letters.length} harf grubu doğrulandı · Harekesizler ayrı adım değildir`;
  if (!ready && mode !== 'full') mode = 'full';
  updateMemoryAvailability();
  updateVerseSelection();
  refreshSegments();
}
function clearMarker() {
  for (const marker of markers.values()) marker.hidden = true;
  highlighted = null;
  previewTime = null;
}
function highlight(id) {
  if (!id) { clearMarker(); return; }
  const letter = letters.find(letter => letter.id === id);
  if (!letter) return;
  for (const marker of markers.values()) marker.hidden = true;
  const paragraph = paragraphs.get(letter.verse);
  const range = document.createRange();
  range.setStart(paragraph.firstChild, letter.offset);
  range.setEnd(paragraph.firstChild, letter.offset + letter.length);
  const rect = range.getBoundingClientRect();
  const parent = rows.get(letter.verse).getBoundingClientRect();
  const marker = markers.get(letter.verse);
  marker.classList.remove('estimated');
  Object.assign(marker.style, { left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`, width: `${Math.max(rect.width, 5)}px`, height: `${rect.height}px` });
  marker.hidden = false;
  const previous = letters.find(letter => letter.id === highlighted);
  highlighted = id;
  rows.forEach((row, verse) => row.classList.toggle('selected', verse === letter.verse));
  if (previous?.verse !== letter.verse && !dialog.open) {
    const rowRect = rows.get(letter.verse).getBoundingClientRect();
    if (rowRect.top < 0 || rowRect.bottom > innerHeight) rows.get(letter.verse).scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
function lessonMarker(time) {
  if ((gapActive && !repeatCueActive) || !$('word-preview').checked) { clearMarker(); return; }
  if (!previewWords.length || dialog.open) {
    previewTime = null;
    highlight(activeLetter(time, timings));
    return;
  }
  const position = wordPreviewAt(time, previewWords, repeatCueActive ? [] : previewSilences);
  if (!position) { clearMarker(); return; }
  const { letter, fraction } = position;
  const previousVerse = highlighted?.split(':')[0];
  for (const marker of markers.values()) marker.hidden = true;
  const paragraph = paragraphs.get(letter.verse);
  const range = document.createRange();
  range.setStart(paragraph.firstChild, letter.offset);
  range.setEnd(paragraph.firstChild, letter.offset + letter.length);
  const rect = range.getBoundingClientRect();
  const parent = rows.get(letter.verse).getBoundingClientRect();
  const marker = markers.get(letter.verse);
  // Arabic runs right-to-left; each glyph's real rectangle also handles wrapped lines.
  const x = rect.right - fraction * rect.width;
  Object.assign(marker.style, { left: `${x - parent.left - 2.5}px`, top: `${rect.top - parent.top}px`, width: '5px', height: `${rect.height}px` });
  marker.classList.add('estimated');
  marker.hidden = false;
  highlighted = letter.id;
  previewTime = time;
  rows.forEach((row, verse) => row.classList.toggle('selected', verse === letter.verse));
  if (previousVerse !== String(letter.verse)) {
    const rowRect = rows.get(letter.verse).getBoundingClientRect();
    if (rowRect.top < 0 || rowRect.bottom > innerHeight) rows.get(letter.verse).scrollIntoView({ block: 'center', behavior: 'instant' });
  }
}
$('word-preview').addEventListener('change', () => {
  updateAlignment();
  if (memorySession && memoryRunning) lessonMarker(memorySession.cursorTime ?? memorySession.steps[memorySession.index].start);
  else if (!audio.paused && clip?.lesson) lessonMarker(audio.currentTime);
  else clearMarker();
});
function updateClock() {
  if (memorySession && !dialog.open) {
    const step = memorySession.steps[memorySession.index];
    if (memorySession.finished) renderMemoryTime(step.end);
    else if (step.role === 'child') renderMemoryTime(memorySession.cursorTime ?? step.start);
    else renderMemoryTime(audio.currentTime);
    return;
  }
  const duration = audioInfo?.duration || audio.duration || 0;
  $('clock').textContent = `${formatTime(audio.currentTime)} / ${formatTime(Number.isFinite(duration) ? duration : 0)}`;
  const current = segments[segmentIndex];
  const progress = current ? (audio.currentTime - current.start) / (current.end - current.start) : 0;
  $('progress-fill').style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  if (dialog.open && document.activeElement !== $('seek-time')) $('seek-time').value = audio.currentTime.toFixed(2);
  if (dialog.open) wave.update();
}
function toggleVerseSelection(id) {
  stop();
  if (selectedListeningVerses.has(id)) selectedListeningVerses.delete(id);
  else selectedListeningVerses.add(id);
  chosenPlayback = null;
  segmentIndex = 0;
  updateVerseSelection();
  refreshSegments();
  $('phase').textContent = 'Yalnızca seçtiğin ayetler dinlenecek.';
}
function toggleMemoryVerseSelection(id) {
  if (selectedMemoryVerses.has(id)) selectedMemoryVerses.delete(id);
  else selectedMemoryVerses.add(id);
  if (memoryMode === 'full') memoryMode = 'verse';
  selectedMemoryParts = null;
  updateMemoryAvailability();
}
function repetitionDots(count) {
  const dots = document.createElement('span');
  dots.className = 'repetition-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) dots.append(document.createElement('i'));
  return dots;
}
function updateVerseSelection() {
  const selected = [...selectedListeningVerses].sort((a, b) => a - b);
  const ranges = audioInfo ? selectedVerseRanges(previewWords, selected, audioInfo.duration) : [];
  const summary = $('selected-verse-label');
  summary.replaceChildren();
  const accessible = document.createElement('span'); accessible.className = 'sr-only';
  accessible.setAttribute('role', 'status');
  accessible.textContent = selected.length ? `${selected.map(sectionLabel).join(' · ')} seçili` : 'En az bir ayet seç.';
  summary.append(accessible);
  for (const verse of sections) {
    const chip = document.createElement('button');
    const chosen = selectedListeningVerses.has(verse.id);
    chip.type = 'button';
    chip.className = `verse-chip${chosen ? ' is-selected' : ''}`;
    chip.dataset.verse = verse.id;
    chip.setAttribute('aria-label', `${sectionLabel(verse.id)} seç`);
    chip.setAttribute('aria-pressed', String(chosen));
    chip.disabled = Boolean(memorySession) || !audioInfo || !versePlaybackRange(previewWords, verse.id, audioInfo.duration);
    chip.title = `${sectionLabel(verse.id)} · ${chosen ? 'Seçili' : 'Seçili değil'}`;
    setVerseChoiceLabel(chip, verse.id);
    if (chosen) { const check = document.createElement('small'); check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); chip.append(check); }
    chip.addEventListener('click', () => {
      toggleVerseSelection(verse.id);
      document.querySelector(`.verse-chip[data-verse="${verse.id}"]`)?.focus({ preventScroll: true });
    });
    summary.append(chip);
  }
  for (const [id, button] of verseChoices) {
    button.disabled = Boolean(memorySession) || !audioInfo || !versePlaybackRange(previewWords, id, audioInfo.duration);
    button.setAttribute('aria-pressed', String(selectedListeningVerses.has(id)));
    rows.get(id).classList.toggle('chosen', selectedListeningVerses.has(id));
  }
  $('play-from-verse').disabled = !ranges.length || Boolean(memorySession);
  $('loop-verse').disabled = !ranges.length || Boolean(memorySession);
}
function updateMemoryVerseSelection() {
  for (const button of document.querySelectorAll('[data-memory-verse]')) {
    const id = Number(button.dataset.memoryVerse);
    button.setAttribute('aria-pressed', String(selectedMemoryVerses.has(id)));
    button.textContent = String(id);
  }
  $('memory-selection-label').textContent = selectedMemoryVerses.size ? 'Hiçbirini seçme' : 'Hepsini seç';
  $('toggle-memory-selection').querySelector('.selection-square').classList.toggle('is-selected', selectedMemoryVerses.size === verses.length);
  document.querySelectorAll('[data-memory-mode][aria-pressed]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.memoryMode === memoryMode)));
}
function startSelectedVerse(repeat) {
  if (memorySession || !audioInfo) return;
  chosenPlayback = { repeat };
  segmentIndex = 0;
  refreshSegments();
  playLesson();
}
$('play-from-verse').addEventListener('click', () => startSelectedVerse(false));
$('loop-verse').addEventListener('click', () => startSelectedVerse(true));
$('stop-playback').addEventListener('click', () => {
  stop();
  if (memorySession) renderMemorySession();
  $('phase').textContent = 'Durduruldu. Tekrar dinlemek için Dinle’ye dokun.';
});
function refreshSegments() {
  if (memorySession) { renderMemorySession(); return; }
  segments = audioInfo ? selectedVerseRanges(previewWords, [...selectedListeningVerses], audioInfo.duration).map(range => ({ ...range, title: `${sectionLabel(range.verse)} · Seçili ayetler${chosenPlayback?.repeat ? ' · Sürekli tekrar' : ''}` })) : [];
  segmentIndex = Math.min(segmentIndex, Math.max(0, segments.length - 1));
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  $('listen').disabled = !segments.length;
  $('repeat').disabled = !segments.length;
  $('repeat-verse').disabled = !segments.length;
  $('repeat-verse').title = '';
  $('previous').disabled = segmentIndex === 0;
  $('next').disabled = segmentIndex >= segments.length - 1;
  rows.forEach((row, id) => row.classList.toggle('selected', mode !== 'full' && id === segments[segmentIndex]?.verse));
}
function stop() {
  gapActive = false;
  repeatCueActive = false;
  repeatGapAnimation?.cancel();
  repeatGapAnimation = null;
  $('repeat-gap').hidden = true;
  if (memorySession) memorySession.inGap = false;
  listeningSession = false;
  memoryRunning = false;
  cancelHold();
  livePlayback = false;
  updateLiveControls();
  playbackRequest++;
  clip = null;
  audio.pause();
  cancelAnimationFrame(frame);
  clearMarker();
  $('listen-icon').textContent = '▶';
  $('listen-label').textContent = 'Dinle';
  $('editor-play').textContent = '▶ Sesi dinle';
}
function renderRepeatGap(remaining, gapSeconds) {
  const fraction = repeatGapFraction(remaining, gapSeconds);
  const gap = $('repeat-gap');
  gap.hidden = false;
  $('repeat-gap-fill').style.transform = `scaleX(${fraction})`;
  gap.setAttribute('aria-valuenow', (fraction * 100).toFixed(1));
  const seconds = Math.ceil(remaining * 2) / 2;
  gap.setAttribute('aria-valuetext', `${seconds.toLocaleString('tr-TR')} saniye kaldı`);
}
function startRepeatGap(onComplete, gapSeconds = memorySession?.gapSeconds ?? REPEAT_GAP_SECONDS) {
  validateRepeatGapSeconds(gapSeconds);
  stop();
  gapActive = true;
  const request = playbackRequest;
  const started = performance.now();
  if (memorySession) {
    memorySession.inGap = true;
    memoryRunning = true;
    renderMemorySession();
    renderMemoryTime(memorySession.steps[memorySession.index].start);
  } else {
    refreshSegments();
    audio.currentTime = segments[segmentIndex]?.start || 0;
    updateClock();
  }
  renderRepeatGap(gapSeconds, gapSeconds);
  repeatGapAnimation = $('repeat-gap-fill').animate?.(
    [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
    { duration: gapSeconds * 1000, easing: 'linear', fill: 'forwards' },
  ) ?? null;
  $('phase').textContent = 'Hazırlan…';
  $('listen-icon').textContent = 'Ⅱ';
  $('listen-label').textContent = 'Duraklat';
  const gapTick = now => {
    if (request !== playbackRequest || !gapActive) return;
    const remaining = repeatGapRemaining((now - started) / 1000, gapSeconds);
    if (remaining <= 0) {
      renderRepeatGap(0, gapSeconds);
      gapActive = false;
      repeatCueActive = false;
      $('repeat-gap').hidden = true;
      if (memorySession) memorySession.inGap = false;
      onComplete();
      return;
    }
    const cueTime = repeatCueTime(memorySession?.steps[memorySession.index], remaining);
    repeatCueActive = cueTime !== null;
    if (repeatCueActive) lessonMarker(cueTime);
    renderRepeatGap(remaining, gapSeconds);
    frame = requestAnimationFrame(gapTick);
  };
  frame = requestAnimationFrame(gapTick);
}
function tick() {
  updateClock();
  if (clip && audio.currentTime >= clip.end) {
    if (listeningSession) { finishListeningClip(); return; }
    const wasLesson = clip.lesson;
    const end = clip.end;
    if (memorySession && wasLesson) { finishMemoryStep(); return; }
    if (livePlayback && holdRecorder.active) finishHold(end);
    stop();
    audio.currentTime = Math.min(end, audio.duration);
    if (wasLesson) $('phase').textContent = 'Şimdi sıra sende! Sen de tekrar et.';
    updateClock();
    return;
  }
  if (clip?.lesson) lessonMarker(audio.currentTime);
  if (!audio.paused) frame = requestAnimationFrame(tick);
}
async function playRange(start, end, lesson = false, repeat = false) {
  stop();
  const request = playbackRequest;
  clip = { start, end, lesson, repeat };
  audio.currentTime = start;
  audio.playbackRate = dialog.open ? Number($('alignment-speed').value) : 1;
  audio.preservesPitch = true;
  try {
    await audio.play();
    if (request !== playbackRequest) return;
    if (lesson) {
      $('phase').textContent = !memorySession && chosenPlayback?.repeat ? 'Seçili ayetler tekrar ediyor. Bitirmek için Durdur’a dokun.' : 'Hocayı dikkatle dinleyelim…';
      $('listen-icon').textContent = 'Ⅱ';
      $('listen-label').textContent = 'Duraklat';
    } else $('editor-play').textContent = 'Ⅱ Duraklat';
    frame = requestAnimationFrame(tick);
  } catch (error) {
    if (request !== playbackRequest) return;
    stop();
    const message = `Ses başlatılamadı: ${error.message}`;
    if (dialog.open) showMessage(message, true); else $('phase').textContent = message;
  }
}
function playListeningSegment() {
  const current = segments[segmentIndex];
  if (!current) return;
  refreshSegments();
  const playback = playRange(current.start, current.end, true);
  listeningSession = true;
  if (chosenPlayback?.repeat) $('phase').textContent = 'Seçili ayetler tekrar ediyor. Bitirmek için Durdur’a dokun.';
  void playback;
}
function finishListeningClip() {
  if (segmentIndex + 1 < segments.length) segmentIndex++;
  else if (chosenPlayback?.repeat) { segmentIndex = 0; startRepeatGap(playListeningSegment); return; }
  else { stop(); segmentIndex = 0; refreshSegments(); $('phase').textContent = 'Seçili ayetler tamamlandı.'; updateClock(); return; }
  playListeningSegment();
}
function playLesson() {
  if (memorySession) { restartMemoryVerse(); return; }
  playListeningSegment();
}
$('listen').addEventListener('click', () => {
  if (gapActive) {
    stop();
    if (memorySession) renderMemorySession();
    $('phase').textContent = 'Bekleme duraklatıldı. Dinle ile yeniden başlat.';
    return;
  }
  if (memorySession) {
    if (memoryRunning || !audio.paused) { stop(); $('phase').textContent = 'Duraklatıldı. Dinle ile bu ayeti hocadan baştan dinleyebilirsin.'; }
    else restartMemoryVerse();
    return;
  }
  if (!audio.paused && clip?.lesson) { stop(); $('phase').textContent = 'Duraklatıldı. Dinle ile parçayı baştan başlat.'; }
  else playLesson();
});
$('repeat').addEventListener('click', () => {
  if (memorySession) {
    memorySession.index = 0;
    memorySession.finished = false;
    memorySession.waitingNext = false;
    void runMemoryStep();
  } else { segmentIndex = 0; playLesson(); }
});
$('repeat-verse').addEventListener('click', () => {
  if (memorySession) {
    if (memorySession.mode === 'full') return;
    const verse = memorySession.steps[memorySession.index].verse;
    memorySession.index = memorySession.steps.findIndex(step => step.verse === verse && step.role === 'teacher');
    memorySession.finished = false;
    memorySession.waitingNext = false;
    void runMemoryStep();
    return;
  }
  const verse = segments[segmentIndex]?.verse;
  const range = audioInfo && versePlaybackRange(previewWords, verse, audioInfo.duration, true);
  if (range) {
    chosenPlayback = null;
    refreshSegments();
    void playRange(range.start, range.end, true);
  }
});
function moveSegment(delta) {
  if (memorySession) { moveMemoryVerse(delta); return; }
  stop();
  segmentIndex = Math.max(0, Math.min(segments.length - 1, segmentIndex + delta));
  refreshSegments();
  audio.currentTime = segments[segmentIndex].start;
  updateClock();
  $('phase').textContent = 'Hazırsan bu parçayı dinleyelim.';
}
$('previous').addEventListener('click', () => moveSegment(-1));
$('next').addEventListener('click', () => moveSegment(1));
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => {
  stop(); chosenPlayback = null; mode = button.dataset.mode; segmentIndex = 0; refreshSegments();
  audio.currentTime = 0; updateClock(); $('phase').textContent = 'Hazırsan başlayalım!';
});
$('toggle-reading').addEventListener('change', () => {
  $('verses').classList.toggle('hide-reading', !$('toggle-reading').checked);
});
$('open-display-settings').addEventListener('click', () => $('display-settings').showModal());
$('close-display-settings').addEventListener('click', () => $('display-settings').close());
$('display-settings').addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); $('display-settings').close(); }
});
$('display-settings').addEventListener('close', () => $('open-display-settings').focus());
audio.addEventListener('timeupdate', updateClock);
audio.addEventListener('ended', () => {
  if (listeningSession) { finishListeningClip(); return; }
  const wasLesson = clip?.lesson;
  if (memorySession && wasLesson) { finishMemoryStep(); return; }
  if (livePlayback && holdRecorder.active) finishHold(audio.duration);
  stop(); updateClock();
  if (wasLesson) $('phase').textContent = 'Şimdi sıra sende! Sen de tekrar et.';
});
audio.addEventListener('error', () => {
  stop(); $('phase').textContent = 'Ses yüklenemedi. 001.mp3 dosyasını ve yerel sunucuyu kontrol edin.';
  $('listen').disabled = true; $('repeat').disabled = true; $('repeat-verse').disabled = true;
});

for (const verse of verses) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.memoryVerse = verse.id;
  button.setAttribute('aria-label', sectionLabel(verse.id));
  button.setAttribute('aria-pressed', 'true');
  button.textContent = String(verse.id);
  button.addEventListener('click', () => toggleMemoryVerseSelection(verse.id));
  $('memory-verse-picker').append(button);
}
$('toggle-memory-selection').addEventListener('click', () => {
  if (selectedMemoryVerses.size) {
    selectedMemoryVerses.clear();
    if (memoryMode === 'full') memoryMode = 'verse';
  } else {
    verses.forEach(verse => selectedMemoryVerses.add(verse.id));
  }
  selectedMemoryParts = null;
  updateMemoryAvailability();
});
for (const button of document.querySelectorAll('[data-memory-mode][aria-pressed]')) button.addEventListener('click', () => {
  memoryMode = button.dataset.memoryMode;
  selectedMemoryParts = null;
  if (memoryMode === 'full') {
    selectedMemoryVerses.clear();
    verses.forEach(verse => selectedMemoryVerses.add(verse.id));
  }
  updateMemoryAvailability();
});
for (const button of document.querySelectorAll('[data-memory-repetitions]')) {
  const count = Number(button.dataset.memoryRepetitions);
  button.replaceChildren();
  const number = document.createElement('span'); number.className = 'repeat-number'; number.textContent = count;
  button.append(number, repetitionDots(count));
  button.addEventListener('click', () => {
    memoryRepetitions = count;
    document.querySelectorAll('[data-memory-repetitions]').forEach(option => {
      option.setAttribute('aria-pressed', String(Number(option.dataset.memoryRepetitions) === memoryRepetitions));
    });
    updateMemoryAvailability();
  });
}
for (const button of document.querySelectorAll('[data-memory-gap]')) {
  button.addEventListener('click', () => {
    memoryGapSeconds = Number(button.dataset.memoryGap);
    document.querySelectorAll('[data-memory-gap]').forEach(option => {
      option.setAttribute('aria-pressed', String(Number(option.dataset.memoryGap) === memoryGapSeconds));
    });
    updateMemoryAvailability();
  });
}
for (const button of document.querySelectorAll('[data-memory-progression]')) {
  button.addEventListener('click', () => {
    memoryProgression = button.dataset.memoryProgression;
    document.querySelectorAll('[data-memory-progression]').forEach(option => {
      option.setAttribute('aria-pressed', String(option.dataset.memoryProgression === memoryProgression));
    });
    updateMemoryAvailability();
  });
}
function memoryPartSelection() { return selectedMemoryParts === null ? null : [...selectedMemoryParts]; }
function renderMemoryParts() {
  const stepped = ['medium', 'many'].includes(memoryMode);
  $('memory-parts').hidden = !stepped;
  $('memory-part-picker').replaceChildren();
  if (!stepped || !audioInfo) return;
  const selected = [...selectedMemoryVerses].filter(id => id > 0);
  const ranges = buildStudyRanges(previewWords, selected, audioInfo.duration, memoryMode);
  for (const verse of [...new Set(ranges.map(range => range.verse))]) {
    const group = document.createElement('section');
    const title = document.createElement('h3');
    title.dir = 'ltr';
    title.textContent = `${verse}. ayet`;
    group.append(title);
    for (const range of ranges.filter(range => range.verse === verse)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.part = range.key;
      button.setAttribute('aria-pressed', String(selectedMemoryParts === null || selectedMemoryParts.has(range.key)));
      button.setAttribute('aria-label', `${verse}. ayet ${range.part}. adım: ${displayArabic(range.text)}`);
      const text = document.createElement('span');
      text.lang = 'ar'; text.dir = 'rtl'; text.textContent = displayArabic(range.text);
      const duration = document.createElement('small');
      duration.dir = 'ltr';
      duration.textContent = `${range.part}. adım · ${(range.end - range.start).toFixed(1)} sn`;
      button.append(text, duration);
      button.addEventListener('click', () => {
        if (selectedMemoryParts === null) selectedMemoryParts = new Set(ranges.map(value => value.key));
        if (selectedMemoryParts.has(range.key)) selectedMemoryParts.delete(range.key);
        else selectedMemoryParts.add(range.key);
        updateMemoryAvailability();
        document.querySelector(`[data-part="${range.key}"]`)?.focus();
      });
      group.append(button);
    }
    $('memory-part-picker').append(group);
  }
}
function updateMemoryAvailability() {
  updateMemoryVerseSelection();
  try {
    if (!audioInfo) throw new Error('Ses bilgisi yükleniyor…');
    validateProgression(memoryProgression);
    validateRepeatGapSeconds(memoryGapSeconds);
    const selected = [...selectedMemoryVerses].filter(id => id > 0);
    renderMemoryParts();
    buildTalimSteps(previewWords, audioInfo, selected, memoryMode, memoryPartSelection(), memoryRepetitions);
    $('start-memory').disabled = false;
    $('memory-availability').textContent = '';
    $('memory-availability').hidden = true;
  } catch (error) {
    $('start-memory').disabled = true;
    $('memory-availability').textContent = error.message;
    $('memory-availability').hidden = false;
  }
}
function renderMemoryTime(time) {
  const step = memorySession?.steps[memorySession.index];
  if (!step) return;
  memorySession.cursorTime = time;
  const elapsed = Math.max(0, Math.min(step.end - step.start, time - step.start));
  $('clock').textContent = `${formatTime(elapsed)} / ${formatTime(step.end - step.start)}`;
  $('progress-fill').style.width = `${elapsed / (step.end - step.start) * 100}%`;
}
function renderMemoryTurns(step) {
  const visual = $('memory-turn-visual');
  const complete = memorySession.waitingNext || memorySession.finished;
  visual.replaceChildren();
  visual.setAttribute('aria-label', memorySession.inGap ? 'Sonraki tekrar için hazırlan.' : step.role === 'teacher' ? 'Dinleniyor.' : `${step.repetition}/${memorySession.repetitions} tekrar${complete ? ' tamamlandı' : ''}.`);
  const dots = document.createElement('span'); dots.className = 'turn-dots'; dots.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= memorySession.repetitions; i++) {
    const dot = document.createElement('span');
    const done = complete || (step.role === 'child' && i < step.repetition);
    const current = !complete && !memorySession.inGap && step.role === 'child' && i === step.repetition;
    const next = memorySession.inGap && i === step.repetition;
    dot.className = `turn-dot${done ? ' is-done' : ''}${current ? ' is-current' : ''}${next ? ' is-next' : ''}`;
    dot.textContent = done ? '✓' : i;
    dots.append(dot);
  }
  visual.append(dots);
}
function renderMemorySession() {
  if (!memorySession) return;
  const step = memorySession.steps[memorySession.index];
  renderMemoryTurns(step);
  const teachers = memorySession.steps.filter(value => value.role === 'teacher');
  const verseIndex = teachers.findIndex(value => value.key === step.key);
  const label = memorySession.mode === 'full' ? 'Fatiha’nın tamamı' : `${step.verse}. ayet${step.part ? ` · ${step.part}/${step.totalParts} ${memorySession.mode === 'many' ? 'küçük' : 'orta'} adım` : ''}`;
  $('memory-part-text').hidden = !step.text;
  $('memory-part-text').textContent = step.text ? displayArabic(step.text) : '';
  rows.forEach((row, id) => { row.hidden = !step.verses.includes(id); row.classList.toggle('selected', step.verses.includes(id)); });
  $('memory-step-label').textContent = memorySession.finished ? 'Ezber turu tamamlandı!' : memorySession.inGap ? `${label} · Hazırlan` : memorySession.waitingNext
    ? `${label} · ${memorySession.repetitions} tekrar tamamlandı. Hazır olunca sonraki bölüme geç.` : step.role === 'teacher'
      ? `${label} · Dinle`
      : `${label} · ${step.repetition}/${memorySession.repetitions}. tekrar`;
  $('memory-session').classList.toggle('child-turn', step.role === 'child' && !memorySession.finished && !memorySession.inGap);
  $('previous').disabled = verseIndex === 0;
  $('next').disabled = !memorySession.waitingNext;
  $('memory-next').hidden = memorySession.mode === 'full' || memorySession.progression === 'auto';
  $('memory-next').disabled = !memorySession.waitingNext;
  $('memory-next').textContent = step.part ? 'Sonraki adıma geç →' : 'Sonraki ayete geç →';
  $('repeat-verse').disabled = memorySession.mode === 'full';
  $('repeat-verse').title = memorySession.mode === 'full' ? 'Tam modunda Baştan tekrar et düğmesini kullan.' : '';
  $('memory-session').dataset.role = memorySession.finished ? 'finished' : memorySession.waitingNext ? 'waiting' : memorySession.inGap ? 'gap' : step.role;
  $('memory-session').dataset.repetition = step.repetition;
  $('listen').disabled = false;
  $('repeat').disabled = false;
}
async function runMemoryStep() {
  if (!memorySession) return;
  stop();
  const session = memorySession;
  const step = session.steps[session.index];
  renderMemorySession();
  renderMemoryTime(step.start);
  if (step.role === 'teacher') {
    const playback = playRange(step.start, step.end, true);
    const request = playbackRequest;
    await playback;
    if (request !== playbackRequest || session !== memorySession || audio.paused) return;
    memoryRunning = true;
    return;
  }
  memoryRunning = true;
  lessonMarker(step.start);
  $('phase').textContent = `Şimdi sen söyle · ${step.repetition}/${session.repetitions}. tekrar`;
  $('listen-icon').textContent = 'Ⅱ';
  $('listen-label').textContent = 'Duraklat';
  const request = playbackRequest;
  const started = performance.now();
  const silentTick = now => {
    if (request !== playbackRequest || session !== memorySession || !memoryRunning) return;
    const time = memoryTime(step, (now - started) / 1000);
    renderMemoryTime(time);
    lessonMarker(time);
    if (time >= step.end) { finishMemoryStep(); return; }
    frame = requestAnimationFrame(silentTick);
  };
  frame = requestAnimationFrame(silentTick);
}
function finishMemoryStep() {
  if (!memorySession) return;
  const gap = talimGapAfter(memorySession.steps, memorySession.index, memorySession.mode, memorySession.gapSeconds, memorySession.progression);
  stop();
  Object.assign(memorySession, nextTalimStep(memorySession.steps, memorySession.index, memorySession.mode, memorySession.progression));
  if (memorySession.waitingNext || memorySession.finished) {
    renderMemorySession();
    renderMemoryTime(memorySession.steps[memorySession.index].end);
    $('phase').textContent = memorySession.finished ? 'Ezber turu tamamlandı.' : `${memorySession.repetitions} tekrar tamamlandı.`;
  } else if (gap) startRepeatGap(() => { void runMemoryStep(); }, gap);
  else void runMemoryStep();
}
function restartMemoryVerse() {
  if (!memorySession) return;
  const key = memorySession.steps[memorySession.index].key;
  memorySession.index = memorySession.steps.findIndex(step => step.key === key && step.role === 'teacher');
  memorySession.finished = false;
  memorySession.waitingNext = false;
  void runMemoryStep();
}
function moveMemoryVerse(delta) {
  if (!memorySession) return;
  const teachers = memorySession.steps.map((step, index) => ({ step, index })).filter(value => value.step.role === 'teacher');
  const current = teachers.findIndex(value => value.step.key === memorySession.steps[memorySession.index].key);
  memorySession.index = teachers[Math.max(0, Math.min(teachers.length - 1, current + delta))].index;
  memorySession.finished = false;
  memorySession.waitingNext = false;
  void runMemoryStep();
}
$('memory-next').addEventListener('click', () => {
  if (memorySession?.waitingNext) { moveMemoryVerse(1); $('listen').focus(); }
});
function exitMemory() {
  if (!memorySession) return;
  stop();
  memorySession = null;
  segmentIndex = 0;
  updateVerseSelection();
  $('memory-session').hidden = true;
  $('memory-next').hidden = true;
  $('memory-next').disabled = true;
  $('exit-memory').hidden = true;
  $('open-memory').hidden = false;
  $('memory-setup').hidden = false;
  document.querySelector('.lesson').classList.remove('memory-active');
  rows.forEach(row => { row.hidden = false; });
  $('phase').textContent = 'Hazırsan başlayalım!';
  refreshSegments();
  updateClock();
  $('open-memory').focus();
}
$('open-memory').addEventListener('click', () => {
  stop();
  selectedMemoryVerses.clear();
  verses.forEach(verse => selectedMemoryVerses.add(verse.id));
  selectedMemoryParts = null;
  updateMemoryAvailability();
  $('memory-setup').hidden = false;
  $('memory-dialog').showModal();
});
$('close-memory').addEventListener('click', () => $('memory-dialog').close());
$('memory-dialog').addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); $('memory-dialog').close(); }
});
$('memory-dialog').addEventListener('close', () => { if (!memorySession) $('open-memory').focus(); });
$('start-memory').addEventListener('click', () => {
  try {
    validateProgression(memoryProgression);
    validateRepeatGapSeconds(memoryGapSeconds);
    const steps = buildTalimSteps(previewWords, audioInfo, [...selectedMemoryVerses].filter(id => id > 0), memoryMode, memoryPartSelection(), memoryRepetitions);
    stop();
    chosenPlayback = null;
    memorySession = { steps, index: 0, repetitions: memoryRepetitions, gapSeconds: memoryGapSeconds, progression: memoryProgression, mode: memoryMode, finished: false, waitingNext: false, inGap: false };
    $('memory-dialog').close();
    updateVerseSelection();
    $('memory-setup').hidden = true;
    $('memory-session').hidden = false;
    $('exit-memory').hidden = false;
    $('open-memory').hidden = true;
    document.querySelector('.lesson').classList.add('memory-active');
    void runMemoryStep();
    $('listen').focus();
  } catch (error) { $('memory-availability').textContent = error.message; $('memory-availability').hidden = false; }
});
$('exit-memory').addEventListener('click', exitMemory);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gapActive) {
    stop();
    if (memorySession) renderMemorySession();
    $('phase').textContent = 'Bekleme duraklatıldı. Dinle ile yeniden başlat.';
    return;
  }
  if (document.hidden && memorySession && !memorySession.finished && (memoryRunning || !audio.paused)) {
    stop(); $('phase').textContent = 'Ezber turu duraklatıldı. Dinle ile bu ayeti baştan başlat.';
  }
});

function renderPicker() {
  const verse = Number($('editor-verse').value);
  $('editor-arabic').textContent = displayArabic(sections.find(section => section.id === verse).arabic);
  $('letter-picker').replaceChildren();
  for (const letter of letters.filter(letter => letter.verse === verse)) {
    const button = document.createElement('button');
    button.textContent = displayArabic(letter.text);
    button.dataset.letterId = letter.id;
    button.setAttribute('aria-label', `${letters.indexOf(letter) + 1}. harf grubu: ${displayArabic(letter.text)}`);
    button.setAttribute('aria-pressed', String(letter.id === selectedId));
    button.classList.toggle('done', timings.some(t => t.id === letter.id && t.reviewed));
    button.addEventListener('click', () => selectLetter(letter.id));
    $('letter-picker').append(button);
  }
  const selected = letters.find(letter => letter.id === selectedId);
  if (globalThis.Highlight && globalThis.CSS?.highlights && selected?.verse === verse) {
    const range = document.createRange();
    range.setStart($('editor-arabic').firstChild, selected.offset);
    range.setEnd($('editor-arabic').firstChild, selected.offset + selected.length);
    CSS.highlights.set('editor-letter', new Highlight(range));
  }
}
$('editor-arabic').addEventListener('pointerdown', event => {
  const position = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = position ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = position?.offsetNode || range?.startContainer;
  const offset = position?.offset ?? range?.startOffset;
  if (node !== $('editor-arabic').firstChild) return;
  const verse = Number($('editor-verse').value);
  const candidates = letters.filter(letter => letter.verse === verse);
  const letter = candidates.find(letter => offset >= letter.offset && offset < letter.offset + letter.length)
    || candidates.reduce((nearest, letter) => Math.abs(letter.offset - offset) < Math.abs(nearest.offset - offset) ? letter : nearest);
  if (letter) { event.preventDefault(); selectLetter(letter.id); }
});
function selectLetter(id) {
  cancelHold();
  liveFinished = false;
  selectedId = id;
  const letter = letters.find(letter => letter.id === id);
  const timing = timings.find(timing => timing.id === id);
  $('editor-verse').value = letter.verse;
  $('selected-letter').textContent = displayArabic(letter.text);
  $('letter-position').textContent = `${sectionLabel(letter.verse)} · ${letter.word + 1}. kelime · ${letters.indexOf(letter) + 1}/${letters.length}. harf grubu`;
  $('start-time').value = timing ? timing.start.toFixed(3) : '';
  $('end-time').value = timing ? timing.end.toFixed(3) : '';
  $('reviewed').checked = timing?.reviewed || false;
  if (timing) wave.focus(timing.start); else wave.render();
  renderPicker();
  updateLiveControls();
}

function updateLiveControls() {
  const index = letters.findIndex(letter => letter.id === selectedId);
  $('hold-glyph').textContent = displayArabic(letters[index].text);
  $('next-glyph').textContent = displayArabic(nextSpokenLetter(selectedId)?.text || '✓');
  $('hold-letter').disabled = !livePlayback || audio.paused || liveFinished;
  $('live-play').disabled = !audioInfo;
  $('live-restart').disabled = !audioInfo;
  $('live-play').textContent = livePlayback ? 'Ⅱ Eşleştirmeyi duraklat' : '▶ Eşleştirmeyi başlat';
  $('space-next').disabled = !livePlayback || audio.paused || liveFinished;
  $('end-verse').disabled = !livePlayback || audio.paused;
  $('hold-hint').textContent = holdInput === 'space-step' ? 'Sonraki harfte boşluğa bas' : holdRecorder.active ? 'Ses sürdükçe basılı tut…' : 'Harf okunurken basılı tut';
  $('hold-letter').classList.toggle('holding', holdRecorder.active);
}
function cancelHold() {
  holdRecorder.cancel();
  holdInput = null;
  $('hold-letter').classList.remove('holding');
  $('hold-hint').textContent = 'Harf okunurken basılı tut';
}
function beginHold(input) {
  if (!livePlayback || audio.paused || liveFinished || !dialog.open || holdInput !== null) return false;
  if (!holdRecorder.begin(selectedId, audio.currentTime)) return false;
  holdInput = input;
  updateLiveControls();
  return true;
}
function saveLiveTiming(candidate) {
  try {
    timings = validateTimingDocument(timingDocument([...timings.filter(timing => timing.id !== candidate.id), candidate]), audioInfo);
    updateAlignment();
    void persistTimings();
    const next = nextSpokenLetter(candidate.id);
    if (next) {
      selectLetter(next.id);
      $('live-status').textContent = 'Harf işaretlendi. Sıradaki harf okununca basılı tut.';
    } else {
      selectLetter(candidate.id);
      liveFinished = true;
      stop();
      $('live-status').textContent = 'Son harf de işaretlendi. Kaydedilme durumunu kontrol edip eşleşmeleri dinleyerek gözden geçirin.';
    }
    updateLiveControls();
  } catch (error) {
    stop();
    $('live-status').textContent = `Eşleşme kaydedilemedi: ${error.message} Seçili harften tekrar dinleyip düzeltin.`;
  }
}
function finishHold(time = audio.currentTime) {
  const candidate = holdRecorder.finish(time);
  holdInput = null;
  updateLiveControls();
  if (candidate) saveLiveTiming(candidate);
}
async function startLive(restart = false) {
  if (!audioInfo) return;
  if (livePlayback && !restart) { stop(); return; }
  const first = nextSpokenLetter(selectedId, true);
  if (!first) { showMessage('Bu noktadan sonra eşleştirilecek harf kalmadı.'); return; }
  selectLetter(first.id);
  let start = audio.currentTime >= audio.duration ? 0 : audio.currentTime;
  if (restart) {
    const index = letters.findIndex(letter => letter.id === selectedId);
    start = timings.find(timing => timing.id === selectedId)?.start
      ?? letters.slice(0, index).reverse().map(letter => timings.find(timing => timing.id === letter.id)?.end).find(time => time !== undefined) ?? 0;
  }
  const playback = playRange(start, audioInfo.duration);
  const request = playbackRequest;
  await playback;
  if (request !== playbackRequest || audio.paused || !dialog.open) return;
  livePlayback = true;
  liveFinished = false;
  updateLiveControls();
  $('live-status').textContent = 'Hocayı dinle. Gösterilen harf okununca basılı tut, bittiğinde bırak.';
}
$('live-play').addEventListener('click', () => { void startLive(); });
$('live-restart').addEventListener('click', () => { void startLive(true); });
$('hold-letter').addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  if (beginHold(event.pointerId)) $('hold-letter').setPointerCapture(event.pointerId);
});
$('hold-letter').addEventListener('pointerup', event => {
  if (holdInput !== event.pointerId) return;
  event.preventDefault();
  finishHold();
});
for (const eventName of ['pointercancel', 'lostpointercapture']) $('hold-letter').addEventListener(eventName, () => {
  if (holdRecorder.active && typeof holdInput === 'number') { cancelHold(); updateLiveControls(); $('live-status').textContent = 'Dokunma kesildi; bu aralık kaydedilmedi. Tekrar deneyin.'; }
});
$('hold-letter').addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (!event.repeat) beginHold(`key:${event.key}`);
});
$('hold-letter').addEventListener('keyup', event => {
  if (holdInput !== `key:${event.key}`) return;
  event.preventDefault(); finishHold();
});
$('hold-letter').addEventListener('blur', () => { if (holdInput !== 'space-step') { cancelHold(); updateLiveControls(); } });
function spaceStep() {
  if (!livePlayback || audio.paused || liveFinished) return;
  if (holdRecorder.active && holdInput !== 'space-step') return;
  const time = audio.currentTime;
  if (holdRecorder.active) {
    const previous = selectedId;
    finishHold(time);
    if (selectedId === previous || !livePlayback || liveFinished) return;
  }
  beginHold('space-step');
}
$('space-next').addEventListener('click', spaceStep);
dialog.addEventListener('keydown', event => {
  if (event.code !== 'Space' || !livePlayback) return;
  if (event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
  event.preventDefault();
  if (!event.repeat) spaceStep();
});
$('alignment-speed').addEventListener('change', () => {
  if (dialog.open) { audio.playbackRate = Number($('alignment-speed').value); audio.preservesPitch = true; }
});
$('end-verse').addEventListener('click', () => {
  const verse = letters.find(letter => letter.id === selectedId).verse;
  if (holdRecorder.active) {
    finishHold();
    if (!livePlayback && !liveFinished) return;
  }
  stop();
  const nextVerse = letters.find(letter => letter.verse > verse);
  if (nextVerse) {
    selectLetter(nextVerse.id);
    $('live-status').textContent = 'Sonraki ayet hazır. Eksik bırakılan gruplar tamamlanmış sayılmaz; sesi başlatıp ilk harfte boşluğa bas.';
  } else $('live-status').textContent = 'Son ayet bitti. Eksik grupları ve kayıt durumunu kontrol edin.';
});
window.addEventListener('blur', () => { if (livePlayback) stop(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && livePlayback) stop(); });
$('open-editor').addEventListener('click', () => {
  exitMemory();
  stop(); dialog.showModal(); selectLetter(selectedId); updateClock();
  $('phase').textContent = 'Hazırsan başlayalım!';
});
$('close-editor').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { stop(); audio.playbackRate = 1; updateAlignment(); });
$('editor-verse').addEventListener('change', () => selectLetter(letters.find(letter => letter.verse === Number($('editor-verse').value)).id));
$('editor-play').addEventListener('click', () => {
  if (!audio.paused) stop();
  else if (audioInfo) void playRange(audio.currentTime >= audioInfo.duration ? 0 : audio.currentTime, audioInfo.duration);
});
$('editor-back').addEventListener('click', () => { stop(); audio.currentTime = Math.max(0, audio.currentTime - 1); updateClock(); });
$('seek').addEventListener('click', () => {
  const time = $('seek-time').valueAsNumber;
  if (!audioInfo || !Number.isFinite(time) || time < 0 || time > audioInfo.duration) { showMessage('Ses süresi içinde bir konum girin.', true); return; }
  stop(); audio.currentTime = time; updateClock();
});
$('mark-start').addEventListener('click', () => { $('start-time').value = audio.currentTime.toFixed(3); $('reviewed').checked = false; wave.render(); });
$('mark-end').addEventListener('click', () => { $('end-time').value = audio.currentTime.toFixed(3); $('reviewed').checked = false; stop(); wave.render(); });
for (const id of ['start-time', 'end-time']) $(id).addEventListener('input', () => { $('reviewed').checked = false; wave.render(); });
function candidateTiming() {
  return { id: selectedId, start: $('start-time').valueAsNumber, end: $('end-time').valueAsNumber, reviewed: $('reviewed').checked, silent: false };
}
$('preview-letter').addEventListener('click', () => {
  try {
    if (!audioInfo) throw new Error('Ses bilgisi henüz hazır değil.');
    const timing = candidateTiming();
    validateTimingDocument(timingDocument([timing]), audioInfo);
    void playRange(timing.start, timing.end);
  } catch (error) { showMessage(error.message, true); }
});
$('save-letter').addEventListener('click', () => {
  try {
    if (!audioInfo) throw new Error('Ses bilgisi henüz hazır değil.');
    stop();
    const candidate = candidateTiming();
    const next = [...timings.filter(timing => timing.id !== selectedId), candidate];
    timings = validateTimingDocument(timingDocument(next), audioInfo);
    updateAlignment();
    void persistTimings();
    const nextLetter = nextSpokenLetter(selectedId);
    if (nextLetter) selectLetter(nextLetter.id); else renderPicker();
    showMessage(candidate.reviewed ? 'Harf doğrulandı. Sıradaki harfle devam edebilirsiniz.' : 'Eşleşme taslak olarak kaydediliyor; dinleyerek doğrulama henüz yapılmadı.');
  } catch (error) { showMessage(error.message, true); }
});
$('delete-letter').addEventListener('click', () => {
  stop(); timings = timings.filter(timing => timing.id !== selectedId);
  selectLetter(selectedId); updateAlignment(); void persistTimings(); showMessage('Bu harfin zamanı silindi.');
});
$('export').addEventListener('click', () => {
  if (!audioInfo) { showMessage('Ses bilgisi henüz hazır değil.', true); return; }
  const json = JSON.stringify(timingDocument(), null, 2);
  $('export-text').value = json;
  $('export-fallback').hidden = false;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'fatiha-zamanlama.json'; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showMessage('JSON indirme istendi. İndirme başlamazsa aşağıdaki JSON metnini kopyalayarak saklayın.');
});
$('import').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (!audioInfo) throw new Error('Ses bilgisi henüz hazır değil.');
    if (file.size > 1024 * 1024) throw new Error('Zamanlama dosyası 1 MB’den küçük olmalı.');
    const parsed = JSON.parse(await file.text());
    const validated = validateTimingDocument(parsed, audioInfo);
    stop(); timings = validated; updateAlignment(); selectLetter(selectedId);
    void persistTimings();
    showMessage('Zamanlar içe aktarıldı. Sure dosyasına kaydediliyor; doğrulanmamış harfleri kontrol edin.');
  } catch (error) { showMessage(`İçe aktarma yapılamadı: ${error.message}`, true); }
  finally { event.target.value = ''; }
});

async function initializeAudio() {
  try {
    const configResponse = await fetch('./site-config.json');
    if (!configResponse.ok) throw new Error('Yayın yapılandırması okunamadı.');
    const config = await configResponse.json();
    if (!['api', 'static'].includes(config.timingStorage)) throw new Error('Yayın yapılandırması geçerli değil.');
    const metadata = new Promise((resolve, reject) => {
      if (audio.readyState >= 1) return resolve();
      audio.addEventListener('loadedmetadata', resolve, { once: true });
      audio.addEventListener('error', () => reject(new Error('Ses kaydı okunamadı.')), { once: true });
    });
    const [response] = await Promise.all([fetch('./001.mp3'), metadata]);
    if (!response.ok) throw new Error('Ses dosyası bulunamadı.');
    const buffer = await response.arrayBuffer();
    let sha256;
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    } else sha256 = response.headers.get('X-Audio-SHA256');
    if (!/^[a-f0-9]{64}$/.test(sha256 || '')) throw new Error('Ses kimliği doğrulanamadı. Yerel Node sunucusunu veya HTTPS kullanın.');
    await metadata;
    if (config.timingStorage === 'static') {
      // Blob playback supports seeking even when a static host ignores HTTP byte ranges.
      const loaded = new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', resolve, { once: true });
        audio.addEventListener('error', () => reject(new Error('Ses kaydı okunamadı.')), { once: true });
      });
      audioObjectUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
      audio.src = audioObjectUrl;
      audio.load();
      await loaded;
    }
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) throw new Error('Ses süresi okunamadı.');
    audioInfo = { sha256, duration: audio.duration };
    for (const id of ['seek-time', 'start-time', 'end-time']) $(id).max = audio.duration;
    void wave.decode(buffer).catch(() => { showMessage('Ses dalgası çizilemedi; dinleyip işaretleme düğmeleriyle eşleştirebilirsiniz.', true); });
    try {
      const savedResponse = await fetch(config.timingStorage === 'static' ? './timings.json' : './api/timings');
      if (!savedResponse.ok) throw new Error('Kayıt dosyası okunamadı.');
      const saved = await savedResponse.json();
      timings = validateTimingDocument(saved, audioInfo);
      timingApiAvailable = config.timingStorage === 'api';
      $('save-state').textContent = timings.length ? 'Bu sure için kaydedilmiş eşleşmeler yüklendi.' : 'Henüz eşleşme kaydedilmedi. İşaretleyip kaydettiğiniz harfler sure dosyasına yazılacak.';
    } catch (error) {
      $('save-state').textContent = `${error.message} Yerel sunucuyu kontrol edin; JSON ile yedekleme kullanılabilir.`;
      $('save-state').classList.add('error');
    }
    try {
      const previewResponse = await fetch('./word-preview.json');
      if (!previewResponse.ok) throw new Error('Kelime önizlemesi bulunamadı.');
      previewWords = validateWordPreview(await previewResponse.json(), audioInfo);
      if (!previewWords.length) throw new Error('Kelime önizlemesi boş.');
      const silenceResponse = await fetch('./preview-silence.json');
      if (!silenceResponse.ok) throw new Error('Sessizlik verisi yüklenemedi.');
      previewSilences = validatePreviewSilences(await silenceResponse.json(), audioInfo);
      const finalResponse = await fetch('./final-preview.json');
      if (!finalResponse.ok) throw new Error('Son kelime önizlemesi yüklenemedi.');
      previewWords = applyPreviewOverrides(previewWords, await finalResponse.json(), audioInfo);
      $('word-preview').disabled = false;
    } catch (error) {
      previewWords = [];
      previewSilences = [];
      $('word-preview').checked = false;
      $('phase').textContent = `${error.message} Doğrulanmış harf eşleşmeleri kullanılacak.`;
    }
    selectLetter(selectedId);
    updateAlignment(); updateClock();
  } catch (error) { $('phase').textContent = error.message; showMessage(error.message, true); }
}
window.addEventListener('pagehide', event => {
  if (!event.persisted && audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
});
window.addEventListener('resize', () => {
  if (previewTime !== null) lessonMarker(previewTime);
  else if (highlighted) highlight(highlighted);
});
selectLetter(selectedId);
updateAlignment();
void initializeAudio();
