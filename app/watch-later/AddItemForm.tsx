"use client";

import { useState } from "react";
import type { WatchLaterCategory } from "@/lib/types";
import { categoryMeta } from "./meta";

export function AddItemForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (input: { url: string; title: string; description?: string; category?: WatchLaterCategory }) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WatchLaterCategory>("other");

  const valid = Boolean(url.trim() && title.trim());

  const handleSubmit = () => {
    if (!valid) return;
    onSubmit({ url: url.trim(), title: title.trim(), description: description.trim() || undefined, category });
  };

  return (
    <form
      className="ui-card mb-6 max-w-2xl space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h2 className="font-display text-[length:var(--t-lead)] font-semibold text-[var(--text-1)]">
        Nouveau lien
      </h2>

      <div className="ui-field">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          aria-label="Adresse du lien"
          autoFocus
          className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none"
        />
      </div>

      <div className="ui-field">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre"
          aria-label="Titre"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>

      <div className="rounded-[var(--r-sm)] bg-[var(--surface-2)] p-3 focus-within:ring-1 focus-within:ring-[var(--accent)]">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optionnel)"
          aria-label="Description"
          rows={2}
          className="w-full resize-none bg-transparent text-base leading-relaxed text-[var(--text-1)] outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(categoryMeta) as WatchLaterCategory[]).map((c) => {
          const Icon = categoryMeta[c].icon;
          return (
            <button
              key={c}
              type="button"
              className="ui-chip gap-1.5"
              data-active={category === c}
              onClick={() => setCategory(c)}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {categoryMeta[c].label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="ui-btn ui-btn--text" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!valid}>
          Ajouter
        </button>
      </div>
    </form>
  );
}
