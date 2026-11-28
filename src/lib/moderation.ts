export const REPORT_REASONS = [
  "Potential scam or fraudulent listing",
  "Incorrect price or listing details",
  "Listing is unavailable or already occupied",
  "Unsafe or unsuitable living conditions",
  "Duplicate listing",
  "Inappropriate or misleading content",
  "Other concern",
] as const;

export const ADMIN_WARNING_TEMPLATES = [
  {
    title: "Please update your listing",
    message:
      "Hi, our team is reviewing your LodgeMate listing and noticed that some information may be inaccurate or incomplete. Please review and update the details so students can make an informed decision. Contact our team if you need help.",
  },
  {
    title: "Please respond to a report",
    message:
      "Hi, LodgeMate has received a report about your listing. Please review the listing details and reply to our moderation team with any relevant clarification. Your listing may be restricted while we review the concern.",
  },
  {
    title: "Safety concern follow-up",
    message:
      "Hi, a safety concern has been raised about your LodgeMate listing. Please contact our team promptly so we can review it. We may temporarily hide the listing while this concern is investigated.",
  },
  {
    title: "Final warning",
    message:
      "Hi, this is a final warning about your LodgeMate account. Further misleading or policy-violating listings may result in removal of your listings or suspension of your account. Please ensure all information is accurate and up to date.",
  },
] as const;
