import { Camera, Columns2, Flag, Grid3x3, Info, Pause, Play, Repeat, SkipBack, SkipForward, Square, SwitchCamera, Trash2, Video } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteVideo, listVideos, saveVideo, type VideoClip } from '../../data/db';
import { useApp } from '../../data/store';
import { newId } from '../../domain/session';
import { Button, Card, Chip, cx, EmptyState, inputClass, PageHeader, SectionTitle, Segmented } from '../components/ui';

/**
 * Video-Analyse: aufnehmen, in Zeitlupe und Einzelbildern ansehen, Hilfslinien
 * einblenden und zwei Würfe synchron vergleichen. Bewusst OHNE automatische
 * Gelenkwinkel-Messung – siehe Hinweis in der Oberfläche.
 */

const FRAME = 1 / 30;

function pickMime(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  for (const c of candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  return '';
}

export function VideoAnalysis() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'library' | 'record' | 'compare'>('library');
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const showToast = useApp((s) => s.showToast);

  const refresh = useCallback(async () => {
    try {
      setClips(await listVideos());
    } catch {
      showToast('Videos konnten nicht geladen werden', 'bad');
    }
    setLoaded(true);
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  const clip = clips.find((c) => c.id === selected) ?? null;

  return (
    <div className="pb-8">
      <PageHeader title="Video-Analyse" subtitle="Wurf filmen, verlangsamen, vergleichen" backTo="/technique" />
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setSelected(null);
        }}
        ariaLabel="Modus"
        options={[
          { value: 'library', label: 'Aufnahmen' },
          { value: 'record', label: 'Aufnehmen' },
          { value: 'compare', label: 'Vergleich' },
        ]}
      />

      {mode === 'record' &&
        (supported ? (
          <Recorder
            onSaved={async () => {
              await refresh();
              setMode('library');
              showToast('Video gespeichert', 'good');
            }}
          />
        ) : (
          <EmptyState icon={<Camera />} title="Kamera nicht verfügbar" text="Dein Browser unterstützt keine Videoaufnahme oder der Zugriff ist blockiert. Tipp: Die App muss über HTTPS laufen." />
        ))}

      {mode === 'library' && (
        <div className="mt-4">
          {clip ? (
            <Player
              clip={clip}
              onBack={() => setSelected(null)}
              onChange={async (c) => {
                await saveVideo(c);
                refresh();
              }}
              onDelete={async () => {
                await deleteVideo(clip.id);
                setSelected(null);
                refresh();
              }}
            />
          ) : !loaded ? null : clips.length === 0 ? (
            <EmptyState icon={<Video />} title="Noch keine Aufnahmen" text="Stelle dein Handy seitlich auf (Schulterhöhe, 2–3 m Abstand) und filme ein paar Würfe." action={<Button onClick={() => setMode('record')}>Erste Aufnahme</Button>} />
          ) : (
            <ClipList clips={clips} onOpen={setSelected} />
          )}
        </div>
      )}

      {mode === 'compare' && (
        <div className="mt-4">
          {compare.length === 2 ? (
            <Compare a={clips.find((c) => c.id === compare[0])!} b={clips.find((c) => c.id === compare[1])!} onReset={() => setCompare([])} />
          ) : clips.length < 2 ? (
            <EmptyState icon={<Columns2 />} title="Mindestens zwei Aufnahmen nötig" text="Nimm zwei Würfe auf – z. B. heute und in zwei Wochen – und vergleiche sie nebeneinander." />
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-2">Wähle zwei Aufnahmen. Tipp: Markiere vorher in jeder Aufnahme den Abwurf-Moment – dann laufen beide synchron.</p>
              <div className="grid gap-2">
                {clips.map((c) => {
                  const on = compare.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCompare((x) => (on ? x.filter((y) => y !== c.id) : [...x, c.id].slice(-2)))}
                      className={cx('flex items-center justify-between rounded-2xl border p-4 text-left', on ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface-1')}
                    >
                      <span>
                        <span className="block font-semibold">{c.label}</span>
                        <span className="block text-xs text-ink-3">{new Date(c.createdAt).toLocaleString('de-DE')}</span>
                      </span>
                      {c.syncPoint !== undefined ? <Chip tone="accent">Abwurf markiert</Chip> : <Chip>ohne Markierung</Chip>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <SectionTitle>Was die Video-Analyse kann – und was nicht</SectionTitle>
      <Card className="p-5 text-sm leading-relaxed text-ink-2">
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-info" />
          <div className="space-y-2">
            <p>
              Die App misst <strong className="text-ink-1">keine</strong> Gelenkwinkel und stellt keine automatischen Technik-Diagnosen. Browser-Posen-Erkennung (z. B. MediaPipe) liefert aus einem einzelnen Handyvideo mit 30 Bildern pro Sekunde nur grobe 2D-Schätzungen – für Finger, Handgelenk und den exakten Abwurf-Moment ist das zu ungenau, um daraus verlässliche Aussagen abzuleiten.
            </p>
            <p>Stattdessen hilft dir die App beim Selbstcheck: Zeitlupe, Einzelbilder, Hilfslinien (z. B. „bleibt der Ellbogen auf einer Höhe?“) und der synchrone Vergleich zweier Würfe.</p>
            <p className="text-ink-3">Kamera-Tipps: seitlich auf Schulterhöhe, ganzer Arm und Kopf im Bild, gutes Licht, Handy fest abstellen.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ClipList({ clips, onOpen }: { clips: VideoClip[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid gap-2">
      {clips.map((c) => (
        <Card key={c.id} as="button" onClick={() => onOpen(c.id)} className="flex items-center gap-3 p-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-3 text-ink-2">
            <Play size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{c.label}</div>
            <div className="text-xs text-ink-3">
              {new Date(c.createdAt).toLocaleString('de-DE')} · {c.durationS.toFixed(1).replace('.', ',')} s
            </div>
            {c.note && <div className="truncate text-xs text-ink-2">{c.note}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Recorder({ onSaved }: { onSaved: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [state, setState] = useState<'idle' | 'countdown' | 'recording' | 'saving'>('idle');
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(8);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, frameRate: { ideal: 60 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
        setError(null);
      } catch {
        setError('Kein Kamerazugriff. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const begin = () => {
    if (!streamRef.current) return;
    setState('countdown');
    setCount(3);
    let c = 3;
    const id = setInterval(() => {
      c -= 1;
      setCount(c);
      if (c <= 0) {
        clearInterval(id);
        record();
      }
    }, 1000);
  };

  const record = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      setState('saving');
      const blob = new Blob(chunks.current, { type: rec.mimeType || mime || 'video/webm' });
      const dur = (performance.now() - startedAt.current) / 1000;
      await saveVideo({ id: newId(), createdAt: Date.now(), label: label.trim() || `Wurf ${new Date().toLocaleDateString('de-DE')}`, durationS: dur, mimeType: blob.type, blob });
      setState('idle');
      onSaved();
    };
    recRef.current = rec;
    rec.start(250);
    startedAt.current = performance.now();
    setState('recording');
    setTimeout(() => rec.state === 'recording' && rec.stop(), seconds * 1000);
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-black">
        <video ref={videoRef} playsInline muted className={cx('aspect-[3/4] w-full object-cover', facing === 'user' && '-scale-x-100')} />
        {state === 'countdown' && <div className="num absolute inset-0 grid place-items-center bg-black/40 text-8xl">{count}</div>}
        {state === 'recording' && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" /> Aufnahme
          </div>
        )}
        <GuideOverlay />
      </div>
      {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <input className={inputClass} placeholder="Bezeichnung (z. B. „Follow-through Woche 2“)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-3">Länge:</span>
        {[5, 8, 12].map((s) => (
          <button key={s} onClick={() => setSeconds(s)} className={cx('h-9 rounded-xl px-3 text-sm font-semibold', seconds === s ? 'bg-surface-3 text-ink-1' : 'text-ink-3')}>
            {s} s
          </button>
        ))}
        <button onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="ml-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2" aria-label="Kamera wechseln">
          <SwitchCamera size={18} />
        </button>
      </div>
      {state === 'recording' ? (
        <Button size="lg" variant="danger" block onClick={() => recRef.current?.stop()}>
          <Square size={18} /> Stopp
        </Button>
      ) : (
        <Button size="lg" block onClick={begin} disabled={state !== 'idle' || Boolean(error)}>
          <Camera size={18} /> {state === 'saving' ? 'Speichere …' : 'Aufnahme starten (3 s Countdown)'}
        </Button>
      )}
    </div>
  );
}

function GuideOverlay() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {[33.3, 66.6].map((v) => (
        <g key={v} stroke="rgb(255 255 255 / 0.25)" strokeWidth={0.3}>
          <line x1={v} x2={v} y1={0} y2={100} />
          <line y1={v} y2={v} x1={0} x2={100} />
        </g>
      ))}
    </svg>
  );
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

function Player({ clip, onBack, onChange, onDelete }: { clip: VideoClip; onBack: () => void; onChange: (c: VideoClip) => void; onDelete: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const url = useObjectUrl(clip.blob);
  const [rate, setRate] = useState(0.25);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [grid, setGrid] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(clip.durationS);
  const [note, setNote] = useState(clip.note ?? '');

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate, url]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.playbackRate = rate;
      v.play();
    } else v.pause();
  };
  const step = (d: number) => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || duration, v.currentTime + d));
  };
  const onSurfaceClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
    if (!draft) setDraft(p);
    else {
      setLines((l) => [...l, { x1: draft.x, y1: draft.y, x2: p.x, y2: p.y }]);
      setDraft(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-semibold text-ink-3">
          ← Alle Aufnahmen
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 text-sm font-semibold text-bad">
          <Trash2 size={14} /> Löschen
        </button>
      </div>
      <div className="font-semibold">{clip.label}</div>
      <div className="relative overflow-hidden rounded-3xl border border-line bg-black">
        <video
          ref={ref}
          src={url}
          playsInline
          muted
          loop={loop}
          className="w-full"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        />
        {grid && <GuideOverlay />}
        <svg className="absolute inset-0 h-full w-full cursor-crosshair" viewBox="0 0 100 100" preserveAspectRatio="none" onClick={onSurfaceClick} aria-label="Hilfslinie zeichnen: zweimal tippen">
          {lines.map((l, i) => (
            <line key={i} {...l} stroke="var(--color-flare)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
          ))}
          {draft && <circle cx={draft.x} cy={draft.y} r={1} fill="var(--color-flare)" />}
        </svg>
      </div>
      <input type="range" min={0} max={duration || 1} step={FRAME} value={time} onChange={(e) => ref.current && (ref.current.currentTime = Number(e.target.value))} className="w-full accent-[var(--color-accent)]" aria-label="Position" />
      <div className="flex items-center justify-between text-xs tabular text-ink-3">
        <span>{time.toFixed(2)} s</span>
        {clip.syncPoint !== undefined && <span className="text-accent">Abwurf bei {clip.syncPoint.toFixed(2)} s</span>}
        <span>{duration.toFixed(2)} s</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <button aria-label="Ein Bild zurück" onClick={() => step(-FRAME)} className="grid h-12 place-items-center rounded-xl bg-surface-3">
          <SkipBack size={18} />
        </button>
        <button aria-label={playing ? 'Pause' : 'Abspielen'} onClick={toggle} className="col-span-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-[#05170d]">
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? 'Pause' : 'Abspielen'}
        </button>
        <button aria-label="Ein Bild vor" onClick={() => step(FRAME)} className="grid h-12 place-items-center rounded-xl bg-surface-3">
          <SkipForward size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[0.1, 0.25, 0.5, 1].map((r) => (
          <button key={r} onClick={() => setRate(r)} className={cx('h-9 rounded-xl px-3 text-sm font-semibold', rate === r ? 'bg-surface-3 text-ink-1' : 'text-ink-3')}>
            {String(r).replace('.', ',')}×
          </button>
        ))}
        <button onClick={() => setLoop((v) => !v)} aria-pressed={loop} className={cx('ml-auto grid h-9 w-9 place-items-center rounded-xl', loop ? 'bg-surface-3 text-ink-1' : 'text-ink-3')} aria-label="Schleife">
          <Repeat size={16} />
        </button>
        <button onClick={() => setGrid((v) => !v)} aria-pressed={grid} className={cx('grid h-9 w-9 place-items-center rounded-xl', grid ? 'bg-surface-3 text-ink-1' : 'text-ink-3')} aria-label="Raster">
          <Grid3x3 size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onChange({ ...clip, syncPoint: ref.current?.currentTime ?? time, note })}>
          <Flag size={16} /> Abwurf hier markieren
        </Button>
        <Button variant="ghost" onClick={() => setLines([])} disabled={!lines.length && !draft}>
          Linien löschen
        </Button>
      </div>
      <p className="text-xs text-ink-3">Hilfslinie: zweimal ins Video tippen (Start- und Endpunkt) – z. B. entlang des Unterarms, um ihn mit anderen Würfen zu vergleichen.</p>
      <textarea className={cx(inputClass, 'h-auto py-3')} rows={2} placeholder="Notiz zu diesem Wurf" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (clip.note ?? '') && onChange({ ...clip, note })} />
    </div>
  );
}

function Compare({ a, b, onReset }: { a: VideoClip; b: VideoClip; onReset: () => void }) {
  const ra = useRef<HTMLVideoElement>(null);
  const rb = useRef<HTMLVideoElement>(null);
  const ua = useObjectUrl(a.blob);
  const ub = useObjectUrl(b.blob);
  const [rate, setRate] = useState(0.25);
  const [offset, setOffset] = useState(-0.8);
  const syncA = a.syncPoint ?? 0;
  const syncB = b.syncPoint ?? 0;

  const seek = (o: number) => {
    setOffset(o);
    for (const [v, s] of [
      [ra.current, syncA],
      [rb.current, syncB],
    ] as const) {
      if (!v) continue;
      v.pause();
      v.currentTime = Math.max(0, s + o);
    }
  };
  const play = () => {
    for (const [v, s] of [
      [ra.current, syncA],
      [rb.current, syncB],
    ] as const) {
      if (!v) continue;
      v.currentTime = Math.max(0, s + offset);
      v.playbackRate = rate;
      v.play();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onReset} className="self-start text-sm font-semibold text-ink-3">
        ← Andere Aufnahmen wählen
      </button>
      <div className="grid grid-cols-2 gap-2">
        {[
          [a, ua, ra],
          [b, ub, rb],
        ].map(([c, u, r]) => (
          <div key={(c as VideoClip).id}>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
              <video ref={r as React.RefObject<HTMLVideoElement>} src={u as string} playsInline muted className="w-full" />
              <GuideOverlay />
            </div>
            <div className="mt-1 truncate text-xs text-ink-2">{(c as VideoClip).label}</div>
          </div>
        ))}
      </div>
      {(a.syncPoint === undefined || b.syncPoint === undefined) && <p className="rounded-xl bg-flare-soft px-3 py-2 text-xs text-flare">Mindestens eine Aufnahme hat keine Abwurf-Markierung – die Videos starten dann am Anfang statt synchron.</p>}
      <label className="text-sm text-ink-2">
        Zeit relativ zum Abwurf: <span className="tabular font-semibold text-ink-1">{offset >= 0 ? '+' : ''}{offset.toFixed(2)} s</span>
        <input type="range" min={-2} max={1.5} step={FRAME} value={offset} onChange={(e) => seek(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-accent)]" />
      </label>
      <div className="flex items-center gap-2">
        {[0.1, 0.25, 0.5, 1].map((r) => (
          <button key={r} onClick={() => setRate(r)} className={cx('h-9 rounded-xl px-3 text-sm font-semibold', rate === r ? 'bg-surface-3 text-ink-1' : 'text-ink-3')}>
            {String(r).replace('.', ',')}×
          </button>
        ))}
        <Button className="ml-auto" onClick={play}>
          <Play size={16} /> Synchron abspielen
        </Button>
      </div>
    </div>
  );
}
