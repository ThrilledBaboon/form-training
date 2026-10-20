import { useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { type WorkspacePage, PageSchema } from '../lib/workspace-model';
import { moveEntry } from '../lib/workspace';
import { useApp } from '../lib/context';
import { Modal, Field, Button } from './ui';
export function PageDesign({
  page,
  onSave,
  onClose,
}: {
  page: WorkspacePage;
  onSave: (p: WorkspacePage) => Promise<unknown>;
  onClose: () => void;
}) {
  const { run } = useApp();
  const [draft, set] = useState(() => structuredClone(page));
  return (
    <Modal title="Customise page" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await onSave(PageSchema.parse(draft));
            onClose();
          });
        }}
      >
        <Field label="Page spacing">
          <select
            value={draft.density ?? ''}
            onChange={(e) =>
              set({ ...draft, density: (e.target.value || undefined) as WorkspacePage['density'] })
            }
          >
            <option value="">Use my interface setting</option>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="minimal">Minimal</option>
          </select>
        </Field>
        <Field label="Show page sections as">
          <select
            value={draft.sectionMode ?? 'sections'}
            onChange={(e) =>
              set({ ...draft, sectionMode: e.target.value as WorkspacePage['sectionMode'] })
            }
          >
            <option value="sections">Collapsible sections</option>
            <option value="tabs">Tabs</option>
          </select>
        </Field>
        <p>
          Assign widgets to these sections in Configure widget. Widgets without a section stay at
          the beginning.
        </p>
        {(draft.sections ?? []).map((s, index) => (
          <div className="page-section-editor" key={s.id}>
            <Field label={'Section ' + (index + 1) + ' title'}>
              <input
                required
                maxLength={100}
                value={s.title}
                onChange={(e) =>
                  set({
                    ...draft,
                    sections: draft.sections!.map((r) =>
                      r.id === s.id ? { ...r, title: e.target.value } : r,
                    ),
                  })
                }
              />
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={s.collapsed}
                onChange={(e) =>
                  set({
                    ...draft,
                    sections: draft.sections!.map((r) =>
                      r.id === s.id ? { ...r, collapsed: e.target.checked } : r,
                    ),
                  })
                }
              />
              Start collapsed
            </label>
            <div className="inline-actions">
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move section ' + (index + 1) + ' up'}
                disabled={index === 0}
                onClick={() =>
                  set({ ...draft, sections: moveEntry(draft.sections!, index, index - 1) })
                }
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label={'Move section ' + (index + 1) + ' down'}
                disabled={index === draft.sections!.length - 1}
                onClick={() =>
                  set({ ...draft, sections: moveEntry(draft.sections!, index, index + 1) })
                }
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  set({
                    ...draft,
                    sections: draft.sections!.filter((r) => r.id !== s.id),
                    widgets: draft.widgets.map((w) =>
                      w.sectionId === s.id ? { ...w, sectionId: undefined } : w,
                    ),
                  })
                }
              >
                Remove section {index + 1}
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={(draft.sections?.length ?? 0) >= 12}
          onClick={() =>
            set({
              ...draft,
              sections: [
                ...(draft.sections ?? []),
                { id: crypto.randomUUID(), title: 'New section', collapsed: false },
              ],
            })
          }
        >
          Add section
        </Button>
        <div className="modal-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save page design</Button>
        </div>
      </form>
    </Modal>
  );
}
