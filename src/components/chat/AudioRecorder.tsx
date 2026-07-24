import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';

interface AudioRecorderProps {
  onSend: (blob: Blob) => Promise<void> | void;
  sending?: boolean;
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export function AudioRecorder({ onSend, sending }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      console.error('mic error', e);
    }
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function discard() {
    setBlob(null);
    setElapsed(0);
  }

  async function send() {
    if (!blob) return;
    await onSend(blob);
    setBlob(null);
    setElapsed(0);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
  }, []);

  if (blob) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1 w-full">
        <audio src={URL.createObjectURL(blob)} controls className="h-8 flex-1" />
        <Button size="icon" variant="ghost" onClick={discard} disabled={sending}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
        <Button size="icon" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1 w-full">
        <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
        <span className="font-mono text-sm tabular-nums flex-1">{fmt(elapsed)}</span>
        <Button size="icon" variant="ghost" onClick={stop}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" size="icon" variant="ghost" onClick={start}>
      <Mic className="h-5 w-5" />
    </Button>
  );
}