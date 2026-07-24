import { useRef, useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, Loader2, X, FileText, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AudioRecorder } from './AudioRecorder';
import { QuickRepliesPopover } from './QuickRepliesPopover';
import { useQuickReplies } from '@/hooks/useQuickReplies';

interface ChatInputProps {
  conversationId: string;
  restaurantId: string;
  disabled?: boolean;
  disabledReason?: string;
}

function extFromMime(m: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'audio/webm': 'webm', 'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg', 'video/mp4': 'mp4', 'application/pdf': 'pdf',
  };
  return map[m] || (m.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
}

function pickKind(mime: string): 'image' | 'video' | 'audio' | 'document' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export function ChatInput({ conversationId, restaurantId, disabled, disabledReason }: ChatInputProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPresence = useRef(0);
  const { data: quickReplies = [] } = useQuickReplies();

  function maybeExpandShortcut(value: string): string {
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) return value;
    const hit = quickReplies.find((r) => r.shortcut.toLowerCase() === trimmed.toLowerCase());
    return hit ? hit.content : value;
  }

  async function sendText() {
    const value = maybeExpandShortcut(text).trim();
    if (!value || sending) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('evolution-send', {
      body: { action: 'send_text', conversation_id: conversationId, text: value },
    });
    setSending(false);
    if (error || data?.error) {
      toast({ title: 'Erro ao enviar', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    setText('');
  }

  async function uploadAndSend(file: Blob, filename: string, mime: string, kind: ReturnType<typeof pickKind>, captionText?: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${restaurantId}/${conversationId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from('wa-media').upload(path, file, {
      contentType: mime, upsert: false,
    });
    if (upErr) {
      toast({ title: 'Falha no upload', description: upErr.message, variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.functions.invoke('evolution-send', {
      body: {
        action: 'send_media',
        conversation_id: conversationId,
        media_path: path, mime, filename: safeName, kind,
        caption: captionText,
      },
    });
    if (error || data?.error) {
      toast({ title: 'Erro ao enviar', description: data?.error || error?.message, variant: 'destructive' });
    }
  }

  async function sendPendingFile() {
    if (!pendingFile) return;
    setSending(true);
    const kind = pickKind(pendingFile.type);
    await uploadAndSend(pendingFile, pendingFile.name, pendingFile.type || 'application/octet-stream', kind, caption.trim() || undefined);
    setSending(false);
    setPendingFile(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function sendAudio(blob: Blob) {
    setSending(true);
    const mime = blob.type || 'audio/webm';
    const filename = `audio-${Date.now()}.${extFromMime(mime)}`;
    await uploadAndSend(blob, filename, mime, 'audio');
    setSending(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  function notifyPresence() {
    const now = Date.now();
    if (now - lastPresence.current < 4000) return;
    lastPresence.current = now;
    supabase.functions.invoke('evolution-send', {
      body: { action: 'set_presence', conversation_id: conversationId, presence: 'composing' },
    }).catch(() => {});
  }

  if (disabled) {
    return (
      <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
        {disabledReason || 'Envio indisponível.'}
      </div>
    );
  }

  if (pendingFile) {
    const kind = pickKind(pendingFile.type);
    const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? VideoIcon : FileText;
    const isImage = kind === 'image';
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
          {isImage ? (
            <img src={URL.createObjectURL(pendingFile)} alt="" className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="h-14 w-14 rounded bg-background flex items-center justify-center">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{pendingFile.name}</p>
            <p className="text-xs text-muted-foreground">{(pendingFile.size / 1024).toFixed(0)} KB</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => { setPendingFile(null); setCaption(''); }} disabled={sending}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {kind !== 'audio' && (
            <Input
              placeholder="Legenda (opcional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={sending}
              maxLength={1024}
            />
          )}
          <Button onClick={sendPendingFile} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 100 * 1024 * 1024) {
            toast({ title: 'Arquivo muito grande', description: 'Máximo 100 MB', variant: 'destructive' });
            return;
          }
          setPendingFile(f);
        }}
      />
      <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={sending}>
        <Paperclip className="h-5 w-5" />
      </Button>
      <QuickRepliesPopover disabled={sending} onSelect={(content) => setText(content)} />
      <Input
        value={text}
        onChange={(e) => { setText(e.target.value); notifyPresence(); }}
        onKeyDown={onKey}
        placeholder="Digite uma mensagem ou /atalho..."
        disabled={sending}
        maxLength={4096}
      />
      {text.trim() ? (
        <Button size="icon" onClick={sendText} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      ) : (
        <AudioRecorder onSend={sendAudio} sending={sending} />
      )}
    </div>
  );
}