"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  standardsHrefForClause,
  standardsViewerHref,
  WEBSITES_SECTION_PAGE,
} from "@/lib/standards";

const linkClass =
  "text-icta-link underline decoration-from-font underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icta-link";

interface ClauseLinkProps {
  clause: string;
  /** When true, prefix with “clause ” for inline copy. */
  showPrefix?: boolean;
  className?: string;
}

/** Blue deep-link to the embedded standards PDF at this clause’s page. */
export function ClauseLink({
  clause,
  showPrefix = false,
  className = "",
}: ClauseLinkProps) {
  const href = standardsHrefForClause(clause);
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} ${className}`.trim()}
      title={`Open standard at clause ${clause}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showPrefix ? `clause ${clause}` : clause}
    </Link>
  );
}

interface StandardDocLinkProps {
  children?: ReactNode;
  className?: string;
}

/** Link to the websites chapter of the embedded ICTA standard. */
export function StandardDocLink({
  children = "ICTA.6.003:2023 §6.5",
  className = "",
}: StandardDocLinkProps) {
  return (
    <Link
      href={standardsViewerHref({ page: WEBSITES_SECTION_PAGE })}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} ${className}`.trim()}
      title="Open Systems & Applications Standard — Websites section"
    >
      {children}
    </Link>
  );
}
