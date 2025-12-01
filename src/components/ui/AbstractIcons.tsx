// Abstract Icons - Premium 3D outlined icons for KripTik AI
// Black, white, charcoal with red accents

// Color palette
const COLORS = {
  black: '#0a0a0a',
  charcoal: '#2d2d2d',
  gray: '#4a4a4a',
  lightGray: '#6a6a6a',
  white: '#ffffff',
  offWhite: '#e8e8e8',
  red: '#dc2626',
  redLight: '#ef4444',
  redDark: '#991b1b',
};

/**
 * 1. Upload Design - 3D cloud with rising arrow
 */
export const UploadDesignIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Cloud body - 3D with outline */}
    <path
      d="M6.5 19h11c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.172 0-.342.012-.508.034C16.57 7.17 13.98 5 11 5 7.41 5 4.5 7.91 4.5 11.5c0 .171.007.34.02.508C2.99 12.352 2 13.818 2 15.5 2 17.433 3.567 19 5.5 19h1"
      fill={COLORS.offWhite}
      stroke={COLORS.black}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 3D shadow on cloud */}
    <path
      d="M6.5 19h11c2.485 0 4.5-2.015 4.5-4.5"
      stroke={COLORS.charcoal}
      strokeWidth="0.5"
      strokeLinecap="round"
      transform="translate(0.5, 0.5)"
      opacity="0.4"
    />
    {/* Arrow shaft */}
    <path
      d="M12 21V13"
      stroke={COLORS.black}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Arrow head with red accent */}
    <path
      d="M8 15l4-4 4 4"
      stroke={COLORS.red}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Arrow 3D depth */}
    <path
      d="M9 15.5l3-3 3 3"
      stroke={COLORS.redDark}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.5"
    />
  </svg>
);

/**
 * 2. Image to Code - Frame transforming to brackets
 */
export const ImageToCodeIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Image frame - left side */}
    <rect
      x="2" y="4" width="9" height="9" rx="1.5"
      fill={COLORS.offWhite}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    {/* Mountain icon inside frame */}
    <path
      d="M4 11l2-3 1.5 2L9 8l2 3"
      stroke={COLORS.charcoal}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Sun in frame */}
    <circle cx="9" cy="6.5" r="1" fill={COLORS.gray} />
    {/* 3D depth on frame */}
    <path d="M3 14v-1h8v1" stroke={COLORS.charcoal} strokeWidth="0.75" opacity="0.5" />

    {/* Transformation arrow with red */}
    <path
      d="M12 10h2"
      stroke={COLORS.black}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M13 8l2 2-2 2"
      stroke={COLORS.red}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Code brackets - right side */}
    <path
      d="M17 7l-2 3.5 2 3.5"
      stroke={COLORS.black}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M21 7l2 3.5-2 3.5"
      stroke={COLORS.black}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Red dot between brackets */}
    <circle cx="19" cy="10.5" r="1.5" fill={COLORS.red} />

    {/* Bottom code lines */}
    <rect x="2" y="16" width="8" height="1.5" rx="0.75" fill={COLORS.charcoal} />
    <rect x="2" y="19" width="5" height="1.5" rx="0.75" fill={COLORS.gray} />
    <rect x="14" y="16" width="8" height="1.5" rx="0.75" fill={COLORS.charcoal} />
    <rect x="16" y="19" width="6" height="1.5" rx="0.75" fill={COLORS.red} opacity="0.7" />
  </svg>
);

/**
 * 3. Landing Page - Browser window with hero section
 */
export const LandingPageIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Back page shadow */}
    <rect x="5" y="4" width="16" height="18" rx="2" fill={COLORS.charcoal} opacity="0.5" />
    {/* Main browser window */}
    <rect
      x="3" y="2" width="16" height="18" rx="2"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    {/* Browser chrome bar */}
    <path
      d="M3 6h16"
      stroke={COLORS.black}
      strokeWidth="1"
    />
    {/* Browser dots - red accent on first */}
    <circle cx="5.5" cy="4" r="0.8" fill={COLORS.red} />
    <circle cx="8" cy="4" r="0.8" fill={COLORS.gray} />
    <circle cx="10.5" cy="4" r="0.8" fill={COLORS.gray} />

    {/* Hero section */}
    <rect x="5" y="8" width="12" height="3" rx="0.5" fill={COLORS.charcoal} />
    {/* Subtext */}
    <rect x="5" y="12" width="8" height="1" rx="0.5" fill={COLORS.lightGray} />
    {/* CTA Button with red */}
    <rect x="5" y="14.5" width="5" height="2" rx="1" fill={COLORS.red} />
    <rect x="5.5" y="15" width="4" height="1" rx="0.5" fill={COLORS.white} opacity="0.5" />

    {/* Side image placeholder */}
    <rect x="12" y="12" width="5" height="5" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.75" />
    <path d="M13 16l1.5-2 1 1 1.5-2" stroke={COLORS.gray} strokeWidth="0.75" strokeLinecap="round" />

    {/* 3D edge effect */}
    <path d="M19 4v14a2 2 0 01-2 2" stroke={COLORS.charcoal} strokeWidth="0.75" opacity="0.6" />
  </svg>
);

/**
 * 4. Dashboard - Analytics grid with chart
 */
export const DashboardIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main container */}
    <rect
      x="2" y="2" width="20" height="20" rx="3"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    {/* Grid lines */}
    <path d="M2 9h20M9 2v20" stroke={COLORS.offWhite} strokeWidth="1" />

    {/* Top left - mini chart card */}
    <rect x="3.5" y="3.5" width="4" height="4" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    <path d="M4.5 6l1-1.5 1.5 1" stroke={COLORS.red} strokeWidth="0.75" strokeLinecap="round" />

    {/* Top right - large chart */}
    <rect x="10.5" y="3.5" width="10" height="4" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    {/* Bar chart with red accent */}
    <rect x="12" y="5.5" width="1.5" height="1.5" fill={COLORS.gray} />
    <rect x="14" y="4.5" width="1.5" height="2.5" fill={COLORS.charcoal} />
    <rect x="16" y="5" width="1.5" height="2" fill={COLORS.red} />
    <rect x="18" y="4" width="1.5" height="3" fill={COLORS.gray} />

    {/* Bottom left - stats */}
    <rect x="3.5" y="10.5" width="4" height="10" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    <circle cx="5.5" cy="13" r="1.5" fill={COLORS.red} opacity="0.8" />
    <rect x="4" y="16" width="3" height="0.75" rx="0.375" fill={COLORS.gray} />
    <rect x="4" y="18" width="2" height="0.75" rx="0.375" fill={COLORS.lightGray} />

    {/* Bottom right - main content */}
    <rect x="10.5" y="10.5" width="10" height="10" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    {/* Line chart */}
    <path
      d="M12 18l2-3 2 2 3-4 2 1"
      stroke={COLORS.black}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M12 18l2-3 2 2 3-4 2 1"
      stroke={COLORS.red}
      strokeWidth="0.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      transform="translate(0.3, 0.3)"
      opacity="0.4"
    />
    {/* Dots on chart */}
    <circle cx="14" cy="15" r="1" fill={COLORS.black} />
    <circle cx="16" cy="17" r="1" fill={COLORS.red} />
    <circle cx="19" cy="13" r="1" fill={COLORS.black} />
  </svg>
);

/**
 * 5. SaaS App - Connected modules/hexagons
 */
export const SaasAppIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Connection lines */}
    <path d="M12 8v3M8 14l3-2M16 14l-3-2" stroke={COLORS.charcoal} strokeWidth="1.5" />
    <path d="M12 17v2" stroke={COLORS.red} strokeWidth="1.5" />

    {/* Top hexagon - main */}
    <path
      d="M12 2l4 2.5v5L12 12 8 9.5v-5L12 2z"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* 3D depth */}
    <path d="M12 7v5l4-2.5v-3" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    {/* Red dot center */}
    <circle cx="12" cy="6" r="1.5" fill={COLORS.red} />

    {/* Bottom left module */}
    <rect
      x="3" y="14" width="6" height="6" rx="1.5"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    <rect x="4.5" y="15.5" width="3" height="1" rx="0.5" fill={COLORS.gray} />
    <rect x="4.5" y="17.5" width="2" height="1" rx="0.5" fill={COLORS.charcoal} />

    {/* Bottom right module */}
    <rect
      x="15" y="14" width="6" height="6" rx="1.5"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    <circle cx="18" cy="17" r="2" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.75" />
    <circle cx="18" cy="17" r="0.75" fill={COLORS.red} />

    {/* Bottom center indicator */}
    <rect x="10" y="20" width="4" height="2" rx="1" fill={COLORS.red} opacity="0.8" />
  </svg>
);

/**
 * 6. Fix Broken App - Wrench on cracked screen
 */
export const FixBrokenAppIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Broken screen/window */}
    <rect
      x="2" y="3" width="14" height="14" rx="2"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />
    {/* Crack lines */}
    <path
      d="M9 3l-1 4 2 2-2 4 1 4"
      stroke={COLORS.charcoal}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 8l4 1"
      stroke={COLORS.gray}
      strokeWidth="0.75"
      strokeLinecap="round"
    />
    {/* Red glow in crack */}
    <path
      d="M8 7l1 2-1 3"
      stroke={COLORS.red}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.7"
    />

    {/* 3D shadow */}
    <path d="M16 5v10a2 2 0 01-2 2" stroke={COLORS.charcoal} strokeWidth="0.75" opacity="0.5" />

    {/* Wrench tool */}
    <g transform="translate(14, 10) rotate(45)">
      {/* Handle */}
      <rect
        x="0" y="3" width="2.5" height="8" rx="0.5"
        fill={COLORS.gray}
        stroke={COLORS.black}
        strokeWidth="0.75"
      />
      {/* Head */}
      <path
        d="M-1 0h4.5l.5 1v2l-.5 1h-5l-.5-1v-2l.5-1z"
        fill={COLORS.offWhite}
        stroke={COLORS.black}
        strokeWidth="0.75"
      />
      {/* Opening */}
      <rect x="0.5" y="1" width="1.5" height="2" fill={COLORS.charcoal} />
    </g>

    {/* Red spark/fixing indicator */}
    <circle cx="20" cy="8" r="1.5" fill={COLORS.red} />
    <path d="M20 5v1M20 10v1M17.5 8h1M21.5 8h1" stroke={COLORS.redLight} strokeWidth="0.75" strokeLinecap="round" />

    {/* Progress bar at bottom */}
    <rect x="2" y="20" width="20" height="2" rx="1" fill={COLORS.offWhite} stroke={COLORS.charcoal} strokeWidth="0.5" />
    <rect x="2.5" y="20.5" width="12" height="1" rx="0.5" fill={COLORS.red} />
  </svg>
);

/**
 * 7. New Project - Sparkle cube emerging
 */
export const NewProjectIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shadow/ground */}
    <ellipse cx="12" cy="21" rx="6" ry="1.5" fill={COLORS.black} opacity="0.15" />

    {/* 3D Box - bottom face */}
    <path
      d="M6 15l6 3 6-3v-4l-6 3-6-3v4z"
      fill={COLORS.charcoal}
      stroke={COLORS.black}
      strokeWidth="1"
    />
    {/* 3D Box - left face */}
    <path
      d="M6 11v4l6 3v-4l-6-3z"
      fill={COLORS.gray}
      stroke={COLORS.black}
      strokeWidth="1"
    />
    {/* 3D Box - right face */}
    <path
      d="M18 11v4l-6 3v-4l6-3z"
      fill={COLORS.offWhite}
      stroke={COLORS.black}
      strokeWidth="1"
    />
    {/* 3D Box - top face */}
    <path
      d="M6 11l6-3 6 3-6 3-6-3z"
      fill={COLORS.white}
      stroke={COLORS.black}
      strokeWidth="1.5"
    />

    {/* Plus sign on top with red glow */}
    <path
      d="M12 6v4M10 8h4"
      stroke={COLORS.red}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Plus glow */}
    <path
      d="M12 6v4M10 8h4"
      stroke={COLORS.redLight}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.5"
      transform="translate(0.3, 0.3)"
    />

    {/* Sparkles */}
    <path
      d="M4 4l.5 1.5L6 6l-1.5.5L4 8l-.5-1.5L2 6l1.5-.5L4 4z"
      fill={COLORS.red}
    />
    <path
      d="M20 3l.3 1L21 4.3l-.7.3-.3 1-.3-1-.7-.3.7-.3.3-1z"
      fill={COLORS.gray}
    />
    <circle cx="19" cy="10" r="0.75" fill={COLORS.red} opacity="0.8" />
    <circle cx="5" cy="12" r="0.5" fill={COLORS.charcoal} />

    {/* Rising particles */}
    <circle cx="10" cy="4" r="0.5" fill={COLORS.redLight} opacity="0.6" />
    <circle cx="14" cy="3" r="0.5" fill={COLORS.redLight} opacity="0.4" />
  </svg>
);

// Export all icons as a collection
export const AbstractIcons = {
  UploadDesign: UploadDesignIcon,
  ImageToCode: ImageToCodeIcon,
  LandingPage: LandingPageIcon,
  Dashboard: DashboardIcon,
  SaasApp: SaasAppIcon,
  FixBrokenApp: FixBrokenAppIcon,
  NewProject: NewProjectIcon,
};

export default AbstractIcons;
