import type { ManualReviewCheckType } from "@/lib/api";

export type ReviewGuideStep = {
  id: string;
  label: string;
  /** When true, officer must open the live site (tracked via CTA click). */
  requiresLiveSite?: boolean;
};

export type ReviewGuide = {
  summary: string;
  howToDecide: string;
  steps: ReviewGuideStep[];
};

const SITE_OPEN: ReviewGuideStep = {
  id: "open_live_site",
  label: "Open the live site in a new tab and keep it visible while you review",
  requiresLiveSite: true,
};

const ATTESTATION_CONTACT: ReviewGuideStep = {
  id: "request_evidence",
  label:
    "Contact the ministry/agency webmaster or ICT lead and request written evidence for this control",
};

const ATTESTATION_RECORD: ReviewGuideStep = {
  id: "record_evidence",
  label:
    "Record who provided the evidence, the date received, and where it is stored (ticket, email, or file)",
};

/**
 * Officer-facing review scripts per check. Steps must be completed before
 * Pass / Fail / Flagged can be recorded.
 */
export const MANUAL_REVIEW_GUIDES: Record<string, ReviewGuide> = {
  domain_not_personal_name: {
    summary:
      "Confirm the domain name is institutional — not a personal name or unofficial brand.",
    howToDecide:
      "Pass if the hostname clearly represents a government institution. Fail if it uses a personal name, unofficial nickname, or private branding. Flag if unclear without registry confirmation.",
    steps: [
      SITE_OPEN,
      {
        id: "read_hostname",
        label:
          "Read the full hostname and compare it to the registered ministry/agency name",
      },
      {
        id: "check_personal",
        label:
          "Confirm it is not a person’s name, campaign slogan, or unofficial project nickname",
      },
    ],
  },
  image_link_alt: {
    summary:
      "When an image is used as a link, its alt text must describe the link destination — not only the image.",
    howToDecide:
      "Pass if image links have destination-describing alt (or equivalent accessible name). Fail if alt is missing, decorative-only, or mismatches the destination. Flag if you cannot inspect enough linked images.",
    steps: [
      SITE_OPEN,
      {
        id: "find_image_links",
        label:
          "Locate at least 3 image-as-link examples (logos, banners, card thumbnails, social icons)",
      },
      {
        id: "inspect_alt",
        label:
          "Inspect each linked image’s accessible name / alt and confirm it describes where the link goes",
      },
    ],
  },
  media_captions: {
    summary:
      "Audio/video content that conveys information should provide captions or a text equivalent.",
    howToDecide:
      "Pass if published media has captions/transcripts where needed. Fail if informational media lacks any caption/transcript. Flag if no media is present or you cannot verify captions.",
    steps: [
      SITE_OPEN,
      {
        id: "find_media",
        label: "Find any informational video or audio on the homepage or key service pages",
      },
      {
        id: "check_captions",
        label:
          "Play or inspect each item and confirm captions, subtitles, or a transcript are available",
      },
    ],
  },
  embedded_video_alt: {
    summary:
      "Embedded videos need an accessible text alternative describing the content or purpose.",
    howToDecide:
      "Pass if embeds include a title/aria-label/transcript describing the video. Fail if embeds have no accessible name or text alternative. Flag if no embeds are found.",
    steps: [
      SITE_OPEN,
      {
        id: "find_embeds",
        label: "Locate embedded videos (YouTube/Vimeo/iframe players) on primary pages",
      },
      {
        id: "check_alt_name",
        label:
          "Confirm each embed has a meaningful title/accessible name or adjacent transcript/description",
      },
    ],
  },
  no_flashing: {
    summary:
      "Pages must not include flashing or strobing content that can trigger seizures.",
    howToDecide:
      "Pass if no flashing/strobing content is present. Fail if any content flashes more than ~3 times per second or uses aggressive strobing. Flag if animation behaviour is ambiguous.",
    steps: [
      SITE_OPEN,
      {
        id: "watch_hero",
        label:
          "Watch carousels, hero banners, and animated media for at least 5 seconds on first load",
      },
      {
        id: "confirm_no_strobe",
        label:
          "Confirm nothing flashes rapidly, strobes, or uses high-contrast blink effects",
      },
    ],
  },
  responsive_mobile: {
    summary:
      "The site must remain usable on mobile viewport sizes without broken layout or unusable controls.",
    howToDecide:
      "Pass if primary content and navigation remain usable at ~375px width. Fail if content overflows, requires horizontal scroll for core tasks, or controls are unusable. Flag if only minor issues appear.",
    steps: [
      SITE_OPEN,
      {
        id: "resize_mobile",
        label:
          "Resize the browser (or use device tools) to about 375px width and reload the homepage",
      },
      {
        id: "test_nav_content",
        label:
          "Confirm navigation, main content, and key CTAs remain readable and operable without horizontal scrolling",
      },
    ],
  },
  coat_of_arms: {
    summary:
      "Official government sites should display the Coat of Arms and/or required official banner.",
    howToDecide:
      "Pass if the Coat of Arms or approved official banner is clearly present in the header/branding area. Fail if missing or replaced by unofficial branding. Flag if a similar emblem is present but authenticity is unclear.",
    steps: [
      SITE_OPEN,
      {
        id: "inspect_header",
        label: "Inspect the site header / masthead branding area",
      },
      {
        id: "confirm_coa",
        label:
          "Confirm the Kenya Coat of Arms or approved official government banner is present and clearly visible",
      },
    ],
  },
  g4c_index_structure: {
    summary:
      "Government for Citizens (G4C) index pages should follow the required structural pattern.",
    howToDecide:
      "Pass if the index structure matches ICTA G4C expectations (sections, hierarchy, required groupings). Fail if structure is missing or clearly non-compliant. Flag if the site is not a G4C index or structure is only partially aligned.",
    steps: [
      SITE_OPEN,
      {
        id: "open_index",
        label: "Open the main index / services directory page used for citizen navigation",
      },
      {
        id: "compare_structure",
        label:
          "Compare headings, groupings, and navigation structure against the ICTA G4C index pattern in the Standards PDF",
      },
    ],
  },
  images_not_distorted: {
    summary:
      "Images should display at natural proportions — not stretched, squashed, or heavily pixelated.",
    howToDecide:
      "Pass if sampled images keep correct aspect ratio and acceptable quality. Fail if logos/photos are clearly stretched or distorted. Flag if only minor quality issues appear.",
    steps: [
      SITE_OPEN,
      {
        id: "sample_images",
        label: "Inspect logos, hero images, and at least 3 content images on primary pages",
      },
      {
        id: "check_distortion",
        label:
          "Confirm images are not stretched, squashed, cropped into illegibility, or heavily pixelated",
      },
    ],
  },
  copyright_attribution: {
    summary:
      "Copyrighted or third-party content should carry appropriate attribution / copyright notice.",
    howToDecide:
      "Pass if footer/legal pages show a clear copyright notice and third-party content is attributed where required. Fail if copyright notice is missing and content appears unattributed. Flag if only partial notices exist.",
    steps: [
      SITE_OPEN,
      {
        id: "check_footer",
        label: "Open the footer and any Privacy / Terms / Copyright pages",
      },
      {
        id: "confirm_notice",
        label:
          "Confirm a copyright notice is present and third-party photos/media (if any) are attributed",
      },
    ],
  },
  content_freshness: {
    summary:
      "Published content should be current enough that citizens are not relying on stale official information.",
    howToDecide:
      "Pass if key pages show recent updates or clearly current information. Fail if critical pages are years out of date with broken services/info. Flag if some sections are stale but core services look current.",
    steps: [
      SITE_OPEN,
      {
        id: "check_dates",
        label:
          "Check news, notices, and key service pages for last-updated dates or obvious currency",
      },
      {
        id: "spot_stale",
        label:
          "Note any critical pages that appear abandoned, expired, or more than ~2 years without updates",
      },
    ],
  },
  db_isolation: {
    summary:
      "Web applications must keep databases isolated — not directly exposed to the public internet.",
    howToDecide:
      "Pass only with credible institutional evidence of network/database isolation. Fail if evidence shows direct public DB exposure or no isolation controls. Flag if evidence is incomplete or outdated.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "verify_isolation",
        label:
          "Verify evidence that application databases are not publicly reachable (firewall/VPC/private subnet or equivalent)",
      },
      ATTESTATION_RECORD,
    ],
  },
  no_malicious_code: {
    summary:
      "The institution must confirm processes that prevent and detect malicious code on the site/app stack.",
    howToDecide:
      "Pass with credible evidence of malware scanning / secure deployment controls. Fail if no controls exist or known malware incidents are unresolved. Flag if controls are informal or undocumented.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "verify_malware_controls",
        label:
          "Review evidence of malware scanning, secure code deployment, or equivalent anti-malicious-code controls",
      },
      ATTESTATION_RECORD,
    ],
  },
  cms_patched: {
    summary:
      "CMS and related platform components should be kept patched to supported, secure versions.",
    howToDecide:
      "Pass if evidence shows a current CMS version and a patching cadence. Fail if unsupported/EOL versions are in production. Flag if version evidence is partial.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "verify_cms_version",
        label:
          "Confirm CMS/platform version and that security patches are applied on a defined schedule",
      },
      ATTESTATION_RECORD,
    ],
  },
  vuln_scanning_process: {
    summary:
      "There should be a defined vulnerability scanning / remediation process for the public site.",
    howToDecide:
      "Pass if a documented scanning process and recent scan evidence exist. Fail if no scanning process exists. Flag if process exists but recent results are missing.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "verify_vuln_process",
        label:
          "Review the vulnerability scanning schedule, tool/process used, and how findings are remediated",
      },
      ATTESTATION_RECORD,
    ],
  },
  server_side_scripting: {
    summary:
      "Dynamic behaviour should prefer server-side scripting over client-only approaches where the standard requires it.",
    howToDecide:
      "Pass if the institution attests that core dynamic features use approved server-side technologies. Fail if critical functionality depends on disallowed client-only approaches contrary to the standard. Flag if the technology stack cannot be confirmed.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "verify_stack",
        label:
          "Confirm the site’s dynamic pages use approved server-side scripting (and note the stack if provided)",
      },
      ATTESTATION_RECORD,
    ],
  },
};

export function getReviewGuide(
  checkName: string,
  checkType: ManualReviewCheckType,
): ReviewGuide {
  const specific = MANUAL_REVIEW_GUIDES[checkName];
  if (specific) return specific;

  if (checkType === "site_inspection") {
    return {
      summary:
        "Inspect the live website against the ICTA clause for this check.",
      howToDecide:
        "Pass if the requirement is met on the live site. Fail if it is clearly not met. Flag if evidence is incomplete.",
      steps: [
        SITE_OPEN,
        {
          id: "inspect_requirement",
          label: "Inspect the relevant pages and confirm whether the clause requirement is met",
        },
        {
          id: "note_evidence",
          label: "Note concrete evidence (what you saw, where, and any exceptions)",
        },
      ],
    };
  }

  return {
    summary:
      "Obtain institutional evidence for this control — it cannot be verified from the public page alone.",
    howToDecide:
      "Pass only with credible written evidence. Fail if the control is absent. Flag if evidence is incomplete.",
    steps: [
      ATTESTATION_CONTACT,
      {
        id: "review_evidence",
        label: "Review the evidence against the ICTA clause requirement",
      },
      ATTESTATION_RECORD,
    ],
  };
}
