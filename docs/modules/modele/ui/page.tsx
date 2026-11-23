"use client";

import { EmptyState, PageHeader, useModuleAction } from "@backstage/module-kit";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { notesSchema, type Note } from "../schema";

/**
 * Page du module, rendue par le noyau sur `/m/demo-notes`. Elle ne connait ni
 * session ni route : les actions passent par `useModuleAction`.
 */
export default function NotesPage() {
  const call = useModuleAction();
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const loaded = notesSchema.parse(await call("list", {}));
    setNotes(loaded);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await call("create", { text });
      setText("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="Notes de demo"
        description="Un exemple complet : store JSON, outil verifie, action et page."
      />

      <form onSubmit={submit} className="ui-row">
        <input
          className="ui-field"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ecrire une note"
        />
        <button className="ui-btn" type="submit" disabled={busy}>
          Ajouter
        </button>
      </form>

      {notes.length === 0 ? (
        <EmptyState title="Aucune note" description="La premiere note apparaitra ici." />
      ) : (
        <ul className="ui-stack">
          {notes.map((note) => (
            <li key={note.id} className="ui-card">
              <p>{note.text}</p>
              <time className="ui-mono">{note.createdAt}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
