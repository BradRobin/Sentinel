"use client";

import type { ReactNode } from "react";

import {
  formatDetailScalar,
  formatDetailListItem,
  labelDetailKey,
  partitionFindingDetail,
} from "@/lib/findings";

interface FindingDetailViewProps {
  detail: Record<string, unknown>;
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-icta-gray-600">
        {label}
      </h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ScalarRows({
  entries,
}: {
  entries: { key: string; value: unknown }[];
}) {
  if (entries.length === 0) return null;
  return (
    <dl className="space-y-1.5">
      {entries.map(({ key, value }) => (
        <div key={key} className="flex gap-3 text-sm">
          <dt className="w-[42%] shrink-0 text-icta-gray-600">
            {labelDetailKey(key)}
          </dt>
          <dd className="min-w-0 break-words font-medium text-icta-black">
            {formatDetailScalar(key, value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StringList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-icta-gray-600">None</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-icta-black">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="break-words">
          {item}
        </li>
      ))}
    </ul>
  );
}

function NestedObject({
  value,
}: {
  value: Record<string, unknown>;
}) {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="text-sm text-icta-gray-600">None</p>;
  }

  const allBoolean = entries.every(([, v]) => typeof v === "boolean");
  if (allBoolean) {
    return (
      <ul className="space-y-1 text-sm">
        {entries.map(([k, v]) => (
          <li key={k} className="flex gap-2">
            <span
              className={
                v
                  ? "font-medium text-icta-green"
                  : "font-medium text-icta-red"
              }
            >
              {v ? "Present" : "Missing"}
            </span>
            <span className="break-words text-icta-black">{labelDetailKey(k)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ScalarRows
      entries={entries.map(([key, val]) => ({ key, value: val }))}
    />
  );
}

export function FindingDetailView({ detail }: FindingDetailViewProps) {
  const partitioned = partitionFindingDetail(detail);
  const hasFormatted =
    partitioned.messages.length > 0 ||
    partitioned.lists.length > 0 ||
    partitioned.objects.length > 0 ||
    partitioned.scalars.length > 0;

  return (
    <div className="mt-2">
      {!hasFormatted ? (
        <p className="text-sm text-icta-gray-600">No additional details.</p>
      ) : (
        <div className="rounded-md border border-icta-gray-100 bg-icta-gray-50/60 px-3 py-2.5">
          {partitioned.messages.map(({ key, value }) => (
            <DetailSection key={key} label={labelDetailKey(key)}>
              <p className="text-sm leading-relaxed text-icta-black">{value}</p>
            </DetailSection>
          ))}

          {partitioned.lists.map(({ key, items }) => (
            <DetailSection key={key} label={labelDetailKey(key)}>
              <StringList
                items={items.map((item) => formatDetailListItem(item))}
              />
            </DetailSection>
          ))}

          {partitioned.objects.map(({ key, value }) => (
            <DetailSection key={key} label={labelDetailKey(key)}>
              <NestedObject value={value} />
            </DetailSection>
          ))}

          {partitioned.scalars.length > 0 && (
            <DetailSection
              label={
                partitioned.messages.length ||
                partitioned.lists.length ||
                partitioned.objects.length
                  ? "Details"
                  : "Result"
              }
            >
              <ScalarRows entries={partitioned.scalars} />
            </DetailSection>
          )}
        </div>
      )}

      <details className="mt-2 group">
        <summary className="cursor-pointer select-none text-xs font-medium text-icta-gray-600 hover:text-icta-black">
          View raw data
        </summary>
        <pre className="mt-1.5 overflow-x-auto rounded bg-icta-gray-50 p-2 text-xs text-icta-black">
          {JSON.stringify(detail ?? {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}
