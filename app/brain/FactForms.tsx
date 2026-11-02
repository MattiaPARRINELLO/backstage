"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { MemoryCategory, MemoryFact } from "@/lib/types";
import { categoryMeta } from "./memory-utils";

function CategoryPicker({
  selected,
  onSelect,
}: {
  selected: MemoryCategory;
  onSelect: (c: MemoryCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(categoryMeta) as MemoryCategory[]).map((c) => (
        <button
          key={c}
          type="button"
          className="ui-chip"
          data-active={selected === c}
          onClick={() => onSelect(c)}
        >
          {categoryMeta[c].label}
        </button>
      ))}
    </div>
  );
}

const areaClass =
  "w-full resize-none rounded-[var(--r-sm)] bg-[var(--surface-2)] p-3 text-[length:var(--t-body)] leading-relaxed text-[var(--text-1)] outline-none focus:ring-1 focus:ring-[var(--accent)]";

export function EditFactForm({
  fact,
  onSave,
  onCancel,
}: {
  fact: MemoryFact;
  onSave: (id: string, content: string, category: MemoryCategory) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(fact.content);
  const [category, setCategory] = useState<MemoryCategory>(fact.category);

  return (
    <div className="border-b border-[var(--line)] py-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        className={areaClass}
        aria-label="Contenu du fait"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <CategoryPicker selected={category} onSelect={setCategory} />
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" className="ui-btn ui-btn--text" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => onSave(fact.id, content, category)}
            disabled={!content.trim()}
          >
            Sauver
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddFactForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (content: string, category: MemoryCategory) => void;
}) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("life");

  const submit = () => {
    if (!content.trim()) return;
    onSubmit(content, category);
  };

  return (
    <form
      className="mb-8 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="ui-field">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nouveau fait à mémoriser"
          aria-label="Nouveau fait à mémoriser"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-[length:var(--t-body)] outline-none"
        />
        <button
          type="submit"
          disabled={!content.trim()}
          className="ui-btn ui-btn--primary ui-btn--sm ui-btn--icon shrink-0"
          aria-label="Mémoriser"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CategoryPicker selected={category} onSelect={setCategory} />
        <button type="button" className="ui-btn ui-btn--text" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
