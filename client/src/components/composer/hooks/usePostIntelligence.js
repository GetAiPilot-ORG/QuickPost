/**
 * usePostIntelligence.js
 * ─────────────────────────────────────────────────────────────────
 * React hook that wraps PostIntelligenceEngine.
 * Re-runs only when relevant state changes (fully memoized).
 *
 * Returns the full intelligence result plus derived helpers.
 */

import { useMemo } from "react";
import { PostIntelligenceEngine } from "../engines/PostIntelligenceEngine.js";

/**
 * @param {object} postState — mirrors the fields PostIntelligenceEngine expects
 * @returns {{ intelligence, hasBlockingError, totalIssues, panelItems }}
 */
export function usePostIntelligence(postState) {
  const intelligence = useMemo(
    () => PostIntelligenceEngine(postState),
    [
      // Stringify arrays/objects for stable comparison without deep-equal deps
      JSON.stringify(postState.selectedChannels),
      postState.mediaFiles?.length,
      // Check first file type — if it changes, re-run
      postState.mediaFiles?.[0]?.file?.type,
      JSON.stringify(postState.platformData),
      postState.youtubeThumbnail,
      postState.instagramCover,
      postState.postType,
      postState.caption?.length,          // Re-run on length change (char limit checks)
      postState.scheduledAt,
      postState.isScheduled,
      JSON.stringify(postState.connectedAccounts),
    ]
  );

  /** True if any blocking error exists — disables the publish button */
  const hasBlockingError = useMemo(
    () => intelligence.errors.some((e) => e.blocking),
    [intelligence.errors]
  );

  /** Total count of errors + warnings (for badge display) */
  const totalIssues = useMemo(
    () => intelligence.errors.length + intelligence.warnings.length,
    [intelligence.errors, intelligence.warnings]
  );

  /**
   * Flat ordered list for the IntelligencePanel to render.
   * Order: errors → warnings → behaviors → suggestions
   */
  const panelItems = useMemo(() => [
    ...intelligence.errors.map((i)      => ({ ...i, kind: "error"      })),
    ...intelligence.warnings.map((i)    => ({ ...i, kind: "warning"    })),
    ...intelligence.behaviors.map((i)   => ({ ...i, kind: "behavior"   })),
    ...intelligence.suggestions.map((i) => ({ ...i, kind: "suggestion" })),
  ], [intelligence]);

  return { intelligence, hasBlockingError, totalIssues, panelItems };
}
