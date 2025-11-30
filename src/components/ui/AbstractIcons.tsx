// Abstract Icons - 3D geometric icons for KripTik AI

// Shared accent color
const ACCENT_RED = '#DC2626';
const ACCENT_RED_LIGHT = '#EF4444';

/**
 * 1. Upload Design - Rising arrow with layered planes
 * Concept: Ascending layers suggesting upload motion
 */
export const UploadDesignIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Back plane */}
    <path d="M20 55L40 45L60 55L60 65L40 75L20 65V55Z" fill="#1F1F1F" />
    {/* Middle plane */}
    <path d="M20 42L40 32L60 42L60 52L40 62L20 52V42Z" fill="#3D3D3D" />
    <path d="M40 32L60 42V52L40 62V32Z" fill="#2A2A2A" />
    {/* Top plane with red accent */}
    <path d="M20 29L40 19L60 29L60 39L40 49L20 39V29Z" fill="#525252" />
    <path d="M40 19L60 29V39L40 49V19Z" fill="#404040" />
    {/* Red arrow pointing up */}
    <path d="M40 8L48 20H44V32H36V20H32L40 8Z" fill={ACCENT_RED} />
    <path d="M40 8L48 20H44V32H40V8Z" fill={ACCENT_RED_LIGHT} />
    {/* Subtle glow */}
    <ellipse cx="40" cy="70" rx="18" ry="4" fill="black" fillOpacity="0.2" />
  </svg>
);

/**
 * 2. Image to Code - Transforming cube with brackets
 * Concept: Image frame morphing into code brackets
 */
export const ImageToCodeIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="22" ry="5" fill="black" fillOpacity="0.15" />
    {/* Back cube face */}
    <path d="M15 25L40 12L65 25V55L40 68L15 55V25Z" fill="#1A1A1A" />
    {/* Left face - image representation */}
    <path d="M15 25L40 38V68L15 55V25Z" fill="#2D2D2D" />
    {/* Mountain/image icon on left face */}
    <path d="M20 42L28 34L33 39L38 32L38 52L20 42Z" fill="#404040" />
    <circle cx="24" cy="35" r="3" fill="#525252" />
    {/* Right face - code representation */}
    <path d="M40 38L65 25V55L40 68V38Z" fill="#3D3D3D" />
    {/* Code brackets on right face */}
    <path d="M48 38L44 44L48 50" stroke={ACCENT_RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M57 38L61 44L57 50" stroke={ACCENT_RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Top face */}
    <path d="M15 25L40 12L65 25L40 38L15 25Z" fill="#4A4A4A" />
    {/* Transformation arrow */}
    <path d="M32 25L48 25" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" />
    <path d="M45 22L48 25L45 28" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * 3. Landing Page - Layered browser window with depth
 * Concept: Stacked page layers with hero section
 */
export const LandingPageIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="20" ry="4" fill="black" fillOpacity="0.2" />
    {/* Back layer */}
    <rect x="22" y="20" width="40" height="50" rx="4" fill="#1A1A1A" transform="translate(4, 4)" />
    {/* Middle layer */}
    <rect x="20" y="16" width="40" height="50" rx="4" fill="#2D2D2D" transform="translate(2, 2)" />
    {/* Front browser window */}
    <rect x="18" y="14" width="44" height="52" rx="4" fill="#3D3D3D" />
    {/* Browser chrome */}
    <rect x="18" y="14" width="44" height="10" rx="4" fill="#4A4A4A" />
    <rect x="18" y="20" width="44" height="4" fill="#4A4A4A" />
    {/* Browser dots */}
    <circle cx="25" cy="19" r="2" fill={ACCENT_RED} />
    <circle cx="32" cy="19" r="2" fill="#5A5A5A" />
    <circle cx="39" cy="19" r="2" fill="#5A5A5A" />
    {/* Content blocks */}
    <rect x="24" y="30" width="32" height="8" rx="1" fill="#525252" />
    <rect x="24" y="42" width="14" height="4" rx="1" fill="#4A4A4A" />
    <rect x="24" y="50" width="32" height="10" rx="1" fill="#2A2A2A" />
    {/* Red CTA button */}
    <rect x="40" y="42" width="16" height="4" rx="1" fill={ACCENT_RED} />
  </svg>
);

/**
 * 4. Dashboard - 3D chart/graph composition
 * Concept: Floating analytics elements
 */
export const DashboardIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="24" ry="5" fill="black" fillOpacity="0.15" />
    {/* Base platform */}
    <path d="M10 50L40 65L70 50L70 55L40 70L10 55V50Z" fill="#1A1A1A" />
    <path d="M10 50L40 35L70 50L40 65L10 50Z" fill="#2D2D2D" />
    {/* Bar chart - back */}
    <path d="M20 50V35L26 32V47L20 50Z" fill="#3D3D3D" />
    <path d="M26 32L32 35V50L26 47V32Z" fill="#2A2A2A" />
    {/* Bar chart - middle (red accent) */}
    <path d="M32 50V28L38 25V47L32 50Z" fill={ACCENT_RED} />
    <path d="M38 25L44 28V50L38 47V25Z" fill="#B91C1C" />
    {/* Bar chart - front */}
    <path d="M44 50V38L50 35V47L44 50Z" fill="#4A4A4A" />
    <path d="M50 35L56 38V50L50 47V35Z" fill="#3D3D3D" />
    {/* Floating metric card */}
    <rect x="48" y="12" width="22" height="16" rx="3" fill="#3D3D3D" />
    <rect x="48" y="12" width="22" height="16" rx="3" stroke="#4A4A4A" strokeWidth="1" />
    <rect x="52" y="16" width="10" height="3" rx="1" fill="#5A5A5A" />
    <rect x="52" y="21" width="14" height="4" rx="1" fill={ACCENT_RED} fillOpacity="0.8" />
    {/* Connection line */}
    <path d="M48 28L38 35" stroke="#4A4A4A" strokeWidth="1" strokeDasharray="2 2" />
  </svg>
);

/**
 * 5. SaaS App - Interconnected modules/spheres
 * Concept: Connected system of components
 */
export const SaasAppIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sphereGradient1" cx="30%" cy="30%">
        <stop offset="0%" stopColor="#5A5A5A" />
        <stop offset="100%" stopColor="#1A1A1A" />
      </radialGradient>
      <radialGradient id="sphereGradient2" cx="30%" cy="30%">
        <stop offset="0%" stopColor="#4A4A4A" />
        <stop offset="100%" stopColor="#1F1F1F" />
      </radialGradient>
      <radialGradient id="sphereGradientRed" cx="30%" cy="30%">
        <stop offset="0%" stopColor={ACCENT_RED_LIGHT} />
        <stop offset="100%" stopColor="#991B1B" />
      </radialGradient>
    </defs>
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="22" ry="4" fill="black" fillOpacity="0.2" />
    {/* Connection lines */}
    <path d="M25 28L40 40" stroke="#3D3D3D" strokeWidth="3" />
    <path d="M55 28L40 40" stroke="#3D3D3D" strokeWidth="3" />
    <path d="M40 40L25 55" stroke="#3D3D3D" strokeWidth="3" />
    <path d="M40 40L55 55" stroke="#3D3D3D" strokeWidth="3" />
    <path d="M40 40V58" stroke={ACCENT_RED} strokeWidth="3" />
    {/* Top left sphere */}
    <circle cx="25" cy="24" r="12" fill="url(#sphereGradient1)" />
    <ellipse cx="22" cy="20" rx="4" ry="2" fill="white" fillOpacity="0.15" />
    {/* Top right sphere */}
    <circle cx="55" cy="24" r="10" fill="url(#sphereGradient2)" />
    <ellipse cx="52" cy="21" rx="3" ry="1.5" fill="white" fillOpacity="0.15" />
    {/* Center sphere (main/red accent) */}
    <circle cx="40" cy="40" r="14" fill="url(#sphereGradientRed)" />
    <ellipse cx="36" cy="35" rx="5" ry="2.5" fill="white" fillOpacity="0.2" />
    {/* Bottom left sphere */}
    <circle cx="25" cy="58" r="8" fill="url(#sphereGradient2)" />
    <ellipse cx="23" cy="55" rx="2.5" ry="1.5" fill="white" fillOpacity="0.15" />
    {/* Bottom right sphere */}
    <circle cx="55" cy="58" r="9" fill="url(#sphereGradient1)" />
    <ellipse cx="52" cy="55" rx="3" ry="1.5" fill="white" fillOpacity="0.15" />
  </svg>
);

/**
 * 6. Fix Broken App - Cracked cube being repaired
 * Concept: Fractured shape with healing element
 */
export const FixBrokenAppIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="20" ry="4" fill="black" fillOpacity="0.2" />
    {/* Broken cube - left fragment */}
    <path d="M12 30L36 18V36L28 52L12 44V30Z" fill="#2D2D2D" />
    <path d="M12 30L28 22L36 18V36L28 40L12 30Z" fill="#4A4A4A" />
    <path d="M28 40V52L36 36V48L28 52" fill="#1F1F1F" />
    {/* Crack line */}
    <path d="M36 18L38 28L34 38L40 48L36 60" stroke="#1A1A1A" strokeWidth="2" />
    {/* Broken cube - right fragment */}
    <path d="M68 30L44 18V36L52 52L68 44V30Z" fill="#3D3D3D" />
    <path d="M68 30L52 22L44 18V36L52 40L68 30Z" fill="#525252" />
    <path d="M52 40V52L44 36V48L52 52" fill="#2A2A2A" />
    {/* Red healing/repair glow in crack */}
    <path d="M38 28L40 38L38 48" stroke={ACCENT_RED} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
    <path d="M42 25L40 35L42 45" stroke={ACCENT_RED_LIGHT} strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
    {/* Wrench tool */}
    <g transform="translate(52, 8) rotate(45)">
      <rect x="0" y="6" width="4" height="14" rx="1" fill="#5A5A5A" />
      <path d="M-2 0L6 0L6 8L4 6L0 6L-2 8V0Z" fill="#4A4A4A" />
      <circle cx="2" cy="4" r="1.5" fill="#3D3D3D" />
    </g>
  </svg>
);

/**
 * 7. New Project - Emerging/birthing geometric form
 * Concept: Fresh creation rising from base
 */
export const NewProjectIcon = ({ size = 80 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="newProjectGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor={ACCENT_RED_LIGHT} />
        <stop offset="100%" stopColor={ACCENT_RED} />
      </linearGradient>
    </defs>
    {/* Shadow */}
    <ellipse cx="40" cy="72" rx="18" ry="4" fill="black" fillOpacity="0.25" />
    {/* Base platform/ground */}
    <path d="M15 55L40 68L65 55L40 42L15 55Z" fill="#2D2D2D" />
    <path d="M15 55L40 68V72L15 59V55Z" fill="#1A1A1A" />
    <path d="M65 55L40 68V72L65 59V55Z" fill="#1F1F1F" />
    {/* Emerging crystal/prism shape */}
    <path d="M40 10L28 35L40 45L52 35L40 10Z" fill="#4A4A4A" />
    {/* Left face */}
    <path d="M28 35L40 45V55L22 48L28 35Z" fill="#3D3D3D" />
    {/* Right face */}
    <path d="M52 35L40 45V55L58 48L52 35Z" fill="#2A2A2A" />
    {/* Top highlight */}
    <path d="M40 10L34 25L40 30L46 25L40 10Z" fill="#5A5A5A" />
    {/* Red energy/glow at emergence point */}
    <ellipse cx="40" cy="55" rx="12" ry="4" fill={ACCENT_RED} fillOpacity="0.4" />
    <ellipse cx="40" cy="55" rx="8" ry="2.5" fill={ACCENT_RED_LIGHT} fillOpacity="0.6" />
    {/* Sparkle/new indicators */}
    <path d="M60 18L62 22L66 22L63 25L64 29L60 27L56 29L57 25L54 22L58 22L60 18Z" fill="url(#newProjectGradient)" />
    <circle cx="22" cy="25" r="2" fill={ACCENT_RED} fillOpacity="0.6" />
    <circle cx="18" cy="32" r="1.5" fill="#5A5A5A" />
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

