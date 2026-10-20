import { useState } from 'react';
import { Button, Field, Modal } from './ui';
import { download } from '../lib/backup';
import type { ImportPromptKind } from '../lib/import-prompts';

export function ImportPrompt({
  kind,
  label = 'Get prompt',
}: {
  kind: ImportPromptKind;
  label?: string;
}) {
  const [prompt, setPrompt] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          setCopied(false);
          try {
            const { getImportPrompt } = await import('../lib/import-prompts');
            setPrompt(await getImportPrompt(kind));
          } catch {
            setError('Could not prepare the prompt. Try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Preparing prompt…' : label}
      </Button>
      {error && !prompt && <p role="alert">{error}</p>}
      {prompt && (
        <Modal title="Get import prompt" onClose={() => setPrompt(undefined)} wide>
          <p>
            Copy this into your preferred AI tool, then add the notes or information you want to
            convert. It explains FORM’s JSON fields and supported version. Your records are not
            included in this prompt or sent anywhere by FORM.
          </p>
          <Field label="Import prompt">
            <textarea rows={14} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <p className="small-text muted">
            Review generated JSON before importing. If copying is unavailable, select the text above
            or download it.
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => download(prompt, 'form-' + kind + '-prompt.txt', 'text/plain')}
            >
              Download prompt
            </Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt);
                  setCopied(true);
                } catch {
                  setError('Copy unavailable. Select the text or download the prompt.');
                }
              }}
            >
              Copy prompt
            </Button>
          </div>
          {copied && <p role="status">Prompt copied</p>}
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </>
  );
}
